# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is ccmux?

Session log viewer for Claude Code. Reads `.jsonl` session logs from `~/.claude/projects/` and renders them in a structured, interactive web UI. Built as a Rust/Dioxus fullstack app.

## Development

```
cd crates/ccmux-app && dx serve   # fullstack dev server (serves both WASM client and Rust server)
```

Run after every change:
```
cargo clippy --workspace && cargo fmt --all
```

Run tests:
```
cargo test --workspace               # all tests
cargo test -p ccmux-core              # core crate only
cargo test -p ccmux-core -- <name>    # single test
```

## Browser Testing

[agent-browser](https://github.com/vercel-labs/agent-browser) is available in the nix dev shell for browser automation. Use the `agent-browser` skill for usage instructions.

After every frontend change you must verify visually using the `agent-browser` skill.

## Architecture

### Workspace Crates

- **ccmux-core**: Pure data library. Parses JSONL session files into typed events, then transforms them through a display pipeline into renderable items. No UI code, no WASM target. Syntax highlighting via syntect (server-only).
- **ccmux-app**: Dioxus 0.7 fullstack app. Contains routes, server functions, and all UI components. Server functions bridge ccmux-core to the client over HTTP and SSE.

### Data Flow: JSONL → Screen

```
Session .jsonl file
  → loader.rs: load_session_raw() → Vec<Value>
  → events/parse.rs: parse_events() → Vec<Event>
  → display/pipeline.rs: events_to_display_items() → Vec<DisplayItemWithMode>
  → server_fns.rs: serialized to client
  → components: rendered by Dioxus
```

### Key Concepts

**Event types** (`ccmux-core/src/events/`): `AssistantEventData`, `UserEventData`, `SystemEventData`, `ProgressEventData`, `FileHistoryEventData`, `QueueOperationEventData`. Unknown event types gracefully degrade to `Event::Unknown(Value)`.

**Display pipeline** (`ccmux-core/src/display/pipeline.rs`): Converts typed events into `DisplayItem` variants (UserMessage, AssistantMessage, Thinking, ToolUse, TurnDuration, Compaction, Other). Each item gets a `DisplayMode` (Full, Collapsed, Grouped, Hidden) that controls rendering behavior.

**Tool result pairing**: User events contain `tool_result` content blocks keyed by `tool_use_id`. The pipeline pre-scans these into a HashMap, then pairs them inline with the corresponding assistant ToolUse items.

**Grouping logic**: Items with Grouped mode accumulate until a Full/Collapsed item breaks the group. Single grouped item → Collapsed; multiple → Grouped with summary header (e.g., "Thinking · Read×2 · Bash").

**Streaming** (`display/streaming.rs`): SSE-based live updates via `stream_session_events()`. Server watches the JSONL file with `notify`, parses new lines, and sends `StreamEvent::Append` or `StreamEvent::UpdateToolResult` to the client.

**Markdown rendering** (`components/blocks/prose.rs`): Markdown → HTML via pulldown-cmark on the server. Post-processes code blocks with syntect for syntax highlighting. Must be server-side because syntect doesn't compile to WASM.

### Server Functions (`server_fns.rs`)

- `list_sessions()`: Discovers sessions from `~/.claude/projects/`, returns grouped by project
- `get_session()`: Loads full session content through the display pipeline
- `stream_session_events()`: SSE endpoint for live session updates

### Component Structure (`components/`)

- **AppLayout** (`app.rs`): Header, nav context (session_id, project_path, raw toggle)
- **SessionList** (`session_list.rs`): Project-grouped session browser
- **SessionView** (`session_view.rs`): Main session renderer with streaming and scroll FAB
- **blocks/**: Display item renderers
  - `display_item.rs`: Dispatches on DisplayMode and DisplayItem type
  - `message.rs`: Collapsible message wrapper (MessageBlock) used by all block types
  - `group.rs`: GroupBlock for collapsed tool call summaries
  - `prose.rs`: Markdown rendering with syntax-highlighted code blocks
  - `json_tree.rs`: Recursive collapsible JSON viewer
  - `tools/`: Per-tool renderers (bash, read, edit, write, grep, glob, agent, ask_user, web_search, tool_search) with generic fallback

## Known Issues

- **Task list rendering**: TaskCreate/TaskUpdate runs that are split across multiple groups (separated by non-task tool calls) each only show the tasks from their own events. Later groups with TaskUpdate-only events resolve descriptions from the global toolUseMap, but the task list doesn't carry forward the full cumulative state from prior groups. Needs rework to maintain a running task snapshot across all groups.
