# Gemini CLI Streaming Protocol

## Overview

- **Agent:** Gemini CLI (Google)
- **Interfaces:** Interactive terminal (React/Ink), non-interactive CLI, ACP/A2A server
- **Transport:** HTTP streaming (chunked `GenerateContentResponse` from Gemini API), NDJSON over stdio (ACP)
- **Architecture:** Three-layer event translation pipeline

## Architecture

```
Gemini API (HTTP streaming / chunked GenerateContentResponse)
  |
  v
ContentGenerator.generateContentStream()
  -> AsyncGenerator<GenerateContentResponse>
  |
  v
GeminiChat.sendMessageStream()
  -> AsyncGenerator<StreamEvent>              [Layer 1: transport]
  [handles retries, history, stream validation]
  |
  v
Turn.run()
  -> AsyncGenerator<ServerGeminiStreamEvent>  [Layer 2: domain]
  [parses chunks into Content/Thought/ToolCall/Finished events]
  |
  +---> Interactive CLI: useGeminiStream hook (React/Ink)
  |       [renders to terminal]
  |
  +---> Non-interactive CLI: runNonInteractive()
  |       [writes to stdout as text, JSON, or streaming JSONL]
  |
  +---> event-translator.ts: translateEvent()
          -> AgentEvent[]                     [Layer 3: protocol]
          |
          +---> AgentSession.sendStream()
          |       -> AsyncIterable<AgentEvent>
          |
          +---> ACP server: connection.sessionUpdate()
                  [NDJSON over stdin/stdout]
```

## Layer 1: StreamEvent (API Transport)

Source: [`packages/core/src/core/geminiChat.ts`](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/core/geminiChat.ts)

```typescript
export enum StreamEventType {
  CHUNK = 'chunk',
  RETRY = 'retry',
  AGENT_EXECUTION_STOPPED = 'agent_execution_stopped',
  AGENT_EXECUTION_BLOCKED = 'agent_execution_blocked',
}

export type StreamEvent =
  | { type: StreamEventType.CHUNK; value: GenerateContentResponse }
  | { type: StreamEventType.RETRY }
  | { type: StreamEventType.AGENT_EXECUTION_STOPPED; reason: string }
  | { type: StreamEventType.AGENT_EXECUTION_BLOCKED; reason: string };
```

`GeminiChat.sendMessageStream()` yields `StreamEvent` objects. It handles:
- Mid-stream retries (up to 4 attempts with exponential backoff)
- Invalid stream detection (no finish reason, malformed function calls, empty responses)
- History management (accumulates parts, consolidates text)

The `GenerateContentResponse` from the `@google/genai` SDK contains:
```typescript
{
  candidates: [{
    content: { parts: Part[], role: string },
    finishReason?: string,
    citationMetadata?: { citations: Citation[] }
  }],
  usageMetadata?: {
    promptTokenCount: number,
    candidatesTokenCount: number,
    cachedContentTokenCount: number,
    thoughtsTokenCount?: number,
    toolUsePromptTokenCount?: number,
    totalTokenCount: number
  }
}
```

## Layer 2: ServerGeminiStreamEvent (Domain Events)

Source: [`packages/core/src/core/turn.ts`](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/core/turn.ts)

```typescript
export enum GeminiEventType {
  Content = 'content',
  ToolCallRequest = 'tool_call_request',
  ToolCallResponse = 'tool_call_response',
  ToolCallConfirmation = 'tool_call_confirmation',
  UserCancelled = 'user_cancelled',
  Error = 'error',
  ChatCompressed = 'chat_compressed',
  Thought = 'thought',
  MaxSessionTurns = 'max_session_turns',
  Finished = 'finished',
  LoopDetected = 'loop_detected',
  Citation = 'citation',
  Retry = 'retry',
  ContextWindowWillOverflow = 'context_window_will_overflow',
  InvalidStream = 'invalid_stream',
  ModelInfo = 'model_info',
  AgentExecutionStopped = 'agent_execution_stopped',
  AgentExecutionBlocked = 'agent_execution_blocked',
}
```

`Turn.run()` is an `AsyncGenerator<ServerGeminiStreamEvent>` that:
1. Calls `chat.sendMessageStream()` to get `StreamEvent`s
2. Parses each `GenerateContentResponse` chunk into domain events
3. Yields them one at a time

### How the interactive CLI consumes events

