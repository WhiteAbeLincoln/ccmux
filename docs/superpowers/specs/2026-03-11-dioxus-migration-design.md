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
    loader.rs               # discover_sessions, scan_metadata, load_session_raw
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
    pub session_id: Option<String>,
    pub timestamp: Option<DateTime<Utc>>,
    pub cwd: Option<String>,
    pub git_branch: Option<String>,
    pub is_sidechain: Option<bool>,
}
```

**Wire types** (serialized to client via server functions):

```rust
pub struct SessionMeta {
    pub id: String,
    pub project: String,
    pub slug: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub message_count: usize,
    pub first_message: Option<String>,
    pub file_path: PathBuf,
}

pub struct DisplayItem {
    pub kind: DisplayItemKind,
    pub mode: DisplayMode,
    pub raw: serde_json::Value,       // for per-item raw toggle
    // kind-specific payload fields
}

pub enum DisplayItemKind {
    UserMessage,
    AssistantMessage,
    Thinking,
    ToolUse,
    ToolResult,
    TurnDuration,
    Compaction,
    TaskList,
    Other,
}

pub enum DisplayMode {
    Full,
    Collapsed,
    Grouped,
    Hidden,
}
```

### Display Pipeline

The `events_to_display_items()` function lives in `ccmux-core/display/pipeline.rs`. It:

1. Takes `Vec<Event>` (parsed from JSONL)
2. Indexes tool-use and tool-result by UUID for parent-child linkage
3. Assigns `DisplayMode` based on event type (same rules as current TypeScript):
   - User/assistant messages: `Full`
   - Thinking blocks: `Grouped`
   - Tool calls: `Grouped` by default, `Full` for Bash/AskUserQuestion
   - TaskCreate/TaskUpdate: `TaskList`
   - Tool results: `Hidden` (paired with tool-use)
4. Returns `Vec<DisplayItem>` ready for the client

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

Uses `notify` crate to watch the JSONL file. As new lines appear:
1. Parse to `Event`
2. Transform to `DisplayItem`
3. Serialize and stream to client via SSE

Client deserializes and appends to its display items list.

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
