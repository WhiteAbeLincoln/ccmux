/// Strip ANSI escape codes from a string.
pub fn strip_ansi(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '\x1b' {
            match chars.peek() {
                Some(&'[') => {
                    // CSI sequence: consume until ASCII alphabetic terminator
                    chars.next();
                    for c in chars.by_ref() {
                        if c.is_ascii_alphabetic() {
                            break;
                        }
                    }
                }
                Some(&']') => {
                    // OSC sequence: consume until BEL (\x07) or ST (\x1b\)
                    chars.next();
                    loop {
                        match chars.next() {
                            None => break,
                            Some('\x07') => break,
                            Some('\x1b') => {
                                // ST is ESC followed by backslash
                                if chars.peek() == Some(&'\\') {
                                    chars.next();
                                }
                                break;
                            }
                            Some(_) => {}
                        }
                    }
                }
                _ => {
                    // Bare ESC or unrecognized sequence: consume the ESC only
                }
            }
        } else {
            result.push(ch);
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_ansi_basic() {
        assert_eq!(strip_ansi("\x1b[31mred\x1b[0m"), "red");
        assert_eq!(strip_ansi("no ansi here"), "no ansi here");
        assert_eq!(strip_ansi("\x1b[1;32mbold green\x1b[0m"), "bold green");
    }

    #[test]
    fn test_strip_ansi_empty() {
        assert_eq!(strip_ansi(""), "");
    }

    #[test]
    fn test_strip_ansi_lone_esc() {
        assert_eq!(strip_ansi("\x1b"), "");
    }

    #[test]
    fn test_strip_ansi_osc_bel() {
        assert_eq!(strip_ansi("\x1b]0;title\x07rest"), "rest");
    }

    #[test]
    fn test_strip_ansi_osc_st() {
        assert_eq!(strip_ansi("\x1b]0;title\x1b\\rest"), "rest");
    }

    #[test]
    fn test_strip_ansi_mixed() {
        assert_eq!(
            strip_ansi("before\x1b[31merror\x1b[0mmiddle\x1b]0;title\x07after"),
            "beforeerrormiddleafter"
        );
    }
}
