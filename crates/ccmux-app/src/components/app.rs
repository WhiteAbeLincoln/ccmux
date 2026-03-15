use dioxus::prelude::*;

use crate::components::theme_toggle::ThemeToggle;
use crate::routes::Route;

/// Shared context for session-specific nav items.
/// SessionView sets the session_id; AppLayout reads it to render nav elements.
#[derive(Clone, Copy)]
pub struct NavContext {
    pub session_id: Signal<Option<String>>,
    pub project_path: Signal<Option<String>>,
    pub global_raw: Signal<bool>,
}

#[component]
pub fn AppLayout() -> Element {
    let session_id = use_signal(|| None::<String>);
    let project_path = use_signal(|| None::<String>);
    let mut global_raw = use_signal(|| false);
    use_context_provider(|| NavContext {
        session_id,
        project_path,
        global_raw,
    });

    let in_session = session_id.read().is_some();

    rsx! {
        nav { class: "app-nav",
            if in_session {
                Link {
                    class: "session-back-link",
                    to: Route::SessionList {},
                    title: "Back",
                    "\u{2190}"
                }
            }
            span {
                class: "nav-home",
                if let Some(sid) = session_id.read().as_ref() {
                    "Session {sid}"
                    if let Some(path) = project_path.read().as_ref() {
                        " \u{2014} {path}"
                    }
                } else {
                    "ccmux"
                }
            }
            if in_session {
                button {
                    class: if global_raw() { "toggle-button active" } else { "toggle-button" },
                    onclick: move |_| {
                        global_raw.toggle();
                    },
                    "Raw"
                }
            }
            ThemeToggle {}
        }
        main { class: "app-main",
            Outlet::<Route> {}
        }
    }
}
