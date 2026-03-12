use dioxus::prelude::*;

/// Render markdown content as HTML using pulldown-cmark.
#[component]
pub fn Prose(content: String) -> Element {
    let html = markdown_to_html(&content);

    rsx! {
        div {
            class: "prose",
            dangerous_inner_html: "{html}",
        }
    }
}

fn markdown_to_html(markdown: &str) -> String {
    use pulldown_cmark::{Options, Parser, html};

    let mut options = Options::empty();
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_TASKLISTS);

    let parser = Parser::new_ext(markdown, options);
    let mut html_output = String::new();
    html::push_html(&mut html_output, parser);

    #[cfg(not(target_arch = "wasm32"))]
    {
        html_output = apply_syntax_highlighting(&html_output);
    }

    html_output
}

/// Post-process HTML to replace `<pre><code class="language-X">...</code></pre>` blocks
/// with syntect-highlighted HTML.
#[cfg(not(target_arch = "wasm32"))]
fn apply_syntax_highlighting(html: &str) -> String {
    use ccmux_core::display::highlight::highlight_code;

    let mut result = String::with_capacity(html.len());
    let mut remaining = html;

    while let Some(pre_start) = remaining.find("<pre><code") {
        // Append everything before the <pre>
        result.push_str(&remaining[..pre_start]);
        remaining = &remaining[pre_start..];

        // Try to extract language from class="language-X"
        let after_pre_code = &remaining["<pre><code".len()..];
        let (lang, code_start) = if after_pre_code.starts_with(" class=\"language-") {
            let class_val_start = " class=\"language-".len();
            if let Some(quote_end) = after_pre_code[class_val_start..].find('"') {
                let lang = &after_pre_code[class_val_start..class_val_start + quote_end];
                let rest = &after_pre_code[class_val_start + quote_end + 1..];
                // rest should start with ">"
                if let Some(gt) = rest.find('>') {
                    (
                        lang.to_string(),
                        "<pre><code".len() + " class=\"language-".len() + quote_end + 1 + gt + 1,
                    )
                } else {
                    ("".to_string(), 0)
                }
            } else {
                ("".to_string(), 0)
            }
        } else {
            ("".to_string(), 0)
        };

        if lang.is_empty() || code_start == 0 {
            // No language tag — emit as-is and advance past the opening tag
            result.push_str("<pre><code");
            remaining = &remaining["<pre><code".len()..];
            continue;
        }

        // Find the closing </code></pre>
        let code_content_start = code_start;
        if let Some(close_offset) = remaining[code_content_start..].find("</code></pre>") {
            let encoded_code = &remaining[code_content_start..code_content_start + close_offset];
            let code = decode_html_entities(encoded_code);

            let highlighted = highlight_code(&code, &lang, "base16-ocean.dark");
            result.push_str(&highlighted);

            remaining = &remaining[code_content_start + close_offset + "</code></pre>".len()..];
        } else {
            // Malformed — emit as-is
            result.push_str("<pre><code");
            remaining = &remaining["<pre><code".len()..];
        }
    }

    result.push_str(remaining);
    result
}

/// Decode the minimal HTML entities that pulldown-cmark encodes in code blocks.
#[cfg(not(target_arch = "wasm32"))]
fn decode_html_entities(s: &str) -> String {
    s.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&#x27;", "'")
}