Source: [`packages/cli/src/ui/hooks/useGeminiStream.ts`](https://github.com/google-gemini/gemini-cli/blob/main/packages/cli/src/ui/hooks/useGeminiStream.ts)

```typescript
const processGeminiStreamEvents = useCallback(
  async (stream: AsyncIterable<GeminiEvent>, ...) => {
    for await (const event of stream) {
      switch (event.type) {
        case ServerGeminiEventType.Thought:           // update thinking indicator
        case ServerGeminiEventType.Content:           // append to message buffer
        case ServerGeminiEventType.ToolCallRequest:   // collect tool calls
        case ServerGeminiEventType.Finished:          // handle usage metadata
        case ServerGeminiEventType.Citation:          // display citations
        case ServerGeminiEventType.ModelInfo:         // model switch notification
        // ... exhaustive switch
      }
    }
  }
);
```

## Layer 3: AgentEvent (Protocol Events)

Source: [`packages/core/src/agent/types.ts`](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/agent/types.ts)

The public, framework-agnostic event protocol. Discriminated union on `type`.

```typescript
export interface AgentEvents {
  initialize: Initialize;
  session_update: SessionUpdate;
  message: Message;
  agent_start: AgentStart;
  agent_end: AgentEnd;
  tool_request: ToolRequest;
  tool_update: ToolUpdate;
  tool_response: ToolResponse;
  elicitation_request: ElicitationRequest;
  elicitation_response: ElicitationResponse;
  usage: Usage;
  error: ErrorData;
  custom: CustomEvent;
}
```

Common fields on all events:
```typescript
interface AgentEventCommon {
  id: string;
  threadId?: string;   // Subagent thread
  streamId: string;    // Activity stream
  timestamp: string;   // ISO 8601
  type: string;
  _meta?: { source?: string; [key: string]: unknown };
}
```

### Event Type Details

#### `initialize`
```typescript
interface Initialize {
  sessionId: string;
  workspace?: string;
  agentId?: string;
}
```

#### `session_update`
Title, model, or config changes.

#### `message`
```typescript
interface Message {
  role: 'user' | 'agent' | 'developer';
  content: ContentPart[];
}

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'thought'; text: string; subject?: string }
  | { type: 'media'; mimeType: string; data: string }
  | { type: 'reference'; uri: string; title?: string };
```

#### `agent_start` / `agent_end`
Bracket a stream of agent activity.
```typescript
interface AgentEnd {
  reason: StreamEndReason;
  message?: string;
}

type StreamEndReason =
  | 'completed' | 'failed' | 'aborted'
  | 'max_turns' | 'max_budget' | 'max_time' | 'refusal';
```

#### `tool_request` / `tool_update` / `tool_response`
```typescript
interface ToolRequest {
  requestId: string;
  name: string;
  parameters?: Record<string, unknown>;
}

interface ToolUpdate {
  requestId: string;
  content?: ContentPart[];
}

interface ToolResponse {
  requestId: string;
  content?: ContentPart[];
  isError?: boolean;
}
```

#### `usage`
```typescript
interface Usage {
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  cost?: number;
}
```

#### `error`
```typescript
interface ErrorData {
  code: number;      // gRPC-style status code
  message: string;
  data?: unknown;
}
```

### Event Translation

Source: [`packages/core/src/agent/event-translator.ts`](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/agent/event-translator.ts)

```typescript
export function translateEvent(
  event: ServerGeminiStreamEvent,
  state: TranslationState,
): AgentEvent[] {
  // GeminiEventType.Content    -> AgentEvent type:'message' role:'agent'
  // GeminiEventType.Thought    -> AgentEvent type:'message' with thought ContentPart
  // GeminiEventType.ToolCallRequest -> AgentEvent type:'tool_request'
  // GeminiEventType.Finished   -> AgentEvent type:'usage'
  // GeminiEventType.Error      -> AgentEvent type:'error'
}
```

## Non-Interactive Output Formats

Source: [`packages/core/src/output/types.ts`](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/output/types.ts)

```typescript
export enum OutputFormat {
  TEXT = 'text',              // Plain text to stdout
  JSON = 'json',              // Single JSON object at end
  STREAM_JSON = 'stream-json', // JSONL streaming
}
```

### `--output-format json` (batch)

Returns a single JSON object at completion:
```typescript
export interface JsonOutput {
  session_id?: string;
  response?: string;
  stats?: SessionMetrics;
  error?: JsonError;
}
```

### `--output-format stream-json` (streaming JSONL)

Source: [`packages/core/src/output/stream-json-formatter.ts`](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/output/stream-json-formatter.ts)

```typescript
export enum JsonStreamEventType {
  INIT = 'init',
  MESSAGE = 'message',
  TOOL_USE = 'tool_use',
  TOOL_RESULT = 'tool_result',
  ERROR = 'error',
  RESULT = 'result',
}
```

Each event is emitted as a single line of JSON to stdout:

```typescript
export class StreamJsonFormatter {
  emitEvent(event: JsonStreamEvent): void {
    process.stdout.write(JSON.stringify(event) + '\n');
  }
}
```

Event shapes:

#### `init`
```json
{"type": "init", "session_id": "...", "model": "gemini-2.5-pro", "timestamp": "..."}
```

#### `message`
```json
{"type": "message", "role": "user" | "assistant", "content": "...", "delta": true, "timestamp": "..."}
```
When `delta: true`, the `content` field is an incremental text chunk (not the full message).

#### `tool_use`
```json
{"type": "tool_use", "tool_name": "read_file", "tool_id": "...", "parameters": {...}, "timestamp": "..."}
```

#### `tool_result`
```json
{"type": "tool_result", "tool_id": "...", "status": "success" | "error", "output": "...", "error": "...", "timestamp": "..."}
```

#### `result`
```json
{
  "type": "result",
  "status": "success" | "error",
  "stats": {
    "total_tokens": 12345,
    "input_tokens": 10000,
    "output_tokens": 2345,
    "duration_ms": 5000,
    "tool_calls": 3,
    "models": {"gemini-2.5-pro": {"input_tokens": 10000, "output_tokens": 2345}}
  },
  "timestamp": "..."
}
```

## ACP (Agent Client Protocol)

Source: [`packages/cli/src/acp/acpClient.ts`](https://github.com/google-gemini/gemini-cli/blob/main/packages/cli/src/acp/acpClient.ts)

Transport: NDJSON over stdin/stdout using `@agentclientprotocol/sdk`:

```typescript
const stream = acp.ndJsonStream(stdout, stdin);
const connection = new acp.AgentSideConnection(
  (connection) => new GeminiAgent(config, settings, argv, connection),
  stream,
);
```

Session streaming updates via `connection.sessionUpdate()`:

| Update Type | Description |
|---|---|
| `agent_message_chunk` | Incremental model text (`ContentBlock` with `type: 'text'`) |
| `agent_thought_chunk` | Model thinking |
| `tool_call` | Tool invocation with status, title, content |
| `tool_call_update` | Intermediate tool progress |
| `user_message_chunk` | Replayed user messages |
| `available_commands_update` | Slash commands |

The ACP `prompt()` method streams in real-time:

```typescript
for await (const resp of responseStream) {
  if (resp.type === StreamEventType.CHUNK && resp.value.candidates?.length > 0) {
    for (const part of candidate.content?.parts ?? []) {
      this.sendUpdate({
        sessionUpdate: part.thought ? 'agent_thought_chunk' : 'agent_message_chunk',
        content: { type: 'text', text: part.text },
      });
    }
  }
}
```

## Gemini API Wire Format

The `@google/genai` SDK calls `generativelanguage.googleapis.com` with `generateContentStream()`, which returns chunked HTTP responses. Each chunk is a `GenerateContentResponse`:

```typescript
interface GenerateContentResponse {
  candidates: [{
    content: {
      parts: Part[],         // text, functionCall, functionResponse, thought
      role: string
    },
    finishReason?: string,   // "STOP", "MAX_TOKENS", "SAFETY", etc.
    citationMetadata?: { citations: Citation[] }
  }],
  usageMetadata?: {
    promptTokenCount: number,
    candidatesTokenCount: number,
    cachedContentTokenCount: number,
    thoughtsTokenCount?: number,
    toolUsePromptTokenCount?: number,
    totalTokenCount: number
  }
}
```

Part types relevant to streaming:
- `{ text: string }` -- text content
- `{ thought: true, text: string }` -- thinking content
- `{ functionCall: { name: string, args: Record<string, unknown> } }` -- tool call
- `{ codeExecution: { code: string } }` -- code execution

## Sources

- [google-gemini/gemini-cli - agent/types.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/agent/types.ts)
- [google-gemini/gemini-cli - agent/event-translator.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/agent/event-translator.ts)
- [google-gemini/gemini-cli - core/turn.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/core/turn.ts)
- [google-gemini/gemini-cli - core/geminiChat.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/core/geminiChat.ts)
- [google-gemini/gemini-cli - core/contentGenerator.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/core/contentGenerator.ts)
- [google-gemini/gemini-cli - output/types.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/output/types.ts)
- [google-gemini/gemini-cli - output/stream-json-formatter.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/output/stream-json-formatter.ts)
- [google-gemini/gemini-cli - cli/src/ui/hooks/useGeminiStream.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/cli/src/ui/hooks/useGeminiStream.ts)
- [google-gemini/gemini-cli - cli/src/nonInteractiveCli.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/cli/src/nonInteractiveCli.ts)
- [google-gemini/gemini-cli - cli/src/acp/acpClient.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/cli/src/acp/acpClient.ts)
- [google-gemini/gemini-cli - agent/agent-session.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/agent/agent-session.ts)
