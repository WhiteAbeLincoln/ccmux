# Codex CLI Streaming Protocol

## Overview

- **Agent:** Codex CLI (OpenAI)
- **Interfaces:** JSON-RPC over stdio/WebSocket (IDE integration), `codex exec --json` (headless JSONL)
- **Transport:** Line-delimited JSON-RPC 2.0 (without the `"jsonrpc": "2.0"` field requirement)
- **Architecture:** Single shared app-server process multiplexes sessions via `threadId`

## Architecture

```
VS Code Extension / CLI
    |
    | JSON-RPC 2.0 (line-delimited JSON over stdio or WebSocket)
    | ClientRequest / ServerNotification / ServerRequest
    |
codex-rs/app-server  (Rust, single process, multiplexes threads)
    |
    | EventMsg (internal event bus, tokio channels)
    |
codex-rs/core  (agent loop, tool execution, sandbox)
    |
    | SSE stream (POST /v1/responses with stream:true)
    | OR WebSocket (response.create for connection prewarm)
    |
OpenAI Responses API
```

## JSON-RPC Wire Format

Source: [`codex-rs/app-server-protocol/src/jsonrpc_lite.rs`](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/src/jsonrpc_lite.rs)

```rust
#[serde(untagged)]
pub enum JSONRPCMessage {
    Request(JSONRPCRequest),
    Notification(JSONRPCNotification),
    Response(JSONRPCResponse),
    Error(JSONRPCError),
}

pub struct JSONRPCRequest {
    pub id: RequestId,
    pub method: String,
    pub params: Option<serde_json::Value>,
    pub trace: Option<W3cTraceContext>,
}

pub struct JSONRPCNotification {
    pub method: String,
    pub params: Option<serde_json::Value>,
}

pub struct JSONRPCResponse {
    pub id: RequestId,
    pub result: Result,
}

pub struct JSONRPCError {
    pub error: JSONRPCErrorError,
    pub id: RequestId,
}

#[serde(untagged)]
pub enum RequestId {
    String(String),
    Integer(i64),
}
```

Transport selection: stdio (default, line-delimited JSON on stdin/stdout) or WebSocket (`ws://IP:PORT`).

