use std::ops::Range;

// TODO: can we reduce allocations by borrowing strings from the log data?
// Will that be any more efficient - it means keeping the log file around but
// we're removing a ton of extraneous logs so that may be less efficient than
// just copying the relevant strings out and discarding the log file.
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EventSource {
    /// Some events are composites, so our normalized data model
    /// may use only part of a log line to represent an event. `json_path` is a JSONPath
    /// expression pointing to the part of the log line that corresponds to this event.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub json_path: Option<String>,
    /// The offset in the event stream pointing to the start of the log line.
    /// Only applies to append-only .jsonl logs
    /// Used to narrow down the source. If both `json_path` and `file_position`
    /// are present, then `json_path` refers to a path within the log line at `file_position`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_position: Option<usize>,
    /// The name of the file containing the event.
    pub file_name: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AgentEvent {
    // not all messages have a timestamp - notably
    // gemini tool results get added to the original tool call object
    // so the timestamp is the same as the tool call. Probably ok to duplicate
    // same for claude 'last-prompt' and 'file-history-snapshot' events
    pub timestamp: chrono::DateTime<chrono::Utc>,
    /// A list of sources that contributed to this event.
    /// Used to trace back to the original log lines that contributed to this event,
    /// and display them in the UI.
    pub event_source: Vec<EventSource>,
    /// Whether this message is a delta (part of a streaming response) or a complete message.
    /// This doesn't apply to all message types - e.g. tool calls are always complete
    // (the underlying harness may support outputting partial json, but that's not especially useful
    // to display to the user.)
    delta: bool,
    #[serde(flatten)]
    pub item: EventItem,
}

/// A common abstraction over the types of log events emitted
/// by our supported agents.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", content = "data")]
pub enum EventItem {
    UserMessage(UserMessage),
    AssistantMessage(AssistantMessage),
    Thinking(Thinking),
    ToolCall(ToolCall),
    ToolResult(ToolResult),
    // status updates for a tool call
    ToolProgress(ToolProgress),
}

/// A user message event, emitted when the user sends a message to the agent.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct UserMessage {
    content: String,
}

/// An message event from the agent intended to be displayed to the user.
/// This excludes tool calls, thinking, etc.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AssistantMessage {
    content: String,
}

/// A thinking event, containing the agent's internal dialog or reasoning
/// process. Not all harnesses log the thinking content -
/// Claude Code stopped logging them recently, and Codex may encrypt the content
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Thinking {
    content: String,
}

// We normalize tool calls as well
// This means we have to find a common data model but it means
// we can do more interesting things like having specific
// rendering for differet tool calls
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ToolCall {
    id: Option<String>,
    #[serde(flatten)]
    tool_call: ToolCallItem,
}

/// A normalized tool call event, emitted when the agent calls a tool.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "tool_kind", content = "data")]
pub enum ToolCallItem {
    ReadFile {
        file_path: String,
    },
    WriteFile {
        file_path: String,
        content: String,
    },
    ShellCommand {
        command: Vec<String>,
        cwd: Option<String>,
    },
    Subagent {
        agent_id: String,
        prompt: String,
    },
    Other {
        tool_name: String,
        arguments: serde_json::Value,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ToolResult {
    id: Option<String>,
    tool_call_id: Option<String>,
    duration: Option<chrono::Duration>,
    #[serde(flatten)]
    tool_result: ToolResultItem,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "tool_kind", content = "data")]
pub enum ToolResultItem {
    ReadFile {
        file_path: String,
        content: String,
        byte_range: Option<Range<usize>>,
        line_range: Option<Range<usize>>,
    },
    WriteFile {
        file_path: String,
    },
    ShellCommand {
        command: Vec<String>,
        stdout: String,
        stderr: String,
        exit_code: i32,
    },
    Other {
        tool_name: String,
        result: serde_json::Value,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ToolProgress {
    tool_call_id: Option<String>,
}
