use ccmux_core::display::{ToolResultData, format::strip_ansi};
use dioxus::prelude::*;
use serde_json::Value;

#[component]
pub fn BashView(input: Value, result: Option<ToolResultData>) -> Element {
    let command = input
        .get("command")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let description = input
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    rsx! {
        div { class: "bash-view",
            if !description.is_empty() {
                div { class: "bash-description", "{description}" }
            }
            if !command.is_empty() {
                pre { class: "bash-command",
                    "$ "
                    code { "{command}" }
                }
            }
            if let Some(res) = result {
                BashResult { result: res }
            }
        }
    }
}

#[component]
fn BashResult(result: ToolResultData) -> Element {
    let is_error = result.error.is_some();

    let output_text = if let Some(err) = &result.error {
        strip_ansi(err)
    } else if let Some(out) = &result.output {
        strip_ansi(out)
    } else {
        String::new()
    };

    if output_text.is_empty() {
        return rsx! {};
    }

    rsx! {
        div { class: "bash-output-section",
            if is_error {
                span { class: "bash-error-badge", "ERROR" }
            }
            pre {
                class: if is_error { "bash-output bash-error" } else { "bash-output" },
                "{output_text}"
            }
        }
    }
}
