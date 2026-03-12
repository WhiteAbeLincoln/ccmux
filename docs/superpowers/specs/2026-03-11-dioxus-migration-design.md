# Dioxus Fullstack Migration Design

## Motivation

Migrate ccmux from a split architecture (Rust/Axum backend + SolidJS/TypeScript frontend + GraphQL) to a unified Dioxus fullstack app. Goals:

- Single language (Rust) for the entire stack
- SSR with WASM hydration for fast initial loads
- Simplified build pipeline (one `dx serve` instead of two dev servers + codegen)
- Path toward desktop and mobile clients via shared `ccmux-core` crate

## Architecture

Cargo workspace with two crates:

```
Cargo.toml                  # workspace root
crates/
  ccmux-core/               # session parsing, event types, display pipeline
  ccmux-app/                # Dioxus fullstack web app
```

### ccmux-core

Standalone library crate with no Dioxus dependency. Reusable by future desktop/mobile clients.

```
crates/ccmux-core/src/
  lib.rs
  session/
    mod.rs
    loader.rs               # discover_sessions, scan_metadata, load_session_raw, extract_agent_map
  events/
    mod.rs                  # Event enum, CoreFields, typed variants
    parse.rs                # JSONL line → Event parsing
  display/
    mod.rs                  # DisplayItem, DisplayItemKind, DisplayMode
    pipeline.rs             # Vec<Event> → Vec<DisplayItem> transformation
```

### ccmux-app

Dioxus fullstack crate. Contains server functions, components, and routes.

```
crates/ccmux-app/src/
  main.rs                   # Dioxus launch (fullstack)
  server/
    mod.rs
    sessions.rs             # list_sessions, get_session server fns
    streaming.rs            # stream_session_events (SSE)
  components/
    mod.rs
    app.rs                  # root layout, nav
    session_list.rs         # session browser grouped by project
    session_view.rs         # main session viewer
    blocks/
      mod.rs
      message.rs            # collapsible wrapper block
      display_item.rs       # dispatcher → specific renderers
      tool_use.rs           # tool call rendering
      prose.rs              # markdown via pulldown-cmark
      thinking.rs           # thinking block rendering
      task_list.rs          # task checkbox visualization
  routes.rs                 # route definitions
```

## Data Model

### Boundary Principle

The server is the only component that understands JSONL log formats. The client only knows about `DisplayItem`s. This boundary enables future support for other agent log formats — each format just needs a parser that produces `DisplayItem`s.

### Types (ccmux-core)

**Internal types** (not serialized across the wire):

```rust
pub enum Event {
    Assistant(AssistantEvent),
    User(UserEvent),
    System(SystemEvent),
    Progress(ProgressEvent),
    FileHistory(FileHistoryEvent),
    QueueOperation(QueueOperationEvent),
    Unknown(serde_json::Value),
}

pub struct CoreFields {
    pub uuid: Option<String>,
    pub parent_uuid: Option<String>,
    pub session_id: String,
    pub timestamp: Option<DateTime<Utc>>,
    pub cwd: String,
    pub git_branch: Option<String>,
    pub is_sidechain: bool,
    pub user_type: Option<String>,
    pub version: Option<String>,
    pub slug: Option<String>,
}
```

**Wire types** (serialized to client via server functions):

```rust
pub struct SessionMeta {
    pub id: String,
    pub project: String,
    pub slug: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub message_count: i32,
    pub first_message: Option<String>,
    pub project_path: Option<String>,
    pub is_sidechain: bool,
    pub parent_session_id: Option<String>,
    pub agent_id: Option<String>,
}

/// DisplayItem is a Rust enum with per-variant payloads, replacing the
/// TypeScript discriminated union. Each variant carries the data its
/// component needs to render, plus the raw JSON for the raw toggle.
pub enum DisplayItem {
    UserMessage {
        content: String,
        raw: Value,
    },
    AssistantMessage {
        text: String,
        raw: Value,
    },
    Thinking {
        text: String,
        raw: Value,
    },
    ToolUse {
        name: String,
        tool_use_id: String,
        input: Value,
        result: Option<ToolResultData>,
        raw: Value,
    },
    TaskList {
        tasks: Vec<TaskItem>,
        raw: Value,
    },
    TurnDuration {
        duration_ms: u64,
        raw: Value,
    },
    Compaction {
        raw: Value,
    },
    /// Heterogeneous group of items with Grouped display mode.
    /// Can contain thinking blocks, compaction, and non-Full tool calls
    /// (i.e., not Bash, AskUserQuestion, or task-related).
    Group {
        items: Vec<DisplayItem>,
    },
    Other {
        raw: Value,
    },
}

pub struct ToolResultData {
    pub output: Option<String>,
    pub error: Option<String>,
    pub raw: Value,
}

pub struct TaskItem {
    pub id: String,
    pub subject: String,
    pub status: TaskStatus,
}

pub enum TaskStatus {
    Pending,
    InProgress,
    Completed,
    Cancelled,
}

pub enum DisplayMode {
    Full,
    Collapsed,
    Grouped,
    Hidden,
}
```

