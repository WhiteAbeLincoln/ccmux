# Claude Code Streaming Protocol

## Overview

- **Agent:** Claude Code (Anthropic)
- **Interfaces:** CLI (`claude -p --output-format stream-json`) and SDK (`@anthropic-ai/claude-agent-sdk`)
- **Transport:** Newline-delimited JSON (NDJSON) on stdout (CLI) or async generator (SDK)
- **Streaming opt-in:** Requires `--verbose` for event output; `--include-partial-messages` for token-level deltas

## CLI: `--output-format stream-json`

When invoked as `claude -p --output-format stream-json --verbose`, each line of stdout is a JSON object. The top-level `type` field discriminates event types.

### Event Types

| Type | Description |
|------|-------------|
| `system` | Lifecycle events (init, hooks, api_retry, compact_boundary) |
| `assistant` | Complete assistant message (after all streaming finishes) |
| `user` | Tool result or user message |
| `stream_event` | Raw Anthropic API streaming delta (only with `--include-partial-messages`) |
| `rate_limit_event` | Rate limit status |
| `result` | Final result at end of execution |

### Event Sequence

Without `--include-partial-messages`:
```
system/init
assistant          (complete message)
user               (tool result, if tool was used)
rate_limit_event
assistant          (next turn)
...
result/success
```

With `--include-partial-messages`:
```
system/init
stream_event (message_start)
stream_event (content_block_start)
stream_event (content_block_delta)    -- repeated, token-level text chunks
stream_event (content_block_stop)
stream_event (content_block_start)    -- next content block (e.g., tool_use)
stream_event (content_block_delta)    -- tool input JSON chunks
stream_event (content_block_stop)
stream_event (message_delta)          -- stop_reason, usage
stream_event (message_stop)
assistant                             -- complete message follows stream events
user                                  -- tool result
rate_limit_event
...
result/success
```

### Event Schemas

#### `system/init`

Emitted once at the start of execution.

```json
{
  "type": "system",
  "subtype": "init",
  "cwd": "/Users/abe/Projects/ccmux",
  "session_id": "...",
  "tools": ["Task", "Bash", "Edit", "Glob", "Grep", "Read", "Write"],
  "mcp_servers": [{"name": "...", "status": "..."}],
  "model": "claude-opus-4-6",
  "permissionMode": "default",
  "slash_commands": [],
  "apiKeySource": "none",
  "claude_code_version": "2.1.87",
  "output_style": "default",
  "agents": [],
  "skills": [],
  "plugins": [{"name": "...", "path": "...", "source": "..."}],
  "uuid": "...",
  "fast_mode_state": "off"
}
```

#### `system/api_retry`

