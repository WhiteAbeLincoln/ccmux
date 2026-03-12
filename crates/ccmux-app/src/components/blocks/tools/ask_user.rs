use ccmux_core::display::ToolResultData;
use dioxus::prelude::*;
use serde_json::Value;

#[component]
pub fn AskUserView(input: Value, result: Option<ToolResultData>) -> Element {
    let questions: Vec<Value> = input
        .get("questions")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    // Parse answers from tool_use_result.answers
    let answers: Value = result
        .as_ref()
        .and_then(|r| r.tool_use_result.as_ref())
        .and_then(|v| v.get("answers"))
        .cloned()
        .unwrap_or(Value::Null);

    rsx! {
        div { class: "ask-questions",
            for q in questions {
                QuestionView { question: q, answers: answers.clone() }
            }
        }
    }
}

#[component]
fn QuestionView(question: Value, answers: Value) -> Element {
    let header = question
        .get("header")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let question_text = question
        .get("question")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let multi_select = question
        .get("multiSelect")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let options: Vec<Value> = question
        .get("options")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let answer = answers
        .get(&question_text)
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    rsx! {
        div { class: "question-group",
            div { class: "question-header",
                span { class: "question-badge", "{header}" }
                if multi_select {
                    span { class: "question-multi-badge", "multi" }
                }
            }
            div { class: "question-text", "{question_text}" }
            div { class: "question-options",
                for opt in options {
                    OptionView { option: opt, selected_answer: answer.clone() }
                }
            }
        }
    }
}

#[component]
fn OptionView(option: Value, selected_answer: String) -> Element {
    let label = option
        .get("label")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let desc = option
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let selected = selected_answer == label;

    rsx! {
        div {
            class: if selected { "question-option option-selected" } else { "question-option" },
            span { class: "question-option-indicator",
                if selected { "\u{25CF}" } else { "\u{25CB}" }
            }
            div {
                span { class: "question-option-label", "{label}" }
                if !desc.is_empty() {
                    span { class: "question-option-desc", "{desc}" }
                }
            }
        }
    }
}
