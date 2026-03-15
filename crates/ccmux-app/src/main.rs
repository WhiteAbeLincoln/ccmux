mod components;
mod routes;
mod server_fns;

use dioxus::prelude::*;
use routes::Route;

fn main() {
    dioxus::launch(App);
}

static MAIN_CSS: Asset = asset!("/assets/style.scss");

#[component]
fn App() -> Element {
    rsx! {
        document::Stylesheet { href: MAIN_CSS }
        Router::<Route> {}
    }
}
