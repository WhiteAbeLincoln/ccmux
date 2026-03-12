use ccmux_core::display::ToolResultData;
use dioxus::prelude::*;
use serde_json::Value;

#[component]
pub fn WebSearchView(input: Value, result: Option<ToolResultData>) -> Element {
    let query = input
        .get("query")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    // Parse structured result from raw content field
    let parsed = result.as_ref().and_then(|r| {
        let content_str = r.raw.get("content").and_then(|v| v.as_str())?;
        serde_json::from_str::<Value>(content_str).ok()
    });

    // results[0].content = [{title, url}, ...]
    // results[1] = summary string
    let links: Vec<(String, String)> = parsed
        .as_ref()
        .and_then(|v| v.get("results"))
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.first())
        .and_then(|first| first.get("content"))
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|item| {
                    let url = item.get("url").and_then(|v| v.as_str())?.to_string();
                    let title = item
                        .get("title")
                        .and_then(|v| v.as_str())
                        .unwrap_or(&url)
                        .to_string();
                    Some((title, url))
                })
                .collect()
        })
        .unwrap_or_default();

    let summary: Option<String> = parsed
        .as_ref()
        .and_then(|v| v.get("results"))
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.get(1))
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());

    // Fallback plain output
    let fallback_output = result.as_ref().and_then(|r| {
        if links.is_empty() && summary.is_none() {
            r.output
                .as_deref()
                .or(r.error.as_deref())
                .map(|s| s.to_string())
        } else {
            None
        }
    });

    let summary_open = use_signal(|| false);

    rsx! {
        div { class: "tool-details",
            if !query.is_empty() {
                div { class: "ws-query", "{query}" }
            }
            if !links.is_empty() {
                ul { class: "ws-links",
                    for (title, url) in links {
                        li {
                            a {
                                href: "{url}",
                                target: "_blank",
                                rel: "noopener noreferrer",
                                "{title}"
                            }
                        }
                    }
                }
            }
            if let Some(summary_text) = summary {
                div { class: "ws-summary-section",
                    button {
                        class: "ws-summary-toggle",
                        onclick: move |_| {
                            let open = *summary_open.read();
                            summary_open.clone().set(!open);
                        },
                        if *summary_open.read() { "\u{25BE} Summary" } else { "\u{25B8} Summary" }
                    }
                    if *summary_open.read() {
                        div { class: "ws-summary",
                            "{summary_text}"
                        }
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
