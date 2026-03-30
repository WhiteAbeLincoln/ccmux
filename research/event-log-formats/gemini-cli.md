# Gemini CLI Session Log Format

## Overview

- **Agent:** Gemini CLI (Google)
- **Location:** `~/.gemini/tmp/<project-slug>/chats/session-<timestamp>-<id-prefix>.json`
- **Format:** Single JSON file (not JSONL), pretty-printed, overwritten on each update
- **Structure:** `ConversationRecord` with nested `messages[]` array

## Storage

Session files live under `~/.gemini/tmp/<project_identifier>/chats/`. The project identifier is a short slug derived from the project root path (registered in `~/.gemini/projects.json`; older versions used a SHA-256 hash).

File naming convention:
```
session-<YYYY-MM-DDTHH-MM>-<first-8-chars-of-sessionId>.json
```

Subagent sessions are nested:
```
chats/<parent_session_id>/<subagent_session_id>.json
```

Additional storage:
- Activity logs (debug): `~/.gemini/tmp/<project>/logs/session-<uuid>.jsonl`
- Tool outputs: `~/.gemini/tmp/<project>/tool-outputs/session-<uuid>/`

## Type Definitions (from source)

Source: [`packages/core/src/services/chatRecordingService.ts`](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/services/chatRecordingService.ts)

### ConversationRecord (top-level)

```typescript
export interface ConversationRecord {
  sessionId: string;
  projectHash: string;
  startTime: string;           // ISO 8601
  lastUpdated: string;         // ISO 8601
  messages: MessageRecord[];
  summary?: string;            // AI-generated, max 80 chars
  directories?: string[];      // Workspace dirs added via /dir add
  kind?: 'main' | 'subagent';
}
```

### MessageRecord

```typescript
export type MessageRecord = BaseMessageRecord & ConversationRecordExtra;

export interface BaseMessageRecord {
  id: string;                    // UUID
  timestamp: string;             // ISO 8601
  content: PartListUnion;        // string OR Part[] (polymorphic)
  displayContent?: PartListUnion;
}

export type ConversationRecordExtra =
  | { type: 'user' | 'info' | 'error' | 'warning' }
  | {
      type: 'gemini';
      toolCalls?: ToolCallRecord[];
      thoughts?: Array<ThoughtSummary & { timestamp: string }>;
      tokens?: TokensSummary | null;
      model?: string;
    };
```

Message types:

| Type | Description |
|------|-------------|
| `user` | User prompt |
| `gemini` | Model response (with optional tool calls, thoughts, tokens) |
| `info` | System info message |
| `error` | Error message |
| `warning` | Warning message |

### ToolCallRecord

```typescript
export interface ToolCallRecord {
  id: string;
  name: string;                         // e.g., "read_file", "shell", "write_file"
  args: Record<string, unknown>;
  result?: PartListUnion | null;        // Tool output, inline
  status: Status;                       // CoreToolCallStatus enum value
  timestamp: string;
  // UI-enrichment fields:
  displayName?: string;
  description?: string;
  resultDisplay?: ToolResultDisplay;
  renderOutputAsMarkdown?: boolean;
}
```

Tool call results are stored **inline** in the `result` field. When results come from the Gemini API, they are wrapped in `functionResponse` objects:

```typescript
// result array element format:
{
  "functionResponse": {
    "id": "<call_id>",
    "name": "<tool_name>",
    "response": {
      "output": "<result text>"
    }
  }
}
```

### Status (CoreToolCallStatus)

Source: [`packages/core/src/scheduler/types.ts`](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/scheduler/types.ts)

```typescript
export enum CoreToolCallStatus {
  Validating = 'validating',
  Scheduled = 'scheduled',
  Error = 'error',
  Success = 'success',
  Executing = 'executing',
  Cancelled = 'cancelled',
  AwaitingApproval = 'awaiting_approval',
}
```

### TokensSummary

```typescript
export interface TokensSummary {
  input: number;      // promptTokenCount
  output: number;     // candidatesTokenCount
  cached: number;     // cachedContentTokenCount
  thoughts?: number;  // thoughtsTokenCount
  tool?: number;      // toolUsePromptTokenCount
  total: number;      // totalTokenCount
}
```

### ThoughtSummary

Source: [`packages/core/src/utils/thoughtUtils.ts`](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/utils/thoughtUtils.ts)

```typescript
export type ThoughtSummary = {
  subject: string;      // Bold heading extracted from **Subject** markup
  description: string;  // Remaining text
};
// In messages, each thought also has a timestamp: string field
```

## Content Polymorphism

The `content` field on messages is `PartListUnion`, which can be:

1. A **plain string** (older sessions, user messages)
2. An **array of Part objects** (newer sessions), e.g., `[{"text": "hello"}]`