### Display Pipeline

The `events_to_display_items()` function lives in `ccmux-core/display/pipeline.rs`. It takes a `DisplayOpts` parameter that controls default display modes per item kind and per tool name:

```rust
pub struct DisplayOpts {
    /// Default mode per DisplayItem variant (e.g., Thinking → Grouped)
    pub defaults: HashMap<DisplayItemDiscriminant, DisplayMode>,
    /// Per-tool-name overrides (e.g., "Bash" → Full, "TaskCreate" → TaskList)
    pub tool_overrides: HashMap<String, DisplayMode>,
}

impl Default for DisplayOpts { /* current hardcoded defaults */ }
```

For now, `Default::default()` is always used. In the future, user preferences are loaded and passed in. The signature is:

```rust
pub fn events_to_display_items(events: Vec<Event>, opts: &DisplayOpts) -> Vec<DisplayItem>
```

The function:

1. Takes `Vec<Event>` (parsed from JSONL) and `&DisplayOpts`
2. Indexes tool-use and tool-result by UUID for parent-child linkage
3. Pairs each tool-use with its tool-result (result is embedded in the `ToolUse` variant, not a separate item)
4. Accumulates TaskCreate/TaskUpdate events into `TaskList` items with running state
5. Assigns `DisplayMode` by consulting `opts.tool_overrides` first (for tool events), then `opts.defaults`, falling back to hardcoded defaults. Current defaults:
   - User/assistant messages: `Full`
   - Thinking blocks: `Grouped`
   - Tool calls: `Grouped` by default, with per-name overrides:
     - `Bash`, `AskUserQuestion`: `Full`
     - `TaskCreate`, `TaskUpdate`, `TaskGet`, `TaskList`: `TaskList` (accumulated into checkbox groups)
   - Compaction: `Grouped`
   - Progress events: `Hidden`
   - Tool results: `Hidden` (paired with tool-use)
   - FileHistory, QueueOperation, Unknown: `Hidden`
6. Groups consecutive items with the same `DisplayMode::Grouped` — flushes a group when the next item has a different mode
7. Returns `Vec<DisplayItem>` ready for the client

The pipeline also exposes an incremental interface for streaming (see Streaming section below).

## Server Functions

Three server functions replace the GraphQL layer:

### list_sessions

```rust
#[server]
async fn list_sessions(
    project: Option<String>,
    page: Option<PageInput>,
) -> Result<Vec<SessionMeta>, ServerFnError>
```

Discovers sessions from `~/.claude/projects/`, scans metadata, applies optional project filter and pagination.

### get_session

```rust
#[server]
async fn get_session(
    id: String,
    page: Option<PageInput>,
) -> Result<SessionResponse, ServerFnError>

pub struct SessionResponse {
    pub meta: SessionMeta,
    pub items: Vec<DisplayItem>,
}
```

Loads JSONL, parses to events, runs `events_to_display_items()`, returns display items. The client never sees `Event`.

### stream_session_events

```rust
#[server(output = StreamingText)]
async fn stream_session_events(
    id: String,
) -> Result<TextStream, ServerFnError>
```

Uses `notify` crate to watch the JSONL file. Items are sent to the client immediately — no server-side buffering for groups.

Each SSE message is a JSON-serialized `StreamEvent`:

```rust
pub enum StreamEvent {
    /// Append a new display item to the end of the list
    Append(DisplayItem),
    /// Merge into the last display item (e.g., add a thinking block to an
    /// existing Thinking group, or add a tool call to a grouped ToolUse run)
    MergeWithPrevious(DisplayItem),
    /// Update an existing tool-use item with its result (matched by tool_use_id)
    UpdateToolResult { tool_use_id: String, result: ToolResultData },
    /// Update task list state (matched by task id)
    UpdateTask(TaskItem),
}
```

