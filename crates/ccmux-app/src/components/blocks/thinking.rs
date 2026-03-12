use dioxus::prelude::*;

#[component]
pub fn ThinkingBlock(text: String) -> Element {
    let mut open = use_signal(|| false);

    rsx! {
        div { class: "thinking-block",
            div {
                class: "thinking-header",
                onclick: move |_| open.toggle(),
                span { class: "thinking-toggle",
                    if open() { "\u{25BE}" } else { "\u{25B8}" }
                }
                span { class: "thinking-label", "Thinking" }
            }
            if open() {
                div { class: "thinking-body",
                    pre { class: "thinking-text", "{text}" }
                }
            }
        }
    }
}
