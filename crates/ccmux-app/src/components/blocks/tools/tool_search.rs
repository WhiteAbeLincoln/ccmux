use ccmux_core::display::ToolResultData;
use dioxus::prelude::*;
use serde_json::Value;

#[component]
pub fn ToolSearchView(input: Value, result: Option<ToolResultData>) -> Element {
    let query = input
        .get("query")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    // Parse structured result from raw content
    let parsed = result.as_ref().and_then(|r| {
        // Try to parse the content field of raw as JSON
        let content_str = r.raw.get("content").and_then(|v| v.as_str())?;
        serde_json::from_str::<Value>(content_str).ok()
    });

    let tools: Vec<String> = parsed
        .as_ref()
        .and_then(|v| v.get("matches"))
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    let total_deferred = parsed
        .as_ref()
        .and_then(|v| v.get("total_deferred_tools"))
        .and_then(|v| v.as_u64());

    // Fallback: if no structured result, show the raw output
    let fallback_output = result.as_ref().and_then(|r| {
        if tools.is_empty() {
            r.output
                .as_deref()
                .or(r.error.as_deref())
                .map(|s| s.to_string())
        } else {
            None
        }
    });

    rsx! {
        div { class: "tool-details",
            if !query.is_empty() {
                div { class: "ts-query", "{query}" }
            }
            if !tools.is_empty() {
                div { class: "ts-tools",
                    for tool in tools {
                        span { class: "ts-tool-badge", "{tool}" }
                    }
                    if let Some(n) = total_deferred {
                        span { class: "ts-total", "{n} deferred tools available" }
                    }
                }
            }
            if let Some(output) = fallback_output {
                div { class: "tool-section",
                    pre { "{output}" }
                }
            }
        }
    }
}