As new JSONL lines appear:
1. Parse to `Event`, run through `DisplayOpts` to determine mode
2. If the item's mode is `Grouped` and the previous emitted item was the same kind → emit `MergeWithPrevious`
3. If the item is a tool-result → emit `UpdateToolResult` targeting the corresponding tool-use
4. If the item is a TaskUpdate → emit `UpdateTask` with the new state
5. Otherwise → emit `Append`

The server tracks minimal state per connection: the kind/mode of the last emitted item (for merge decisions) and the tool-use index (for pairing results). No buffering — every JSONL line produces an immediate SSE message.

The client handles `StreamEvent` by:
- `Append`: push to the items signal
- `MergeWithPrevious`: append to the last item's group. Groups are heterogeneous — a single group can contain thinking blocks, compaction, and tool calls that aren't `Full`-mode (i.e., not Bash, AskUserQuestion, or task-related). For example, a group might accumulate: thinking → Read tool call → thinking → compaction.
- `UpdateToolResult`: find the `ToolUse` item by id, update its `result` field
- `UpdateTask`: find or create the task in the relevant `TaskList` item

## Components

### Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `SessionList` | Browse sessions grouped by project |
| `/session/:id` | `SessionView` | View session with live streaming |

### Component Tree

```
App
├── Nav
├── SessionList
│   └── ProjectGroup (collapsible, sorted by recency)
│       └── SessionCard (preview, count, timestamp)
└── SessionView
    ├── SessionHeader (meta, live indicator)
    ├── DisplayItemList
    │   └── DisplayItemView (dispatcher)
    │       ├── MessageBlock (collapsible wrapper)
    │       │   ├── Prose (pulldown-cmark markdown)
    │       │   ├── ToolUseBlock
    │       │   ├── ThinkingBlock
    │       │   └── TaskListBlock
    │       └── RawItemView (per-item raw JSON toggle)
    └── StreamingState (SSE connection, appends items)
```

### State Management

- Session-level `Signal<Vec<DisplayItem>>` for the item list
- `Signal<HashMap<usize, bool>>` for per-item expansion state
- `Signal<HashMap<usize, bool>>` for per-item raw toggle
- SSE streaming appends to the items signal; auto-scroll when user is at bottom

## Styling

Plain CSS files. No CSS modules, no Tailwind. Loaded via Dioxus asset system (`manganis`). Works across web, desktop, and mobile (WebView) targets.

## Markdown Rendering

`pulldown-cmark` parses markdown to events, mapped to Dioxus VNodes in the `Prose` component. Pure Rust, cross-platform. Syntax highlighting deferred to a later phase.

## Error Handling

Graceful degradation, matching the current behavior:

- **Malformed JSONL lines**: Log a warning, skip the line, continue processing. The pipeline produces an `Other` display item with the raw text so the user can see something went wrong.
- **Missing session file**: Return `ServerFnError` with a descriptive message. Client shows an error state.
- **Partial reads** (file being written to): The session loader reads what's available. The streaming function picks up new lines as they appear.
- **Broken SSE connection**: Client detects disconnect and shows a reconnect prompt or auto-reconnects.

## Build & Dev Workflow

### Development

```bash
dx serve    # Dioxus fullstack dev server (SSR + WASM hot reload)
```

Replaces the current two-server setup (`cargo run` + `bun dev`).

### Linting

```bash
cargo clippy --workspace
cargo fmt --all
```

### Nix Flake

Update to include `dx` CLI. Drop Node, Bun, and GraphQL codegen dependencies.

## Migration Plan (High Level)

1. Set up workspace structure and `ccmux-core` crate
2. Move session parsing from `src/session/` into `ccmux-core`
3. Extract event types from `graphql/types.rs` into `ccmux-core/events/`
4. Rewrite display item pipeline in Rust (`ccmux-core/display/`)
5. Create `ccmux-app` with Dioxus fullstack scaffold
6. Implement server functions (list, get, stream)
7. Build components (session list, session view, blocks)
8. Implement SSE streaming for live tailing
9. Style with plain CSS to match current appearance
10. Update Nix flake, delete old SolidJS frontend and GraphQL layer

## What's Deferred

- Syntax highlighting (will add later, likely `syntect` or similar)
- Raw log view as separate route (unified with main view via toggle)
- Desktop and mobile targets (future clients reuse `ccmux-core`)
- Bidirectional communication / managed agent prompting
- Virtual scrolling for large sessions
