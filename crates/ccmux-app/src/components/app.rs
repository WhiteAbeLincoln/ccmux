use dioxus::prelude::*;

use crate::components::theme_toggle::ThemeToggle;
use crate::routes::Route;

#[component]
pub fn AppLayout() -> Element {
    rsx! {
        nav { class: "app-nav",
            Link { to: Route::SessionList {}, class: "nav-home", "ccmux" }
            ThemeToggle {}
        }
        main { class: "app-main",
            Outlet::<Route> {}
        }
    }
}
