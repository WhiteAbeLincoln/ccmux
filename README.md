# Cairn 🪨 🥾 🌲

> Currently Cairn is being developed for my personal use, and may not be the
> ideal interface for everyone. Feel free to use it if you want, but I provide no
> guarantees on stability or support at the moment. The main branch may often be
> in a broken state and I won't distribute binaries.

An all-in-one interface for managing your AI coding sessions with a focus on mobile accessibility.

If you've ever been frustrated with the experience using
Claude Code's [remote-control feature](https://code.claude.com/docs/en/remote-control)
through the official app, and wanted something which gives more visibility into what changes
have been made to your codebase and more insight into the agent's thinking and actions,
then Cairn is for you.

## Supported Agents

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- _More to come!_

## Features

> This is a list of planned features, not all are implemented yet

- [ ] **Spawn Coding Sessions** - Start new sessions and view existing ones from your phone or desktop,
  without needing to ssh into your machine and spawn a session in Tmux
- [ ] **Sandbox Sessions** - Prevent modification to files outside your project directory.
- [ ] **Voice Control** - Talk to your agent and control it with voice commands
  _Sandboxing is very basic at the moment and won't prevent secret exfiltration or malicious commands, but it will stop accidental `rm -rf /`-style disasters_
- [ ] **Reproducible Agent Environments** - Built-in support for managing developer and agent environments with Nix.
  Define dev shells for your projects and spawn sessions with the correct environment automatically
- [ ] **Git Integration** - View git logs and diffs through the web interface with progressive levels of detail.
  Powered by [sem](https://github.com/ataraxy-labs/sem) and [difftastic](https://github.com/wilfred/difftastic)
- [ ] **Remote File Browser** - Browse your project files and view file contents in a convenient interface. Powered by [monaco-editor](https://github.com/microsoft/monaco-editor)
- [ ] **Remote Terminal** - Drop into a terminal session for more control. Powered by [ghostty-web](https://github.com/coder/ghostty-web)
- [ ] **Rich Message Rendering** — The web UI renders agent and user messages with markdown and syntax highlighting with custom widgets for each tool call
- [ ] **Log Browsing** — View history logs in a convenient interface instead of raw JSONL
- [ ] **Enhanced Visibility** - View subagent sessions and thinking messages
- [ ] **Markdown Log Rendering** - Export session history as markdown, or view markdown-rendered history in your terminal through the CLI
- [ ] **Search History** - Semantic search through your session history. CLI integration so agents can query past sessions for relevant information
- [X] **Local First** - Cairn is a local application that runs on your machine and doesn't rely on any cloud services.
  Your data is stored locally and never leaves your machine (except for LLM API calls depending on your choice of agent).

## FAQ

### Why the name Cairn?

- I like hiking
- Naming things is really hard
- Originally was ccmux but that was derivative of [cmux](https://cmux.com) and too tied to claude code, and then I
  thought of Rica (Remote Interface for Coding Agents), but that has some unfortunate connotations in Spanish.
- Cairns are piles of rocks that hikers build to mark trails and guide others, which is a nice metaphor for what
  this project aims to do: provide a guiding interface for navigating the sometimes rocky terrain of AI coding sessions.
  That's still a bit of a stretch :)
