# unnamed claude code log utility

A session inspector and explorer for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Browse your session logs with a structured, interactive web UI that makes it easy to understand what happened during a coding session.

## Features

- **Session browser** — sessions grouped by project, sorted by recency, with message counts
- **Structured message rendering** — user messages, assistant responses, questions, plans, and system events each get their own visual treatment
- **Syntax-highlighted bash** — shell commands rendered with full syntax highlighting, collapsible output, and error badges
- **Image preview** — Read tool calls that return screenshots or images render inline instead of showing raw base64
- **Collapsible tool calls** — thinking traces, file reads, edits, searches, and other tool calls collapse into compact summaries with token counts
- **Subagent navigation** — agent tool calls link to their subagent sessions; subagent views show prompt and output summaries
- **Token usage** — every message and tool call shows its token cost
- **Raw log access** — every block links to its raw JSONL entry for debugging

## Screenshots

### Session List
<img alt="Session list grouped by project" src="./_assets/session-list.png" width="700" />

### Session View
<img alt="Session view with bash blocks and tool calls" src="./_assets/session-view.png" width="700" />

### Bash Tool Blocks
<img alt="Bash blocks with syntax highlighting and error badges" src="./_assets/bash-blocks.png" width="700" />

### Read Tool Image Preview
<img alt="Read tool rendering a screenshot as an inline image" src="./_assets/read-image-preview.png" width="700" />

### Question Block
<img alt="Question block with question and answer" src="./_assets/question-block.png" width="700" />

### Raw Log Viewer
<img alt="Raw log viewer showing JSONL entries" src="./_assets/raw-logs.png" width="700" />

## Architecture

### Server

Rust application serving a GraphQL API and the SPA web interface. Watches `.jsonl` log files for changes and updates the API accordingly.

### Web Client

Single Page Application built with TypeScript and SolidJS. Uses Shiki for bash syntax highlighting. Built with Vite; uses Bun for development.

### Nix

A nix flake provides a dev shell and build outputs for both the server and web client.

## Development

```
cargo run          # backend on :3001
cd web && bun dev  # frontend on :5173
```

## Future

- Export sessions as markdown with configurable detail level
- Edit tool calls rendered as diffs
- Session search and filtering
- Remote session control with terminal access
- Voice interface
- iOS client
