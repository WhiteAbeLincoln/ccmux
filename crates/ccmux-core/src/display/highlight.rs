/// Map file extensions to syntect language names.
pub fn ext_to_lang(ext: &str) -> &str {
    match ext {
        // Web
        "ts" | "mts" | "cts" => "TypeScript",
        "tsx" => "TypeScript",
        "js" | "mjs" | "cjs" => "JavaScript",
        "jsx" => "JavaScript",
        "css" => "CSS",
        "scss" => "SCSS",
        "html" | "htm" => "HTML",
        // Systems
        "rs" => "Rust",
        "go" => "Go",
        "c" | "h" => "C",
        "cpp" | "cc" | "cxx" | "hpp" => "C++",
        // Scripting
        "py" | "pyw" => "Python",
        "rb" => "Ruby",
        "lua" => "Lua",
        "sh" | "bash" | "zsh" => "Bash",
        "php" => "PHP",
        // JVM
        "java" => "Java",
        "kt" | "kts" => "Kotlin",
        "scala" => "Scala",
        "groovy" | "gradle" => "Groovy",
        "clj" => "Clojure",
        // .NET
        "cs" => "C#",
        "fs" => "F#",
        // Data / config
        "json" => "JSON",
        "yaml" | "yml" => "YAML",
        "toml" => "TOML",
        "xml" => "XML",
        "ini" => "INI",
        // Markup / docs
        "md" | "markdown" => "Markdown",
        "tex" => "LaTeX",
        // Query
        "sql" => "SQL",
        "graphql" | "gql" => "GraphQL",
        // Infra
        "tf" | "hcl" => "HCL",
        "nix" => "Nix",
        // Other
        "swift" => "Swift",
        "r" => "R",
        "hs" => "Haskell",
        "ml" | "mli" => "OCaml",
        "proto" => "Protocol Buffer",
        "dockerfile" => "Dockerfile",
        "makefile" => "Makefile",
        "diff" | "patch" => "Diff",
        "perl" | "pl" => "Perl",
        _ => "",
    }
}

/// Map language info strings (as used in markdown fences) to syntect syntax names.
pub fn lang_to_syntax_name(lang: &str) -> &str {
    match lang.to_lowercase().as_str() {
        "typescript" | "ts" => "TypeScript",
        "tsx" => "TypeScript",
        "javascript" | "js" => "JavaScript",
        "jsx" => "JavaScript",
        "css" => "CSS",
        "scss" => "SCSS",
        "html" => "HTML",
        "rust" | "rs" => "Rust",
        "go" | "golang" => "Go",
        "c" => "C",
        "cpp" | "c++" => "C++",
        "python" | "py" => "Python",
        "ruby" | "rb" => "Ruby",
        "lua" => "Lua",
        "bash" | "sh" | "shell" | "zsh" => "Bash",
        "php" => "PHP",
        "java" => "Java",
        "kotlin" | "kt" => "Kotlin",
        "scala" => "Scala",
        "groovy" => "Groovy",
        "clojure" | "clj" => "Clojure",
        "csharp" | "cs" | "c#" => "C#",
        "fsharp" | "fs" | "f#" => "F#",
        "json" => "JSON",
        "yaml" | "yml" => "YAML",
        "toml" => "TOML",
        "xml" => "XML",
        "ini" => "INI",
        "markdown" | "md" => "Markdown",
        "latex" | "tex" => "LaTeX",
        "sql" => "SQL",
        "graphql" | "gql" => "GraphQL",
        "hcl" | "terraform" | "tf" => "HCL",
        "nix" => "Nix",
        "swift" => "Swift",
        "r" => "R",
        "haskell" | "hs" => "Haskell",
        "ocaml" | "ml" => "OCaml",
        "protobuf" | "proto" => "Protocol Buffer",
        "dockerfile" => "Dockerfile",
        "makefile" => "Makefile",
        "diff" | "patch" => "Diff",
        "perl" | "pl" => "Perl",
        _ => "",
    }
}

#[cfg(not(target_arch = "wasm32"))]
static SS: std::sync::OnceLock<syntect::parsing::SyntaxSet> = std::sync::OnceLock::new();
#[cfg(not(target_arch = "wasm32"))]
static TS: std::sync::OnceLock<syntect::highlighting::ThemeSet> = std::sync::OnceLock::new();

#[cfg(not(target_arch = "wasm32"))]
pub fn highlight_code(code: &str, language: &str, theme_name: &str) -> String {
    use syntect::easy::HighlightLines;
    use syntect::html::{IncludeBackground, styled_line_to_highlighted_html};
    use syntect::util::LinesWithEndings;

    let ss = SS.get_or_init(syntect::parsing::SyntaxSet::load_defaults_newlines);
    let ts = TS.get_or_init(syntect::highlighting::ThemeSet::load_defaults);

    let syntax_name = lang_to_syntax_name(language);
    let syntax = if syntax_name.is_empty() {
        ss.find_syntax_plain_text()
    } else {
        ss.find_syntax_by_name(syntax_name)
            .unwrap_or_else(|| ss.find_syntax_plain_text())
    };

    let theme = ts
        .themes
        .get(theme_name)
        .or_else(|| ts.themes.get("base16-ocean.dark"))
        .unwrap_or_else(|| ts.themes.values().next().expect("at least one theme"));

    let mut highlighter = HighlightLines::new(syntax, theme);
    let mut html = String::new();

    // Get background color from theme for the pre element
    let bg = theme
        .settings
        .background
        .map(|c| format!("#{:02x}{:02x}{:02x}", c.r, c.g, c.b))
        .unwrap_or_else(|| "#1b2b34".to_string());

    html.push_str(&format!(
        r#"<pre class="syntect-highlight" style="background:{bg};padding:0.75rem;border-radius:6px;overflow-x:auto;margin:0.75rem 0"><code>"#
    ));

    for line in LinesWithEndings::from(code) {
        let ranges = highlighter.highlight_line(line, ss).unwrap_or_default();
        let line_html =
            styled_line_to_highlighted_html(&ranges[..], IncludeBackground::No).unwrap_or_default();
        html.push_str(&line_html);
    }

    html.push_str("</code></pre>");
    html
}
