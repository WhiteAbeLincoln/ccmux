use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::Value;

/// Top-level event from a JSONL log line, discriminated by `type` field.
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum Event {
    User(UserEvent),
    Assistant(AssistantEvent),
    Progress(ProgressEvent),
    System(SystemEvent),
    FileHistorySnapshot(FileHistorySnapshotEvent),
    QueueOperation(QueueOperationEvent),
}

impl Event {
    pub fn timestamp(&self) -> Option<&DateTime<Utc>> {
        match self {
            Event::User(e) => Some(&e.common.timestamp),
            Event::Assistant(e) => Some(&e.common.timestamp),
            Event::Progress(e) => Some(&e.common.timestamp),
            Event::System(e) => Some(&e.timestamp),
            Event::FileHistorySnapshot(_) => None,
            Event::QueueOperation(e) => e.timestamp.as_ref(),
        }
    }

    pub fn session_id(&self) -> Option<&str> {
        match self {
            Event::User(e) => Some(&e.common.session_id),
            Event::Assistant(e) => Some(&e.common.session_id),
            Event::Progress(e) => Some(&e.common.session_id),
            Event::System(e) => Some(&e.session_id),
            Event::FileHistorySnapshot(_) => None,
            Event::QueueOperation(e) => Some(&e.session_id),
        }
    }
}

/// Fields shared across user, assistant, and progress events.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommonFields {
    pub uuid: String,
    pub parent_uuid: Option<String>,
    pub session_id: String,
    pub timestamp: DateTime<Utc>,
    pub version: Option<String>,
    pub cwd: Option<String>,
    pub git_branch: Option<String>,
    pub is_sidechain: Option<bool>,
    pub user_type: Option<String>,
    pub slug: Option<String>,
}

// --- User events ---

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserEvent {
    #[serde(flatten)]
    pub common: CommonFields,
    pub message: UserMessage,
    pub tool_use_result: Option<Value>,
    pub source_tool_assistant_uuid: Option<String>,
    pub permission_mode: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserMessage {
    pub role: String,
    /// Either a plain string (user input) or an array of tool_result blocks.
    /// Stored as Value to avoid serde flatten+untagged conflicts.
    pub content: Value,
}

impl UserMessage {
    /// Returns the text content if this is a plain user message.
    pub fn text(&self) -> Option<&str> {
        self.content.as_str()
    }

    /// Returns tool result blocks if this is a tool result message.
    pub fn tool_results(&self) -> Option<Vec<ToolResultBlock>> {
        let arr = self.content.as_array()?;
        arr.iter()
            .map(|v| serde_json::from_value(v.clone()).ok())
            .collect()
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolResultBlock {
    #[serde(rename = "type")]
    pub block_type: String,
    pub tool_use_id: String,
    pub content: Value,
    pub is_error: Option<bool>,
}

// --- Assistant events ---

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssistantEvent {
    #[serde(flatten)]
    pub common: CommonFields,
    pub message: AssistantMessage,
    pub request_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssistantMessage {
    pub role: String,
    pub model: Option<String>,
    pub id: Option<String>,
    pub content: Vec<ContentBlock>,
    pub stop_reason: Option<String>,
    pub usage: Option<Usage>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentBlock {
    Thinking(ThinkingBlock),
    Text(TextBlock),
    ToolUse(ToolUseBlock),
    ToolResult(ToolResultContentBlock),
}

#[derive(Debug, Clone, Deserialize)]
pub struct ThinkingBlock {
    pub thinking: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TextBlock {
    pub text: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ToolUseBlock {
    pub id: String,
    pub name: String,
    pub input: Value,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ToolResultContentBlock {
    pub tool_use_id: String,
    pub content: Value,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Usage {
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub cache_creation_input_tokens: Option<u64>,
    pub cache_read_input_tokens: Option<u64>,
}

// --- Progress events ---

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    #[serde(flatten)]
    pub common: CommonFields,
    pub data: Value,
    pub tool_use_id: Option<String>,
    pub parent_tool_use_id: Option<String>,
}

// --- System events ---

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemEvent {
    pub uuid: String,
    pub parent_uuid: Option<String>,
    pub session_id: String,
    pub timestamp: DateTime<Utc>,
    pub subtype: Option<String>,
    pub duration_ms: Option<u64>,
    pub is_meta: Option<bool>,
}

// --- File history snapshot ---

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileHistorySnapshotEvent {
    pub message_id: String,
    pub snapshot: Value,
    pub is_snapshot_update: Option<bool>,
}

// --- Queue operation ---

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueOperationEvent {
    pub operation: String,
    pub session_id: String,
    pub timestamp: Option<DateTime<Utc>>,
    pub content: Option<String>,
}
