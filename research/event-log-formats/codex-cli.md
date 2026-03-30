# Codex CLI Session Log Format

## Overview

- **Agent:** Codex CLI (OpenAI)
- **Location:** `~/.codex/sessions/YYYY/MM/DD/rollout-YYYY-MM-DDThh-mm-ss-<uuid>.jsonl`
- **Format:** JSONL (JSON Lines), one event per line, append-only
- **Structure:** Each line is a `RolloutLine` with `timestamp` + tagged `RolloutItem`

## Storage

Session logs ("rollouts") are stored under `~/.codex/` (overridable via `CODEX_HOME` env var). Files are date-partitioned:

```
~/.codex/sessions/YYYY/MM/DD/rollout-YYYY-MM-DDThh-mm-ss-<uuid>.jsonl
```

Archived sessions go to `~/.codex/archived_sessions/` with the same layout.

Additionally, Codex maintains two SQLite databases in `~/.codex/`:
- `state_<version>.sqlite` -- thread metadata and memories (not conversation content)
- `logs_<version>.sqlite` -- tracing/debug logs (not conversation content)

## Line Format

Each JSONL line is a `RolloutLine`:

```json
{"timestamp":"2025-01-03T00:00:00.000Z","type":"<variant>","payload":{...}}
```

The `type` field is one of five variants:

| Type | Description |
|------|-------------|
| `session_meta` | Session-level metadata (first line) |
| `response_item` | Model input/output items (messages, tool calls, reasoning) |
| `turn_context` | Model-visible context at start of each turn |
| `event_msg` | Lifecycle and streaming events |
| `compacted` | Conversation compaction markers |

## Type Definitions (from source)

