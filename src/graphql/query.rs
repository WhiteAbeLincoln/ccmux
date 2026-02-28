use std::path::PathBuf;

use async_graphql::{Context, Object, Result};

use super::types::{event_to_message, Session, SessionMessage};
use crate::session::loader;

pub struct Query;

#[Object]
impl Query {
    /// List all discovered sessions, optionally filtered by project name.
    async fn sessions(
        &self,
        ctx: &Context<'_>,
        project: Option<String>,
    ) -> Result<Vec<Session>> {
        let base_path = ctx.data::<PathBuf>()?;
        let sessions = loader::discover_sessions(base_path)
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        let sessions: Vec<Session> = sessions
            .iter()
            .filter(|s| {
                project
                    .as_ref()
                    .map_or(true, |p| s.project.contains(p.as_str()))
            })
            .map(Session::from)
            .collect();

        Ok(sessions)
    }

    /// Get metadata for a single session by ID.
    async fn session_info(
        &self,
        ctx: &Context<'_>,
        id: String,
    ) -> Result<Option<Session>> {
        let base_path = ctx.data::<PathBuf>()?;
        let sessions = loader::discover_sessions(base_path)
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        Ok(sessions.iter().find(|s| s.id == id).map(Session::from))
    }

    /// Get the raw JSONL content of a session file.
    async fn session_raw_log(
        &self,
        ctx: &Context<'_>,
        id: String,
    ) -> Result<Option<String>> {
        let base_path = ctx.data::<PathBuf>()?;
        let sessions = loader::discover_sessions(base_path)
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        let Some(session_info) = sessions.iter().find(|s| s.id == id) else {
            return Ok(None);
        };

        let content = std::fs::read_to_string(&session_info.path)
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        Ok(Some(content))
    }

    /// Load a full session by ID, returning all messages.
    async fn session(
        &self,
        ctx: &Context<'_>,
        id: String,
    ) -> Result<Option<Vec<SessionMessage>>> {
        let base_path = ctx.data::<PathBuf>()?;
        let sessions = loader::discover_sessions(base_path)
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        let session_info = sessions.iter().find(|s| s.id == id);
        let Some(session_info) = session_info else {
            return Ok(None);
        };

        let events = loader::load_session(&session_info.path)
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        let messages: Vec<SessionMessage> =
            events.iter().filter_map(event_to_message).collect();

        Ok(Some(messages))
    }
}
