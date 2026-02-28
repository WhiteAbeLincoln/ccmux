# ccmux

Provides:
- A viewer for claude code session logs
  - Browse and search sessions
  - Provides an interactive web ui: navigate through subagent sessions, thinking traces, tool calls and responses
  - Export sessions as markdown. Optionally include full tool calls, subagent sessions, thinking traces, and more
  - Resume sessions, picking up where you left off
- A claude code session manager with the following features:
  - Remote control, with both full terminal access and a simplified chat interface
  - Voice control, allowing claude to respond with voice and accept voice commands
  - Project management and sandboxing. Restrict claude's access to the filesystem, provide cli tools for projects using nix, and more
  - Drives the Claude Code client in a virtual TTY - you won't get banned for using a custom client!

## Architecture

### Nix

Used for development and deployment.
Provides a consistent environment across all platforms and makes it easy to manage dependencies.
A nix flake is provided with outputs for the web client and the backend server.

### Server

A Rust application which serves the GraphQL API and the SPA web interface.
Watches .jsonl log files for changes and updates the GraphQL API accordingly.

### Web Client

A responsive Single Page Application built with TypeScript and Svelte.
Uses ghostty-web for terminal emulation when controlling a claude-code session.
Uses bun instead of node for development.

### iOS Client

A native iOS application built with Swift and SwiftUI.

## TODO

- Compaction summaries are displayed as user messages
- Bash tool calls should be syntax highlighted and include their responses
- Edit tool calls should look like a git diff
- Subagent sessions are treated as regular sessions; should instead be collapsed under the parent session and linked in the main conversation