Source: [`codex-rs/app-server/src/transport/stdio.rs`](https://github.com/openai/codex/blob/main/codex-rs/app-server/src/transport/stdio.rs)

## Client -> Server Requests

Source: [`codex-rs/app-server-protocol/src/protocol/common.rs`](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/src/protocol/common.rs)

| Method | Description |
|--------|-------------|
| `thread/start` | Create new thread/session |
| `thread/resume` | Resume existing thread |
| `thread/fork` | Fork a thread |
| `turn/start` | Send user message, start agent turn |
| `turn/steer` | Steer an in-progress turn |
| `turn/interrupt` | Interrupt current turn |
| `thread/compact/start` | Trigger compaction |
| `thread/rollback` | Rollback thread |
| `thread/read` | Read thread history |
| `thread/list` | List threads |
| `model/list` | List available models |
| `review/start` | Start code review |
| `skills/list` | List skills |
| `thread/realtime/start` | Start realtime audio conversation |

## Server -> Client Requests (require response)

| Method | Description |
|--------|-------------|
| `item/commandExecution/requestApproval` | Approve command execution |
| `item/fileChange/requestApproval` | Approve file change |
| `item/tool/requestUserInput` | Ask user for input |
| `mcpServer/elicitation/request` | MCP elicitation |
| `item/permissions/requestApproval` | Request permission upgrade |
| `item/tool/call` | Dynamic tool call on client |

## Server -> Client Notifications (streaming events)

All streaming events are JSON-RPC notifications (no `id` field, no response expected). The `method` field discriminates event types.

Source: [`codex-rs/app-server-protocol/src/protocol/common.rs`](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/src/protocol/common.rs) (lines 911-976)

### Complete Notification Method List

| Method | Notification Type |
|--------|-------------------|
| `error` | Error |
| `thread/started` | Thread started |
| `thread/status/changed` | Thread status changed |
| `thread/archived` | Thread archived |
| `thread/unarchived` | Thread unarchived |
| `thread/closed` | Thread closed |
| `skills/changed` | Skills list changed |
| `thread/name/updated` | Thread name updated |
| `thread/tokenUsage/updated` | Token usage updated |
| `turn/started` | Turn started |
| `hook/started` | Hook started |
| `turn/completed` | Turn completed |
| `hook/completed` | Hook completed |
| `turn/diff/updated` | Turn diff updated |
| `turn/plan/updated` | Turn plan updated |
| `item/started` | Item started |
| `item/autoApprovalReview/started` | Guardian review started |
| `item/autoApprovalReview/completed` | Guardian review completed |
| `item/completed` | Item completed |
| `rawResponseItem/completed` | Raw response item completed |
| `item/agentMessage/delta` | **Agent text streaming delta** |
| `item/plan/delta` | **Plan streaming delta** |
| `command/exec/outputDelta` | **Command output delta (base64)** |
| `item/commandExecution/outputDelta` | **Command execution output delta** |
| `item/commandExecution/terminalInteraction` | Terminal interaction |
| `item/fileChange/outputDelta` | **File change output delta** |
| `serverRequest/resolved` | Server request resolved |
| `item/mcpToolCall/progress` | MCP tool call progress |
| `mcpServer/oauthLogin/completed` | MCP OAuth login completed |
| `mcpServer/startupStatus/updated` | MCP server status updated |
| `account/updated` | Account updated |
| `account/rateLimits/updated` | Rate limits updated |
| `app/list/updated` | App list updated |
| `fs/changed` | Filesystem changed |
| `item/reasoning/summaryTextDelta` | **Reasoning summary text delta** |
| `item/reasoning/summaryPartAdded` | Reasoning summary part added |
| `item/reasoning/textDelta` | **Raw reasoning text delta** |
| `thread/compacted` | Context compacted |
| `model/rerouted` | Model rerouted |
| `deprecationNotice` | Deprecation notice |
| `configWarning` | Config warning |

### Delta Notification Payloads

Source: [`codex-rs/app-server-protocol/src/protocol/v2.rs`](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/src/protocol/v2.rs)

```rust
// Agent text streaming delta
pub struct AgentMessageDeltaNotification {
    pub thread_id: String,
    pub turn_id: String,
    pub item_id: String,
    pub delta: String,
}

// Reasoning summary text delta
pub struct ReasoningSummaryTextDeltaNotification {
    pub thread_id: String,
    pub turn_id: String,
    pub item_id: String,
    pub delta: String,
    pub summary_index: i64,
}

// Raw reasoning text delta
pub struct ReasoningTextDeltaNotification {
    pub thread_id: String,
    pub turn_id: String,
    pub item_id: String,
    pub delta: String,
    pub content_index: i64,
}

// Command execution stdout/stderr delta
pub struct CommandExecutionOutputDeltaNotification {
    pub thread_id: String,
    pub turn_id: String,
    pub item_id: String,
    pub delta: String,
}

// File change (patch) output delta
pub struct FileChangeOutputDeltaNotification {
    pub thread_id: String,
    pub turn_id: String,
    pub item_id: String,
    pub delta: String,
}

// Plan streaming delta
pub struct PlanDeltaNotification {
    pub thread_id: String,
    pub turn_id: String,
    pub item_id: String,
    pub delta: String,
}

// Base64-encoded raw command exec output (connection-scoped)
pub struct CommandExecOutputDeltaNotification {
    pub process_id: String,
    pub stream: CommandExecOutputStream,  // Stdout | Stderr
    pub delta_base64: String,
    pub cap_reached: bool,
}
```

### Lifecycle Notification Payloads

```rust
pub struct TurnStartedNotification {
    pub thread_id: String,
    pub turn: Turn,
}

pub struct TurnCompletedNotification {
    pub thread_id: String,
    pub turn: Turn,  // contains items, status, error
}

pub struct ItemStartedNotification {
    pub item: ThreadItem,
    pub thread_id: String,
    pub turn_id: String,
}

pub struct ItemCompletedNotification {
    pub item: ThreadItem,
    pub thread_id: String,
    pub turn_id: String,
}
```

### ThreadItem (typed union for items)

```rust
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ThreadItemDetails {
    AgentMessage(AgentMessageItem),
    Reasoning(ReasoningItem),
    CommandExecution(CommandExecutionItem),
    FileChange(FileChangeItem),
    McpToolCall(McpToolCallItem),
    CollabToolCall(CollabToolCallItem),
    WebSearch(WebSearchItem),
    TodoList(TodoListItem),
    Error(ErrorItem),
}
```

## Headless Mode: `codex exec --json`

Source: [`codex-rs/exec/src/exec_events.rs`](https://github.com/openai/codex/blob/main/codex-rs/exec/src/exec_events.rs)

When running `codex exec --json`, output is JSONL to stdout with a simplified event model. **Does NOT include text deltas** -- only emits lifecycle events with full content.

```rust
#[serde(tag = "type")]
pub enum ThreadEvent {
    #[serde(rename = "thread.started")]
    ThreadStarted(ThreadStartedEvent),
    #[serde(rename = "turn.started")]
    TurnStarted(TurnStartedEvent),
    #[serde(rename = "turn.completed")]
    TurnCompleted(TurnCompletedEvent),
    #[serde(rename = "turn.failed")]
    TurnFailed(TurnFailedEvent),
    #[serde(rename = "item.started")]
    ItemStarted(ItemStartedEvent),
    #[serde(rename = "item.updated")]
    ItemUpdated(ItemUpdatedEvent),
    #[serde(rename = "item.completed")]
    ItemCompleted(ItemCompletedEvent),
    #[serde(rename = "error")]
    Error(ThreadErrorEvent),
}

pub struct ThreadStartedEvent { pub thread_id: String }
pub struct TurnStartedEvent {}
pub struct TurnCompletedEvent { pub usage: Usage }
pub struct TurnFailedEvent { pub error: ThreadErrorEvent }
```

The `EventProcessorWithJsonOutput` in [`codex-rs/exec/src/event_processor_with_jsonl_output.rs`](https://github.com/openai/codex/blob/main/codex-rs/exec/src/event_processor_with_jsonl_output.rs) maps `ServerNotification` events to `ThreadEvent`.

## Internal Event Bus: EventMsg

Source: [`codex-rs/protocol/src/protocol.rs`](https://github.com/openai/codex/blob/main/codex-rs/protocol/src/protocol.rs)

The app-server maps internal `EventMsg` variants to v2 `ServerNotification`s. Key delta event structs in the internal model:

```rust
pub struct AgentMessageDeltaEvent { pub delta: String }
pub struct AgentReasoningDeltaEvent { pub delta: String }
pub struct AgentReasoningRawContentDeltaEvent { pub delta: String }
pub struct AgentMessageContentDeltaEvent {
    pub thread_id: String,
    pub turn_id: String,
    pub item_id: String,
    pub delta: String,
}

pub struct ExecCommandOutputDeltaEvent {
    pub call_id: String,
    pub stream: ExecOutputStream,  // Stdout | Stderr
    pub chunk: Vec<u8>,            // base64-encoded on wire
}
```

## OpenAI Responses API Streaming (SSE)

Source: [`codex-rs/codex-api/src/common.rs`](https://github.com/openai/codex/blob/main/codex-rs/codex-api/src/common.rs)

Codex talks to `POST /v1/responses` with `stream: true` and receives Server-Sent Events:

```rust
pub enum ResponseEvent {
    Created,
    OutputItemDone(ResponseItem),
    OutputItemAdded(ResponseItem),
    ServerModel(String),
    ServerReasoningIncluded(bool),
    Completed { response_id: String, token_usage: Option<TokenUsage> },
    OutputTextDelta(String),
    ReasoningSummaryDelta { delta: String, summary_index: i64 },
    ReasoningContentDelta { delta: String, content_index: i64 },
    ReasoningSummaryPartAdded { summary_index: i64 },
    RateLimits(RateLimitSnapshot),
    ModelsEtag(String),
}
```

SSE event type mapping from [`codex-rs/codex-api/src/sse/responses.rs`](https://github.com/openai/codex/blob/main/codex-rs/codex-api/src/sse/responses.rs):

| SSE `type` | `ResponseEvent` |
|---|---|
| `response.created` | `Created` |
| `response.output_item.done` | `OutputItemDone(ResponseItem)` |
| `response.output_item.added` | `OutputItemAdded(ResponseItem)` |
| `response.output_text.delta` | `OutputTextDelta(delta)` |
| `response.reasoning_summary_text.delta` | `ReasoningSummaryDelta` |
| `response.reasoning_text.delta` | `ReasoningContentDelta` |
| `response.reasoning_summary_part.added` | `ReasoningSummaryPartAdded` |
| `response.completed` | `Completed` |
| `response.failed` | Error |
| `response.incomplete` | Error |

Also supports WebSocket transport to the Responses API for lower latency (connection prewarm via `response.create` with `generate=false`).

## VS Code Extension Wire Protocol Example

Source: [zafnz/cc-insights](https://github.com/zafnz/cc-insights/tree/main/examples/raw)

```json
{"timestamp":"2026-02-09T17:53:53.457034","level":"debug","direction":"stdin","content":{"jsonrpc":"2.0","id":6,"method":"model/list","params":{}}}
{"timestamp":"2026-02-09T17:53:53.459959","level":"debug","direction":"stdin","content":{"jsonrpc":"2.0","id":7,"method":"thread/start","params":{"cwd":"/Users/zaf/projects/pelagia"}}}
{"timestamp":"2026-02-09T17:53:54.129817","level":"debug","direction":"stdout","content":{"id":7,"result":{"thread":{"id":"c7e5f636-0000-0000-0000-000000000001","modelProvider":"openai","cliVersion":"0.95.0","source":"vscode"},"model":"gpt-5.2-codex","approvalPolicy":"on-request","sandbox":{"type":"workspaceWrite"}}}}
```

Event notification examples from the wire protocol:

- `codex/event/task_started` -- turn begins
- `codex/event/agent_message_content_delta` -- streaming text delta
- `codex/event/exec_command_begin` / `exec_command_end` -- shell tool lifecycle
- `codex/event/patch_apply_begin` -- file edit
- `codex/event/token_count` -- usage stats
- `codex/event/task_complete` -- turn finished

## Sources

- [openai/codex - app-server-protocol](https://github.com/openai/codex/tree/main/codex-rs/app-server-protocol/src/protocol)
- [openai/codex - jsonrpc_lite.rs](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/src/jsonrpc_lite.rs)
- [openai/codex - protocol.rs](https://github.com/openai/codex/blob/main/codex-rs/protocol/src/protocol.rs)
- [openai/codex - exec_events.rs](https://github.com/openai/codex/blob/main/codex-rs/exec/src/exec_events.rs)
- [openai/codex - codex-api/src/common.rs](https://github.com/openai/codex/blob/main/codex-rs/codex-api/src/common.rs)
- [openai/codex - sse/responses.rs](https://github.com/openai/codex/blob/main/codex-rs/codex-api/src/sse/responses.rs)
- [openai/codex - transport/stdio.rs](https://github.com/openai/codex/blob/main/codex-rs/app-server/src/transport/stdio.rs)
- [zafnz/cc-insights](https://github.com/zafnz/cc-insights) -- VS Code extension wire protocol captures
- [zafnz/cc-insights Codex mapping docs](https://github.com/zafnz/cc-insights/blob/main/docs/insights-protocol/04-codex-mapping.md)
