use dioxus::prelude::*;

#[component]
pub fn ThemeToggle() -> Element {
    let mut mode = use_signal(|| "system".to_string());

    // Read persisted theme from localStorage on mount (client-side only)
    use_effect(move || {
        let mut mode = mode;
        spawn(async move {
            let mut eval = document::eval(
                r#"
                const stored = localStorage.getItem("theme");
                dioxus.send(stored || "system");
                "#,
            );
            if let Ok(val) = eval.recv::<String>().await {
                mode.set(val);
            }
        });
    });

    // Apply theme whenever mode changes
    use_effect(move || {
        let m = mode.read().clone();
        spawn(async move {
            document::eval(&format!(
                r#"
                const m = {m:?};
                if (m === "system") {{
                    document.documentElement.removeAttribute("data-theme");
                }} else {{
                    document.documentElement.setAttribute("data-theme", m);
                }}
                localStorage.setItem("theme", m);
                "#
            ));
        });
    });

    rsx! {
        select {
            class: "theme-select",
            value: "{mode}",
            onchange: move |e| mode.set(e.value()),
            option { value: "system", "System" }
            option { value: "light", "Light" }
            option { value: "dark", "Dark" }
        }
    }
}
