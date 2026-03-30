# Claude Code JSONL Log Format

Investigation notes for building a log viewer.

## File Locations

- **Session logs**: `~/.claude/projects/<project-path>/<session-uuid>.jsonl`
- **Subagent logs**: `~/.claude/projects/<project-path>/<session-uuid>/subagents/<agent-id>.jsonl`
- **History index**: `~/.claude/history.jsonl` (lightweight, one entry per user prompt)

## Event Types (6 total)

### 1. `"user"` — User messages & tool results
- `message.content` is a string for user input, or an array of `{ type: "tool_result", tool_use_id, content }` for tool results
- `toolUseResult` field is truthy when this is a tool result (not a user prompt)
- Has `permissionMode`, `todos` fields

### 2. `"assistant"` — Claude responses
- `message.content` is an array of content blocks:
  - `{ type: "thinking", thinking: "...", signature: "..." }`
  - `{ type: "text", text: "..." }`
  - `{ type: "tool_use", id: "toolu_...", name: "ToolName", input: {...}, caller: { type: "direct" } }`
- `message.stop_reason`: `"end_turn"`, `"tool_use"`, or `null` (streaming/incomplete)
- `message.model`: e.g. `"claude-opus-4-6"`
- `message.usage`: `{ input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens, service_tier }`
- `requestId`: groups streaming chunks from the same API call

### 3. `"progress"` — Subagent/tool progress
- Written ~1/second while a subagent or long-running tool is active
- Has `toolUseID`, `parentToolUseID`
- `data.message` contains the subagent's messages

### 4. `"system"` — System events
- `subtype`: e.g. `"turn_duration"`
- `durationMs`: turn duration in ms
- `isMeta`: boolean

### 5. `"file-history-snapshot"` — File state for undo
- `messageId`, `isSnapshotUpdate`
- `snapshot.trackedFileBackups`: map of file backups

### 6. `"queue-operation"` — Queued user input (typed while busy)
- `operation`: `"enqueue"` or `"popAll"`
- `content`: the queued text
- Only has `sessionId`, `timestamp` (no uuid/parentUuid)

## Common Fields (user/assistant/progress/system)

| Field | Description |
|---|---|
| `uuid` | Unique event ID |
| `parentUuid` | Links to prior event (null = conversation root) |
| `sessionId` | Session UUID (matches log filename) |
| `timestamp` | ISO 8601 |
| `version` | Claude Code CLI version |
| `cwd` | Working directory |
| `gitBranch` | Active git branch |
| `isSidechain` | `true` for subagent conversations |
| `userType` | Always `"external"` |
| `slug` | Human-readable session slug |

## Subagent Logs

Same format as main logs but additionally have `agentId` field and `isSidechain: true`.

## Write Frequency (observed)

| Event | Frequency |
|---|---|
| `progress` | ~1/second during tool execution |
| `user` (tool_result) | Once per tool completion |
| `assistant` | Once per completed API response (not per token) |
| `system` (turn_duration) | Once at end of turn |
| `file-history-snapshot` | At turn boundaries |
| `queue-operation` | When user types while Claude is busy |

Lines are appended atomically, one JSON object per line. Safe to `tail -f`.

## History Index (`~/.claude/history.jsonl`)

Separate lightweight file, one entry per user prompt:
```json
{
  "display": "prompt text",
  "pastedContents": {},
  "timestamp": 1770506189916,  // unix ms (not ISO 8601)
  "project": "/Users/...",
  "sessionId": "..."
}
```

## Conversation Threading

- Use `parentUuid` to build the message tree
- Tool call flow: assistant `tool_use` block → next user event has `toolUseResult: true` with matching `tool_use_id`
- Multiple assistant events can share a `requestId` (streaming chunks)

## Existing Viewers

- [claude-code-log](https://github.com/daaain/claude-code-log) — Python CLI → HTML
- [claude-JSONL-browser](https://github.com/withLinda/claude-JSONL-browser) — Web-based → Markdown
