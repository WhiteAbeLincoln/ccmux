# ccmux

Session log viewer for Claude Code. Rust/Dioxus fullstack app.

## Development

```
cd crates/ccmux-app && dx serve   # fullstack dev server
```

Run `cargo clippy --workspace` and `cargo fmt --all` to lint and format after every change.
Fix any warnings or errors before committing.

## Browser Testing

[agent-browser](https://github.com/vercel-labs/agent-browser) is available in the nix dev shell for browser automation. Use the `agent-browser` skill for usage instructions.

## Known Issues

- **Task list rendering**: TaskCreate/TaskUpdate runs that are split across multiple groups (separated by non-task tool calls) each only show the tasks from their own events. Later groups with TaskUpdate-only events resolve descriptions from the global toolUseMap, but the task list doesn't carry forward the full cumulative state from prior groups. Needs rework to maintain a running task snapshot across all groups.
