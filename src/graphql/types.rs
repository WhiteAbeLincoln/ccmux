use async_graphql::{Enum, Json, Object, SimpleObject, Union};
use chrono::{DateTime, Utc};
use serde_json::Value;

use crate::session::types as st;

// --- Session log lines (paginated) ---

#[derive(SimpleObject)]
pub struct SessionLogLine {
    pub line_number: i32,
    pub content: String,
}

#[derive(SimpleObject)]
pub struct SessionLogLines {
    pub lines: Vec<SessionLogLine>,
    pub total_lines: i32,
}

// --- Session ---

#[derive(SimpleObject)]
pub struct Session {
    pub id: String,
    pub project: String,
    pub slug: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub message_count: i32,
    pub first_message: Option<String>,
    pub project_path: Option<String>,
    /// Absolute path to the session's .jsonl file on disk.
    pub file_path: Option<String>,
    pub is_sidechain: bool,
    pub parent_session_id: Option<String>,
    pub agent_id: Option<String>,
}

#[derive(SimpleObject)]
pub struct AgentMapping {
    pub tool_use_id: String,
    pub agent_id: String,
}

// --- Session messages ---

#[derive(SimpleObject)]
pub struct SessionMessage {
    pub uuid: String,
    pub parent_uuid: Option<String>,
    pub timestamp: DateTime<Utc>,
    pub event_type: EventType,
    pub cwd: Option<String>,
    pub git_branch: Option<String>,
    pub is_sidechain: Option<bool>,
    pub slug: Option<String>,
    /// For user events: the message content (either text or tool results)
    pub user_content: Option<UserContent>,
    /// For assistant events: the content blocks
    pub assistant_content: Option<AssistantContent>,
    /// For system events
    pub system_info: Option<SystemInfo>,
}

#[derive(Enum, Copy, Clone, Eq, PartialEq)]
pub enum EventType {
    User,
    Assistant,
    Progress,
    System,
    FileHistorySnapshot,
    QueueOperation,
}

// --- User content ---

#[derive(Union)]
pub enum UserContent {
    Text(UserTextContent),
    ToolResults(UserToolResults),
}

#[derive(SimpleObject)]
pub struct UserTextContent {
    pub text: String,
}

#[derive(SimpleObject)]
pub struct UserToolResults {
    pub results: Vec<ToolResult>,
}

#[derive(SimpleObject)]
pub struct ToolResult {
    pub tool_use_id: String,
    pub content: String,
    pub is_error: Option<bool>,
}

// --- Assistant content ---

#[derive(SimpleObject)]
pub struct AssistantContent {
    pub model: Option<String>,
    pub stop_reason: Option<String>,
    pub usage: Option<UsageInfo>,
    pub blocks: Vec<ContentBlock>,
}

#[derive(Union)]
pub enum ContentBlock {
    Text(TextBlock),
    Thinking(ThinkingBlock),
    ToolUse(ToolUseBlock),
    ToolResult(ToolResultBlock),
}

#[derive(SimpleObject)]
pub struct TextBlock {
    pub text: String,
}

#[derive(SimpleObject)]
pub struct ThinkingBlock {
    pub thinking: String,
}

pub struct ToolUseBlock {
    pub id: String,
    pub name: String,
    pub input: Value,
}

#[Object]
impl ToolUseBlock {
    async fn id(&self) -> &str {
        &self.id
    }

    async fn name(&self) -> &str {
        &self.name
    }

    async fn input(&self) -> Json<Value> {
        Json(self.input.clone())
    }
}

#[derive(SimpleObject)]
pub struct ToolResultBlock {
    pub tool_use_id: String,
    pub content: String,
    pub is_error: Option<bool>,
}

#[derive(SimpleObject)]
pub struct UsageInfo {
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub cache_creation_input_tokens: Option<i64>,
    pub cache_read_input_tokens: Option<i64>,
}

// --- System info ---

#[derive(SimpleObject)]
pub struct SystemInfo {
    pub subtype: Option<String>,
    pub duration_ms: Option<i64>,
}

// --- Conversion from session types ---