Parsers must handle both forms.

## AgentEvent Protocol (Streaming)

Source: [`packages/core/src/agent/types.ts`](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/agent/types.ts)

This is a newer event-based protocol used for real-time streaming and the A2A server. These events are **not** written to the session JSON files but are relevant context for understanding the agent's event model.

Common fields:
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

Event types:

| Type | Description |
|------|-------------|
| `initialize` | Session start |
| `session_update` | Title/model/config changes |
| `message` | Content from user/agent/developer |
| `agent_start` | Start of agent activity |
| `agent_end` | End of agent activity with reason |
| `tool_request` | Tool call with requestId, name, args |
| `tool_update` | Intermediate tool progress |
| `tool_response` | Tool result |
| `elicitation_request` | Ask user for input |
| `elicitation_response` | User's answer |
| `usage` | Token counts and cost |
| `error` | Error with gRPC-style status codes |
| `custom` | Arbitrary extension events |

## Proposed JSONL Migration

Source: [Issue #15292](https://github.com/google-gemini/gemini-cli/issues/15292)

There is an in-progress proposal to switch from single JSON files to JSONL:

```jsonl
{"type":"session_metadata","sessionId":"...","projectHash":"...","startTime":"..."}
{"type":"user","id":"msg1","content":[{"text":"Hello"}]}
{"type":"gemini","id":"msg2","content":[{"text":"Hi"}]}
{"type":"message_update","id":"msg2","tokens":{"input":10,"output":5}}
```

## Serialization

Sessions are written as `JSON.stringify(conversation, null, 2)` (pretty-printed, 2-space indent). The entire file is overwritten on each update. Deserialization is `JSON.parse(fs.readFileSync(...))`.

## Sources

- [google-gemini/gemini-cli - chatRecordingService.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/services/chatRecordingService.ts)
- [google-gemini/gemini-cli - chatRecordingService.test.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/services/chatRecordingService.test.ts)
- [google-gemini/gemini-cli - agent/types.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/agent/types.ts)
- [google-gemini/gemini-cli - scheduler/types.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/scheduler/types.ts)
- [google-gemini/gemini-cli - utils/thoughtUtils.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/utils/thoughtUtils.ts)
- [Issue #9042 - Gemini did not respond](https://github.com/google-gemini/gemini-cli/issues/9042)
- [Issue #10927 - Non-interactive sessions do not log tool calls](https://github.com/google-gemini/gemini-cli/issues/10927)
- [Issue #15292 - Switch to JSONL for chat session storage](https://github.com/google-gemini/gemini-cli/issues/15292)
- [yoavf/ai-sessions - example session](https://github.com/yoavf/ai-sessions/blob/main/examples/gemini-cli-pomodoro-timer.json)
- [BrianV1981/aim - benchmark session](https://github.com/BrianV1981/aim/blob/main/docs/benchmarks/raw_logs/control_pro.json)
- [TwiTech-LAB/devchain - test fixture](https://github.com/TwiTech-LAB/devchain/blob/main/apps/local-app/src/modules/session-reader/__fixtures__/gemini-session.json)

---

## Examples

### Example 1: Simple session with user-only messages (bug report)

Source: [Issue #9042](https://github.com/google-gemini/gemini-cli/issues/9042)

```json
{
  "sessionId": "6177e929-af1f-4a1c-8d5b-c29075f4cba8",
  "projectHash": "cc373a68fc75bf40f11b2f9d17a7509a6c76c4c4a5ee8aa0e1494415a9cf7a77",
  "startTime": "2025-09-22T00:06:24.324Z",
  "lastUpdated": "2025-09-22T00:14:02.367Z",
  "messages": [
    {
      "id": "5dce8b99-6796-4bd1-b370-30660bdb12e6",
      "timestamp": "2025-09-22T00:06:24.324Z",
      "type": "user",
      "content": "During my tests, i found an error in the server logs. Can you try to fix it (this time, without running something in the browser)? The message was: <Server log was inserted here>"
    },
    {
      "id": "b582f277-7c4e-4e1c-ba9d-33925d5f0985",
      "timestamp": "2025-09-22T00:11:28.969Z",
      "type": "user",
      "content": "Well, this might seem to solve the issue, but then we get an issue later on. The answer from the request is parsed as json, and if we don't specify the response type as application/json, this might lead to problems. The message implies that function calling with response type application/json is not supported. Is there any documentation about how to call the gemini api with the possibility to call functions on one side and expecting the final result to be formatted in a defined json type on the other side? I understand that if a function is called then we won't get a json response, but instead the json is only available in the \"final\" result..."
    },
    {
      "id": "31c77aad-2316-4877-8a0d-77421bab2575",
      "timestamp": "2025-09-22T00:12:37.319Z",
      "type": "user",
      "content": "You were just trying to do the same thing you wanted to do in the last step, but didn't say anything about my questions..."
    },
    {
      "id": "5ebbf8e3-a1a2-4042-9ba7-1681137b1cce",
      "timestamp": "2025-09-22T00:14:02.367Z",
      "type": "user",
      "content": "Can you please do anything different than always giving the same proposal instead of answering my questions?"
    }
  ]
}
```

### Example 2: Session with thoughts and tokens (no tool calls -- bug)

Source: [Issue #10927](https://github.com/google-gemini/gemini-cli/issues/10927)

```json
{
  "sessionId": "2d930cce-6744-4551-a764-1a2d085b84f9",
  "projectHash": "a7a86deed79eae624f96947bf41d7fff47ef3939dc916d899817b2532bd7821d",
  "startTime": "2025-10-10T20:48:21.244Z",
  "lastUpdated": "2025-10-10T20:49:00.880Z",
  "messages": [
    {
      "id": "4442deb0-5157-4b1b-8126-e75402df2858",
      "timestamp": "2025-10-10T20:48:21.245Z",
      "type": "user",
      "content": "Use wc to count the lines in poem.md"
    },
    {
      "id": "90ac2c87-4640-4c0a-9875-c912c9038c7e",
      "timestamp": "2025-10-10T20:49:00.880Z",
      "type": "gemini",
      "content": "5 poem.md",
      "thoughts": [
        {
          "subject": "Defining the Command",
          "description": "I've realized I need to use `wc` to count lines, which requires a command string. The user wants the line count of `poem.md`, so I'll incorporate that file name into the command. The `run_shell_command` tool is the vehicle I'll use to execute this.",
          "timestamp": "2025-10-10T20:48:24.329Z"
        },
        {
          "subject": "Executing the Command",
          "description": "I've got the command figured out: `wc -l poem.md`. Using `wc` directly is the most straightforward route, and `-l` is key for line counting.  I'm ready to execute it with the `run_shell_command` tool.",
          "timestamp": "2025-10-10T20:48:25.751Z"
        }
      ],
      "tokens": {
        "input": 11578,
        "output": 4,
        "cached": 8155,
        "thoughts": 0,
        "tool": 0,
        "total": 11582
      },
      "model": "gemini-2.5-pro"
    }
  ]
}
```

### Example 3: Session with tool calls (write_file)

Source: [yoavf/ai-sessions](https://github.com/yoavf/ai-sessions/blob/main/examples/gemini-cli-pomodoro-timer.json)

```json
{
  "sessionId": "0b23371a-ce2e-4b1c-81a0-44af5d94d9ce",
  "projectHash": "2d33ff9193c39ffa4b8352af23f3b106d1ceaff756665e12408cb64657965d22",
  "startTime": "2025-10-21T20:04:20.819Z",
  "lastUpdated": "2025-10-21T20:08:49.642Z",
  "messages": [
    {
      "id": "922467ec-b0f6-484a-915d-87504ac57d92",
      "timestamp": "2025-10-21T20:04:20.819Z",
      "type": "user",
      "content": "Build a simple Pomodoro timer web app using HTML, CSS, and JavaScript...."
    },
    {
      "id": "e5679916-ec14-4bec-a6a3-53cf2b0e601b",
      "timestamp": "2025-10-21T20:04:39.638Z",
      "type": "gemini",
      "content": "Okay, I will build the Pomodoro timer.\n\nFirst, I'll create the `index.html`, `style.css`, and `script.js` files.",
      "thoughts": [
        {
          "subject": "Beginning the Build",
          "description": "\\n\\n\n\nI'm starting the Pomodoro timer project...",
          "timestamp": "2025-10-21T20:04:24.225Z"
        }
      ],
      "tokens": {
        "input": 0,
        "output": 0,
        "cached": 0,
        "thoughts": 0,
        "tool": 0,
        "total": 0
      },
      "model": "gemini-2.5-pro",
      "toolCalls": [
        {
          "id": "write_file-1761077079637-de5db03a65079",
          "name": "write_file",
          "args": {
            "content": "<!DOCTYPE html>...",
            "file_path": "/Users/yoavfarhi/dev/pomodoro/gemini/index.html"
          },
          "result": [
            {
              "functionResponse": {
                "id": "write_file-1761077079637-de5db03a65079",
                "name": "write_file",
                "response": {
                  "output": "Successfully created and wrote to new file: /Users/yoavfarhi/dev/pomodoro/gemini/index.html."
                }
              }
            }
          ],
          "status": "success",
          "timestamp": "2025-10-21T20:04:39.683Z",
          "displayName": "WriteFile",
          "description": "Writes content to a specified file...",
          "renderOutputAsMarkdown": true
        }
      ]
    }
  ]
}
```

### Example 4: Newer format with Part[] content (gemini-3.1-pro-preview)

Source: [BrianV1981/aim](https://github.com/BrianV1981/aim/blob/main/docs/benchmarks/raw_logs/control_pro.json)

```json
{
  "sessionId": "b36c9e17-99f8-4acf-b1b3-cef1081a98f6",
  "projectHash": "4aa4775945ced8117110c7783b5623297e21836cf04a6e1dba9fbfeecfc7fcc1",
  "startTime": "2026-03-26T04:33:40.572Z",
  "lastUpdated": "2026-03-26T04:47:42.450Z",
  "messages": [
    {
      "id": "3ef44a99-53fb-4d7b-af0c-90ba3080cb83",
      "timestamp": "2026-03-26T04:33:40.572Z",
      "type": "user",
      "content": [
        {
          "text": "hello"
        }
      ]
    },
    {
      "id": "5e27da1a-e265-4a86-bd31-bedb03eaa2ab",
      "timestamp": "2026-03-26T04:33:57.960Z",
      "type": "gemini",
      "content": "",
      "thoughts": [],
      "tokens": {
        "input": 8756,
        "output": 30,
        "cached": 0,
        "thoughts": 177,
        "tool": 0,
        "total": 8963
      },
      "model": "gemini-3.1-pro-preview",
      "toolCalls": [
        {
          "id": "read_file_1774499637888_0",
          "name": "read_file",
          "args": {
            "file_path": "/home/kingb/aim_benchmarks/django_control_pro/TASK.md"
          },
          "result": [
            {
              "functionResponse": {
                "id": "read_file_1774499637888_0",
                "name": "read_file",
                "response": {
                  "output": "# SWE-Bench Target (Proxy)\n..."
                }
              }
            }
          ],
          "status": "success",
          "timestamp": "2026-03-26T04:33:58.099Z",
          "resultDisplay": "",
          "description": "TASK.md",
          "displayName": "ReadFile",
          "renderOutputAsMarkdown": true
        }
      ]
    }
  ]
}
```

### Example 5: Test fixture with all message types

Source: [TwiTech-LAB/devchain](https://github.com/TwiTech-LAB/devchain/blob/main/apps/local-app/src/modules/session-reader/__fixtures__/gemini-session.json)

```json
{
  "sessionId": "gemini-test-session-001",
  "projectHash": "abc123def456789",
  "startTime": "2026-02-24T10:00:00.000Z",
  "lastUpdated": "2026-02-24T10:02:30.000Z",
  "messages": [
    {
      "id": "msg-user-001",
      "timestamp": "2026-02-24T10:00:05.000Z",
      "type": "user",
      "content": "Fix the bug in auth.ts"
    },
    {
      "id": "msg-gemini-001",
      "timestamp": "2026-02-24T10:00:10.000Z",
      "type": "gemini",
      "content": "I'll examine the auth.ts file to identify the bug.",
      "model": "gemini-2.5-pro",
      "thoughts": [
        {
          "subject": "Analyzing request",
          "description": "The user wants me to fix a bug in auth.ts. I should read the file first.",
          "timestamp": "2026-02-24T10:00:08.000Z"
        }
      ],
      "tokens": {
        "input": 450,
        "output": 85,
        "cached": 100,
        "thoughts": 30,
        "tool": 120,
        "total": 785
      },
      "toolCalls": [
        {
          "id": "call-gem-001",
          "name": "read_file",
          "args": { "target": "src/auth.ts" },
          "status": "success",
          "timestamp": "2026-02-24T10:00:12.000Z",
          "displayName": "Read File",
          "description": "Read the contents of a file",
          "result": [
            {
              "functionResponse": {
                "id": "call-gem-001",
                "name": "read_file",
                "response": {
                  "output": "export function validateToken(token: string) {\n  return token.length > 0;\n}"
                }
              }
            }
          ]
        }
      ]
    },
    {
      "id": "msg-info-001",
      "timestamp": "2026-02-24T10:02:00.000Z",
      "type": "info",
      "content": "Session checkpoint created"
    },
    {
      "id": "msg-gemini-003",
      "timestamp": "2026-02-24T10:02:25.000Z",
      "type": "gemini",
      "content": "You're welcome! The authentication should be more secure now.",
      "model": "gemini-2.5-pro",
      "tokens": {
        "input": 820,
        "output": 40,
        "cached": 350,
        "total": 1210
      }
    }
  ],
  "summary": "Fixed token validation bug in auth.ts by adding minimum length requirement",
  "kind": "main"
}
```
