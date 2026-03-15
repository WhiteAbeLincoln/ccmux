//! Markdown rendering for session data. Produces plain-text markdown
//! views suitable for consumption by AI agents.

use serde_json::Value;

use super::DisplayItem;

/// Input data for rendering the session list markdown view.
pub struct SessionListGroup {
    pub project: String,
    pub sessions: Vec<SessionListEntry>,
}

pub struct SessionListEntry {
    pub id: String,
    pub first_message: Option<String>,
    pub updated_at: Option<String>,
}

/// Render a list of sessions grouped by project as markdown.
pub fn render_session_list(groups: &[SessionListGroup]) -> String {
    let mut out = String::from("# Sessions\n");

    for group in groups {
        out.push_str(&format!("\n## {}\n\n", group.project));
        for session in &group.sessions {
            let label = session.first_message.as_deref().unwrap_or("(no message)");
            let timestamp = session.updated_at.as_deref().unwrap_or("");
            if timestamp.is_empty() {
                out.push_str(&format!("- [{}](/session/{}.md)\n", label, session.id));
            } else {
                out.push_str(&format!(
                    "- [{}](/session/{}.md) — {}\n",
                    label, session.id, timestamp
                ));
            }
        }
    }

    out
}

/// Generate a short label for a display item, used in bullet lists.
pub fn bullet_label(item: &DisplayItem) -> String {
    match item {
        DisplayItem::ToolUse { name, input, .. } => {
            let summary = tool_summary(name, input);
            if summary.is_empty() {
                name.clone()
            } else {
                format!("{name}: {summary}")
            }
        }
        DisplayItem::Thinking { .. } => "Thinking".to_string(),
        DisplayItem::Compaction { .. } => "Compaction".to_string(),
        DisplayItem::UserMessage { .. } => "User".to_string(),
        DisplayItem::AssistantMessage { .. } => "Assistant".to_string(),
        DisplayItem::TurnDuration { .. } => "Turn Duration".to_string(),
        DisplayItem::Other { .. } => "Event".to_string(),
    }
}

/// Extract a short summary from tool input for the bullet label.
fn tool_summary(name: &str, input: &Value) -> String {
    match name {
        "Bash" => input
            .get("command")
            .and_then(|v| v.as_str())
            .map(|s| {
                let truncated = if s.len() > 60 {
                    format!("{}...", &s[..s.floor_char_boundary(60)])
                } else {
                    s.to_string()
                };
                format!("`{truncated}`")
            })
            .unwrap_or_default(),
        "Read" | "Write" => input
            .get("file_path")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        "Edit" => input
            .get("file_path")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        "Grep" => input
            .get("pattern")
            .and_then(|v| v.as_str())
            .map(|s| format!("`{s}`"))
            .unwrap_or_default(),
        "Glob" => input
            .get("pattern")
            .and_then(|v| v.as_str())
            .map(|s| format!("`{s}`"))
            .unwrap_or_default(),
        "Agent" => input
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        _ => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_render_session_list_empty() {
        let result = render_session_list(&[]);
        assert_eq!(result, "# Sessions\n");
    }

    #[test]
    fn test_render_session_list_with_groups() {
        let groups = vec![SessionListGroup {
            project: "/Users/alice/myproject".to_string(),
            sessions: vec![SessionListEntry {
                id: "abc123".to_string(),
                first_message: Some("Fix auth bug".to_string()),
                updated_at: Some("2026-03-14 10:30".to_string()),
            }],
        }];
        let result = render_session_list(&groups);
        assert!(result.contains("## /Users/alice/myproject"));
        assert!(result.contains("[Fix auth bug](/session/abc123.md)"));
        assert!(result.contains("2026-03-14 10:30"));
    }

    #[test]
    fn test_bullet_label_bash() {
        let item = DisplayItem::ToolUse {
            name: "Bash".to_string(),
            tool_use_id: "t1".to_string(),
            input: serde_json::json!({"command": "ls src/"}),
            result: None,
            meta: Default::default(),
            raw: Value::Null,
            cursor: None,
        };
        assert_eq!(bullet_label(&item), "Bash: `ls src/`");
    }

    #[test]
    fn test_bullet_label_read() {
        let item = DisplayItem::ToolUse {
            name: "Read".to_string(),
            tool_use_id: "t1".to_string(),
            input: serde_json::json!({"file_path": "/src/main.rs"}),
            result: None,
            meta: Default::default(),
            raw: Value::Null,
            cursor: None,
        };
        assert_eq!(bullet_label(&item), "Read: /src/main.rs");
    }

    #[test]
    fn test_bullet_label_thinking() {
        let item = DisplayItem::Thinking {
            text: "let me think...".to_string(),
            meta: Default::default(),
            raw: Value::Null,
            cursor: None,
        };
        assert_eq!(bullet_label(&item), "Thinking");
    }

    #[test]
    fn test_bullet_label_grep() {
        let item = DisplayItem::ToolUse {
            name: "Grep".to_string(),
            tool_use_id: "t1".to_string(),
            input: serde_json::json!({"pattern": "fn main"}),
            result: None,
            meta: Default::default(),
            raw: Value::Null,
            cursor: None,
        };
        assert_eq!(bullet_label(&item), "Grep: `fn main`");
    }

    #[test]
    fn test_bullet_label_edit() {
        let item = DisplayItem::ToolUse {
            name: "Edit".to_string(),
            tool_use_id: "t1".to_string(),
            input: serde_json::json!({"file_path": "/src/lib.rs", "old_string": "foo", "new_string": "bar"}),
            result: None,
            meta: Default::default(),
            raw: Value::Null,
            cursor: None,
        };
        assert_eq!(bullet_label(&item), "Edit: /src/lib.rs");
    }

    #[test]
    fn test_bullet_label_compaction() {
        let item = DisplayItem::Compaction {
            content: "summary".to_string(),
            meta: Default::default(),
            raw: Value::Null,
            cursor: None,
        };
        assert_eq!(bullet_label(&item), "Compaction");
    }
}