Source: [Claude Code headless docs](https://code.claude.com/docs/en/headless)

| Field | Type | Description |
|---|---|---|
| `type` | `"system"` | |
| `subtype` | `"api_retry"` | |
| `attempt` | integer | Current attempt number, starting at 1 |
| `max_retries` | integer | Total retries permitted |
| `retry_delay_ms` | integer | Milliseconds until next attempt |
| `error_status` | integer or null | HTTP status code, or null for connection errors |
| `error` | string | `authentication_failed`, `billing_error`, `rate_limit`, `invalid_request`, `server_error`, `max_output_tokens`, or `unknown` |

#### `system/hook_started` / `system/hook_response`

Emitted when hooks execute before/after tool use.

#### `system/compact_boundary`

Emitted when conversation is compacted.

```json
{
  "type": "system",
  "subtype": "compact_boundary",
  "compact_metadata": { "trigger": "manual" | "auto", "pre_tokens": 12345 },
  "uuid": "...",
  "session_id": "..."
}
```

#### `assistant` (complete message)

Emitted after all streaming for a turn completes. Contains the full assembled message.

```json
{
  "type": "assistant",
  "message": {
    "model": "claude-opus-4-6",
    "id": "msg_...",
    "type": "message",
    "role": "assistant",
    "content": [
      {"type": "thinking", "thinking": "...", "signature": "..."},
      {"type": "text", "text": "..."},
      {"type": "tool_use", "id": "toolu_...", "name": "Read", "input": {"file_path": "..."}, "caller": {"type": "direct"}}
    ],
    "stop_reason": null | "end_turn" | "tool_use" | "stop_sequence",
    "stop_sequence": null | "...",
    "usage": {
      "input_tokens": 3,
      "cache_creation_input_tokens": 8163,
      "cache_read_input_tokens": 11552,
      "output_tokens": 40,
      "service_tier": "standard",
      "cache_creation": {"ephemeral_1h_input_tokens": 8163, "ephemeral_5m_input_tokens": 0}
    }
  },
  "parent_tool_use_id": null | "toolu_...",
  "session_id": "...",
  "uuid": "..."
}
```

#### `user` (tool result)

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [{"tool_use_id": "toolu_...", "type": "tool_result", "content": "..."}]
  },
  "parent_tool_use_id": null,
  "session_id": "...",
  "uuid": "...",
  "timestamp": "2026-03-30T05:01:11.211Z",
  "tool_use_result": {
    "type": "text",
    "file": {"filePath": "...", "content": "...", "numLines": 13, "startLine": 1, "totalLines": 13}
  }
}
```

#### `stream_event` (partial messages)

Wraps raw Anthropic Messages API streaming events. Only emitted with `--include-partial-messages`.

```json
{
  "type": "stream_event",
  "event": {
    "type": "content_block_delta",
    "index": 0,
    "delta": {"type": "text_delta", "text": "Hi"}
  },
  "session_id": "...",
  "parent_tool_use_id": null,
  "uuid": "..."
}
```

Inner `event.type` values (standard Anthropic Messages API streaming events):

| Event Type | Description |
|---|---|
| `message_start` | Start of a new message, contains full `message` object (without content) |
| `content_block_start` | Start of a content block, contains `index` and `content_block` stub |
| `content_block_delta` | Incremental content update, contains `index` and `delta` |
| `content_block_stop` | End of a content block |
| `message_delta` | Message-level updates (`stop_reason`, `usage`) |
| `message_stop` | End of the message |

Delta types within `content_block_delta`:
- `{"type": "text_delta", "text": "..."}` -- text chunk
- `{"type": "input_json_delta", "partial_json": "..."}` -- tool input JSON chunk
- `{"type": "thinking_delta", "thinking": "..."}` -- thinking text chunk

#### `rate_limit_event`

```json
{
  "type": "rate_limit_event",
  "rate_limit_info": {
    "status": "allowed",
    "resetsAt": 1774857600,
    "rateLimitType": "five_hour",
    "overageStatus": "rejected",
    "overageDisabledReason": "org_level_disabled",
    "isUsingOverage": false
  },
  "uuid": "...",
  "session_id": "..."
}
```

#### `result`

Emitted once at the end of execution.

```json
{
  "type": "result",
  "subtype": "success",
  "is_error": false,
  "duration_ms": 3114,
  "duration_api_ms": 3107,
  "num_turns": 1,
  "result": "Hello there, friend!",
  "stop_reason": "end_turn",
  "session_id": "...",
  "total_cost_usd": 0.05700975,
  "usage": {
    "input_tokens": 3,
    "cache_creation_input_tokens": 8163,
    "cache_read_input_tokens": 11552,
    "output_tokens": 8,
    "server_tool_use": {"web_search_requests": 0, "web_fetch_requests": 0},
    "service_tier": "standard",
    "cache_creation": {"ephemeral_1h_input_tokens": 8163, "ephemeral_5m_input_tokens": 0}
  },
  "modelUsage": {
    "claude-opus-4-6": {
      "inputTokens": 3,
      "outputTokens": 8,
      "cacheReadInputTokens": 11552,
      "cacheCreationInputTokens": 8163,
      "webSearchRequests": 0,
      "costUSD": 0.05700975,
      "contextWindow": 200000,
      "maxOutputTokens": 64000
    }
  },
  "permission_denials": [],
  "fast_mode_state": "off",
  "uuid": "..."
}
```

Error subtypes: `"error_max_turns"`, `"error_during_execution"`, `"error_max_budget_usd"`, `"error_max_structured_output_retries"`.

## SDK: `@anthropic-ai/claude-agent-sdk`

Source: [Claude Agent SDK docs](https://platform.claude.com/docs/en/agent-sdk/streaming-output)

The SDK (recently renamed from `@anthropic-ai/claude-code`) exposes a `query()` function returning an `AsyncGenerator<SDKMessage>`.

### TypeScript

```typescript
import { query, SDKMessage } from "@anthropic-ai/claude-agent-sdk";

