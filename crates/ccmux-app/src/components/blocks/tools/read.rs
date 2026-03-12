use ccmux_core::display::{ToolResultData, format::strip_read_line_numbers};
use dioxus::prelude::*;
use serde_json::Value;

#[component]
pub fn ReadView(input: Value, result: Option<ToolResultData>) -> Element {
    let file_path = input
        .get("file_path")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    rsx! {
        div { class: "read-view",
            if !file_path.is_empty() {
                div { class: "read-filepath", "{file_path}" }
            }
            if let Some(res) = result {
                ReadResult { result: res }
            }
        }
    }
}

#[component]
fn ReadResult(result: ToolResultData) -> Element {
    let is_error = result.error.is_some();

    if is_error {
        let err = result.error.as_deref().unwrap_or("");
        return rsx! {
            pre { class: "read-content read-error", "{err}" }
        };
    }

    // Check if the raw content contains image data
    // raw is the tool_result item; its "content" field may be an array of parts
    if let Some(image_uri) = extract_image_uri(&result.raw) {
        return rsx! {
            div { class: "read-image",
                img { src: "{image_uri}", alt: "Read image result" }
            }
        };
    }

    let text = result.output.as_deref().unwrap_or("");
    let stripped = strip_read_line_numbers(text);

    if stripped.is_empty() {
        return rsx! {};
    }

    rsx! {
        pre { class: "read-content", "{stripped}" }
    }
}

fn extract_image_uri(raw: &Value) -> Option<String> {
    let content = raw.get("content")?.as_array()?;
    for item in content {
        if item.get("type").and_then(|v| v.as_str()) == Some("image") {
            let source = item.get("source")?;
            if source.get("type").and_then(|v| v.as_str()) == Some("base64") {
                let media_type = source.get("media_type").and_then(|v| v.as_str())?;
                let data = source.get("data").and_then(|v| v.as_str())?;
                return Some(format!("data:{media_type};base64,{data}"));
            }
        }
    }
    None
}