impl From<&crate::session::loader::SessionInfo> for Session {
    fn from(s: &crate::session::loader::SessionInfo) -> Self {
        Session {
            id: s.id.clone(),
            project: s.project.clone(),
            slug: s.slug.clone(),
            created_at: s.created_at,
            updated_at: s.updated_at,
            message_count: s.message_count as i32,
            first_message: s.first_message.clone(),
            project_path: s.project_path.clone(),
            file_path: Some(s.path.to_string_lossy().into_owned()),
            is_sidechain: s.is_sidechain,
            parent_session_id: s.parent_session_id.clone(),
            agent_id: s.agent_id.clone(),
        }
    }
}

pub fn event_to_message(event: &st::Event) -> Option<SessionMessage> {
    match event {
        st::Event::User(e) => {
            let user_content = if e.tool_use_result.is_some() {
                // Tool result message
                e.message.tool_results().map(|results| {
                    UserContent::ToolResults(UserToolResults {
                        results: results
                            .into_iter()
                            .map(|r| ToolResult {
                                tool_use_id: r.tool_use_id,
                                content: value_to_string(&r.content),
                                is_error: r.is_error,
                            })
                            .collect(),
                    })
                })
            } else {
                e.message.text().map(|t| {
                    UserContent::Text(UserTextContent {
                        text: t.to_string(),
                    })
                })
            };

            Some(SessionMessage {
                uuid: e.common.uuid.clone(),
                parent_uuid: e.common.parent_uuid.clone(),
                timestamp: e.common.timestamp,
                event_type: EventType::User,
                cwd: e.common.cwd.clone(),
                git_branch: e.common.git_branch.clone(),
                is_sidechain: e.common.is_sidechain,
                slug: e.common.slug.clone(),
                user_content,
                assistant_content: None,
                system_info: None,
            })
        }
        st::Event::Assistant(e) => {
            let blocks = e
                .message
                .content
                .iter()
                .map(|block| match block {
                    st::ContentBlock::Text(b) => ContentBlock::Text(TextBlock {
                        text: b.text.clone(),
                    }),
                    st::ContentBlock::Thinking(b) => {
                        ContentBlock::Thinking(ThinkingBlock {
                            thinking: b.thinking.clone(),
                        })
                    }
                    st::ContentBlock::ToolUse(b) => {
                        ContentBlock::ToolUse(ToolUseBlock {
                            id: b.id.clone(),
                            name: b.name.clone(),
                            input: b.input.clone(),
                        })
                    }
                    st::ContentBlock::ToolResult(b) => {
                        ContentBlock::ToolResult(ToolResultBlock {
                            tool_use_id: b.tool_use_id.clone(),
                            content: value_to_string(&b.content),
                            is_error: None,
                        })
                    }
                })
                .collect();

            let usage = e.message.usage.as_ref().map(|u| UsageInfo {
                input_tokens: u.input_tokens.map(|v| v as i64),
                output_tokens: u.output_tokens.map(|v| v as i64),
                cache_creation_input_tokens: u.cache_creation_input_tokens.map(|v| v as i64),
                cache_read_input_tokens: u.cache_read_input_tokens.map(|v| v as i64),
            });

            Some(SessionMessage {
                uuid: e.common.uuid.clone(),
                parent_uuid: e.common.parent_uuid.clone(),
                timestamp: e.common.timestamp,
                event_type: EventType::Assistant,
                cwd: e.common.cwd.clone(),
                git_branch: e.common.git_branch.clone(),
                is_sidechain: e.common.is_sidechain,
                slug: e.common.slug.clone(),
                user_content: None,
                assistant_content: Some(AssistantContent {
                    model: e.message.model.clone(),
                    stop_reason: e.message.stop_reason.clone(),
                    usage,
                    blocks,
                }),
                system_info: None,
            })
        }
        st::Event::System(e) => Some(SessionMessage {
            uuid: e.uuid.clone(),
            parent_uuid: e.parent_uuid.clone(),
            timestamp: e.timestamp,
            event_type: EventType::System,
            cwd: None,
            git_branch: None,
            is_sidechain: None,
            slug: None,
            user_content: None,
            assistant_content: None,
            system_info: Some(SystemInfo {
                subtype: e.subtype.clone(),
                duration_ms: e.duration_ms.map(|v| v as i64),
            }),
        }),
        // Skip progress, file-history-snapshot, queue-operation for now
        _ => None,
    }
}

fn value_to_string(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        other => other.to_string(),
    }
}