const stream: AsyncGenerator<SDKMessage> = query({
  prompt: "Hello",
  options: { includePartialMessages: true }
});

for await (const message of stream) {
  // handle message by type
}
```

### Python

```python
from claude_agent_sdk import query, ClaudeAgentOptions
from claude_agent_sdk.types import StreamEvent

async for message in query(
    prompt="...",
    options=ClaudeAgentOptions(include_partial_messages=True)
):
    if isinstance(message, StreamEvent):
        event = message.event
        if event.get("type") == "content_block_delta":
            delta = event.get("delta", {})
            if delta.get("type") == "text_delta":
                print(delta.get("text", ""), end="", flush=True)
```

### SDKMessage Union

```typescript
type SDKMessage =
  | SDKAssistantMessage          // Complete assistant message
  | SDKUserMessage               // User message
  | SDKUserMessageReplay         // Replayed user message
  | SDKResultMessage             // Final result
  | SDKSystemMessage             // System events (init, compact_boundary)
  | SDKPartialAssistantMessage   // stream_event (only with includePartialMessages)
  | SDKCompactBoundaryMessage    // Compaction boundary
  | SDKStatusMessage             // Status updates
  | SDKLocalCommandOutputMessage // Local command output
  | SDKHookStartedMessage       // Hook lifecycle
  | SDKHookProgressMessage
  | SDKHookResponseMessage
  | SDKToolProgressMessage       // Tool progress
  | SDKAuthStatusMessage         // Auth status
  | SDKTaskNotificationMessage   // Task notifications
  | SDKTaskStartedMessage
  | SDKTaskProgressMessage
  | SDKFilesPersistedEvent       // File persistence
  | SDKToolUseSummaryMessage     // Tool use summary
  | SDKRateLimitEvent            // Rate limit
  | SDKPromptSuggestionMessage;  // Prompt suggestions
```

### Key Streaming Type

```typescript
type SDKPartialAssistantMessage = {
  type: "stream_event";
  event: BetaRawMessageStreamEvent;  // From @anthropic-ai/sdk
  parent_tool_use_id: string | null;
  uuid: UUID;
  session_id: string;
};
```

The `event` field wraps the same raw Anthropic API stream events as the CLI `stream_event` type.

## Extracting Streaming Text

### CLI (jq)

Source: [Claude Code headless docs](https://code.claude.com/docs/en/headless)

```bash
claude -p "Write a poem" --output-format stream-json --verbose --include-partial-messages | \
  jq -rj 'select(.type == "stream_event" and .event.delta.type? == "text_delta") | .event.delta.text'
```

## Known Limitations

- When `maxThinkingTokens` is explicitly set in the SDK, `StreamEvent` messages are NOT emitted (streaming is disabled)
- Thinking content is disabled by default in the SDK
- Without `--verbose`, only the final `result` JSON is emitted (no streaming events at all)

## Sources

- [Claude Code headless mode docs](https://code.claude.com/docs/en/headless)
- [Claude Agent SDK streaming docs](https://platform.claude.com/docs/en/agent-sdk/streaming-output)
- [Claude Agent SDK TypeScript docs](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [Claude Agent SDK Python docs](https://platform.claude.com/docs/en/agent-sdk/python)
- `@anthropic-ai/claude-agent-sdk` npm package (TypeScript type definitions)
- [Anthropic Messages API streaming spec](https://docs.anthropic.com/en/api/messages-streaming)