Source: [`codex-rs/protocol/src/protocol.rs`](https://github.com/openai/codex/blob/main/codex-rs/protocol/src/protocol.rs)

### RolloutLine / RolloutItem

```rust
pub struct RolloutLine {
    pub timestamp: String,
    #[serde(flatten)]
    pub item: RolloutItem,
}

#[serde(tag = "type", content = "payload", rename_all = "snake_case")]
pub enum RolloutItem {
    SessionMeta(SessionMetaLine),
    ResponseItem(ResponseItem),
    Compacted(CompactedItem),
    TurnContext(TurnContextItem),
    EventMsg(EventMsg),
}
```

### SessionMeta

```rust
pub struct SessionMeta {
    pub id: ThreadId,
    pub forked_from_id: Option<ThreadId>,
    pub timestamp: String,
    pub cwd: PathBuf,
    pub originator: String,
    pub cli_version: String,
    pub source: SessionSource,
    pub agent_nickname: Option<String>,
    pub agent_role: Option<String>,
    pub agent_path: Option<String>,
    pub model_provider: Option<String>,
    pub base_instructions: Option<BaseInstructions>,
    pub dynamic_tools: Option<Vec<DynamicToolSpec>>,
    pub memory_mode: Option<String>,
}

pub struct SessionMetaLine {
    #[serde(flatten)]
    pub meta: SessionMeta,
    pub git: Option<GitInfo>,
}

pub struct GitInfo {
    pub commit_hash: Option<GitSha>,
    pub branch: Option<String>,
    pub repository_url: Option<String>,
}

pub enum SessionSource {
    Cli,
    VSCode,
    Exec,
    Mcp,
    Custom(String),
    SubAgent(SubAgentSource),
    Unknown,
}
```

### ResponseItem

Source: [`codex-rs/protocol/src/models.rs`](https://github.com/openai/codex/blob/main/codex-rs/protocol/src/models.rs)

```rust
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ResponseItem {
    Message {
        id: Option<String>,
        role: String,               // "user", "assistant", "developer"
        content: Vec<ContentItem>,
        end_turn: Option<bool>,
        phase: Option<MessagePhase>,
    },
    Reasoning {
        id: String,
        summary: Vec<ReasoningItemReasoningSummary>,
        content: Option<Vec<ReasoningItemContent>>,
        encrypted_content: Option<String>,
    },
    LocalShellCall {
        id: Option<String>,
        call_id: Option<String>,
        status: LocalShellStatus,    // completed, in_progress, incomplete
        action: LocalShellAction,
    },
    FunctionCall {
        id: Option<String>,
        name: String,
        namespace: Option<String>,
        arguments: String,           // JSON string
        call_id: String,
    },
    FunctionCallOutput {
        call_id: String,
        output: FunctionCallOutputPayload,
    },
    CustomToolCall {
        id: Option<String>,
        status: Option<String>,
        call_id: String,
        name: String,
        input: String,
    },
    CustomToolCallOutput {
        call_id: String,
        name: Option<String>,
        output: FunctionCallOutputPayload,
    },
    ToolSearchCall { ... },
    ToolSearchOutput { ... },
    WebSearchCall { ... },
    ImageGenerationCall { ... },
    GhostSnapshot { ... },
    Compaction { encrypted_content: String },
    Other,
}

#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentItem {
    InputText { text: String },
    InputImage { image_url: String },
    OutputText { text: String },
}

pub enum MessagePhase {
    Commentary,
    FinalAnswer,
}

pub struct LocalShellExecAction {
    pub command: Vec<String>,
    pub timeout_ms: Option<u64>,
    pub working_directory: Option<String>,
    pub env: Option<HashMap<String, String>>,
    pub user: Option<String>,
}
```

### TurnContext

```rust
pub struct TurnContextItem {
    pub turn_id: Option<String>,
    pub trace_id: Option<String>,
    pub cwd: PathBuf,
    pub current_date: Option<String>,
    pub timezone: Option<String>,
    pub approval_policy: AskForApproval,
    pub sandbox_policy: SandboxPolicy,
    pub network: Option<TurnContextNetworkItem>,
    pub model: String,
    pub personality: Option<Personality>,
    pub collaboration_mode: Option<CollaborationMode>,
    pub effort: Option<ReasoningEffortConfig>,
    pub summary: ReasoningSummaryConfig,
    pub user_instructions: Option<String>,
    pub developer_instructions: Option<String>,
    pub truncation_policy: Option<TruncationPolicy>,
}
```

### EventMsg

All possible `event_msg` types (serialized as `#[serde(tag = "type", rename_all = "snake_case")]`):

```
error, warning, realtime_conversation_started, realtime_conversation_realtime,
realtime_conversation_closed, model_reroute, context_compacted, thread_rolled_back,
task_started (alias: turn_started), task_complete (alias: turn_complete), token_count,
agent_message, user_message, agent_message_delta, agent_reasoning, agent_reasoning_delta,
agent_reasoning_raw_content, agent_reasoning_raw_content_delta,
agent_reasoning_section_break, session_configured, thread_name_updated,
mcp_startup_update, mcp_startup_complete, mcp_tool_call_begin, mcp_tool_call_end,
web_search_begin, web_search_end, image_generation_begin, image_generation_end,
exec_command_begin, exec_command_output_delta, terminal_interaction, exec_command_end,
view_image_tool_call, exec_approval_request, request_permissions, request_user_input,
dynamic_tool_call_request, dynamic_tool_call_response, elicitation_request,
apply_patch_approval_request, guardian_assessment, deprecation_notice, background_event,
undo_started, undo_completed, stream_error, patch_apply_begin, patch_apply_end,
turn_diff, get_history_entry_response, mcp_list_tools_response, list_skills_response,
skills_update_available, plan_update, turn_aborted, shutdown_complete,
entered_review_mode, exited_review_mode, raw_response_item, item_started,
item_completed, hook_started, hook_completed, agent_message_content_delta,
plan_delta, reasoning_content_delta, reasoning_raw_content_delta,
collab_agent_spawn_begin, collab_agent_spawn_end, collab_agent_interaction_begin,
collab_agent_interaction_end, collab_waiting_begin, collab_waiting_end,
collab_close_begin, collab_close_end, collab_resume_begin, collab_resume_end
```

Key event payload structs:

```rust
pub struct UserMessageEvent {
    pub message: String,
    pub images: Option<Vec<String>>,
    pub local_images: Vec<PathBuf>,
    pub text_elements: Vec<TextElement>,
}

pub struct AgentMessageEvent {
    pub message: String,
    pub phase: Option<MessagePhase>,
    pub memory_citation: Option<MemoryCitation>,
}

pub struct ExecCommandEndEvent {
    pub call_id: String,
    pub process_id: Option<String>,
    pub turn_id: String,
    pub command: Vec<String>,
    pub cwd: PathBuf,
    pub stdout: String,
    pub stderr: String,
    pub aggregated_output: String,   // truncated to 10KB
    pub exit_code: i32,
    pub duration: Duration,
    pub formatted_output: String,
    pub status: ExecCommandStatus,
}

pub struct TokenCountEvent {
    pub info: Option<TokenUsageInfo>,
    pub rate_limits: Option<RateLimitSnapshot>,
}

pub struct TurnStartedEvent {
    pub turn_id: String,
}

pub struct TurnCompleteEvent {
    pub turn_id: String,
    pub last_agent_message: Option<String>,
}
```

### CompactedItem

```rust
pub struct CompactedItem {
    pub message: String,
    pub replacement_history: Option<Vec<ResponseItem>>,
}
```

## Persistence Policy

Source: [`codex-rs/rollout/src/policy.rs`](https://github.com/openai/codex/blob/main/codex-rs/rollout/src/policy.rs)

Not all events are written to disk. In **Limited** mode (default):
- `SessionMeta`, `TurnContext`, `Compacted` -- always persisted
- `ResponseItem` -- all variants except `Other`
- `EventMsg` -- only: `UserMessage`, `AgentMessage`, `AgentReasoning`, `AgentReasoningRawContent`, `TokenCount`, `ContextCompacted`, `EnteredReviewMode`, `ExitedReviewMode`, `ThreadRolledBack`, `UndoCompleted`, `TurnAborted`, `TurnStarted`, `TurnComplete`, `ImageGenerationEnd`, `ItemCompleted` (Plan items only)

In **Extended** mode, additionally: `Error`, `GuardianAssessment`, `WebSearchEnd`, `ExecCommandEnd`, `PatchApplyEnd`, `McpToolCallEnd`, `ViewImageToolCall`, `CollabAgent*End`, `DynamicToolCall*`

## Serialization

Source: [`codex-rs/rollout/src/recorder.rs`](https://github.com/openai/codex/blob/main/codex-rs/rollout/src/recorder.rs)

```rust
// Each line serialized as:
struct RolloutLineRef<'a> {
    timestamp: String,        // "YYYY-MM-DDThh:mm:ss.mmmZ"
    #[serde(flatten)]
    item: &'a RolloutItem,    // flattened to "type" + "payload"
}
// Written via serde_json::to_string + "\n", then flushed
```

## Sources

- [openai/codex - protocol.rs](https://github.com/openai/codex/blob/main/codex-rs/protocol/src/protocol.rs)
- [openai/codex - models.rs](https://github.com/openai/codex/blob/main/codex-rs/protocol/src/models.rs)
- [openai/codex - recorder.rs](https://github.com/openai/codex/blob/main/codex-rs/rollout/src/recorder.rs)
- [openai/codex - policy.rs](https://github.com/openai/codex/blob/main/codex-rs/rollout/src/policy.rs)
- [openai/codex - recorder_tests.rs](https://github.com/openai/codex/blob/main/codex-rs/rollout/src/recorder_tests.rs)
- [openai/codex - app-server test helpers](https://github.com/openai/codex/blob/main/codex-rs/app-server/tests/common/rollout.rs)
- [Discussion #3827: Session/Rollout Files](https://github.com/openai/codex/discussions/3827)
- [PR #3380: Introduce rollout items](https://github.com/openai/codex/pull/3380)
- [zafnz/cc-insights example logs](https://github.com/zafnz/cc-insights/tree/main/examples/raw)

---

## Examples

### Example 1: Test fixture -- minimal rollout (from recorder_tests.rs)

Source: [openai/codex recorder_tests.rs](https://github.com/openai/codex/blob/main/codex-rs/rollout/src/recorder_tests.rs)

```jsonl
{"timestamp":"2025-01-03T00-00-00","type":"session_meta","payload":{"id":"<uuid>","timestamp":"2025-01-03T00-00-00","cwd":".","originator":"test_originator","cli_version":"test_version","source":"cli","model_provider":"test-provider"}}
{"timestamp":"2025-01-03T00-00-00","type":"event_msg","payload":{"type":"user_message","message":"Hello from user","kind":"plain"}}
```

### Example 2: Test fixture -- 3-line rollout (from app-server tests)

Source: [openai/codex app-server/tests/common/rollout.rs](https://github.com/openai/codex/blob/main/codex-rs/app-server/tests/common/rollout.rs)

```jsonl
{"timestamp":"<rfc3339>","type":"session_meta","payload":{"id":"<uuid>","forked_from_id":null,"timestamp":"<rfc3339>","cwd":"/","originator":"codex","cli_version":"0.0.0","source":"cli","agent_path":null,"agent_nickname":null,"agent_role":null,"model_provider":"openai","base_instructions":null,"dynamic_tools":null,"memory_mode":null,"git":{"commit_hash":"abc123","branch":"main","repository_url":"https://github.com/..."}}}
{"timestamp":"<rfc3339>","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"<user prompt>"}]}}
{"timestamp":"<rfc3339>","type":"event_msg","payload":{"type":"user_message","message":"<user prompt>","kind":"plain"}}
```

### Example 3: VS Code extension wire protocol (cc-insights)

Source: [zafnz/cc-insights](https://github.com/zafnz/cc-insights/blob/main/examples/raw/codex-basic-conversation.jsonl)

Note: This is the JSON-RPC debug log format between VS Code and the Codex app server, **not** the native rollout format. Included for reference as it shows the event taxonomy.

```json
{"timestamp":"2026-02-09T17:53:53.457034","level":"debug","direction":"stdin","content":{"jsonrpc":"2.0","id":6,"method":"model/list","params":{}}}
{"timestamp":"2026-02-09T17:53:53.459959","level":"debug","direction":"stdin","content":{"jsonrpc":"2.0","id":7,"method":"thread/start","params":{"cwd":"/Users/zaf/projects/pelagia"}}}
{"timestamp":"2026-02-09T17:53:54.129817","level":"debug","direction":"stdout","content":{"id":7,"result":{"thread":{"id":"c7e5f636-0000-0000-0000-000000000001","preview":"","modelProvider":"openai","createdAt":1770612834,"updatedAt":1770612834,"path":"/Users/zaf/.codex/sessions/2026/02/09/rollout-2026-02-09T17-53-54-c7e5f636-0000-0000-0000-000000000001.jsonl","cwd":"/Users/zaf/projects/pelagia","cliVersion":"0.95.0","source":"vscode","gitInfo":{"sha":"e2fd3be481bc14ac43550021d3d5e53f9b89a5df","branch":"main","originUrl":"https://github.com/zafnz/pelagia.git"},"turns":[]},"model":"gpt-5.2-codex","modelProvider":"openai","cwd":"/Users/zaf/projects/pelagia","approvalPolicy":"on-request","sandbox":{"type":"workspaceWrite","writableRoots":[],"networkAccess":false,"excludeTmpdirEnvVar":false,"excludeSlashTmp":false},"reasoningEffort":"high"}}}
```

Event types visible in the wire protocol:
- `codex/event/task_started` -- turn begins
- `codex/event/user_message` -- user input
- `codex/event/agent_message` -- agent response
- `codex/event/agent_message_content_delta` -- streaming text delta
- `codex/event/token_count` -- usage stats
- `codex/event/task_complete` -- turn finished
- `codex/event/exec_command_begin` / `exec_command_end` -- shell tool use
- `codex/event/patch_apply_begin` -- file edit
- `codex/event/apply_patch_approval_request` -- approval request
- `codex/event/agent_reasoning` -- reasoning summary
- `codex/event/item_started` / `item_completed` -- item lifecycle
