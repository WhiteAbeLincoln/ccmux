// Bash tool call rendered as a syntax-highlighted command with collapsible output.
// Top-level DisplayItem kind='bash'. Also exports the HighlightedBash component.

import { createResource, Show } from "solid-js";
import { stripAnsi } from "../../lib/format";
import type { SessionMessage } from "../../lib/types";
import { getToolUseBlock, totalTokens } from "../../lib/session";
import { createHighlighter, type Highlighter } from "shiki";
import MessageBlock from "./MessageBlock";
import styles from "../SessionView.module.css";

let _highlighter: Promise<Highlighter> | null = null;
function getHighlighter(): Promise<Highlighter> {
  if (!_highlighter) {
    _highlighter = createHighlighter({
      themes: ["vitesse-dark", "vitesse-light"],
      langs: ["bash"],
    });
  }
  return _highlighter;
}

export function HighlightedBash(props: { code: string }) {
  const [html] = createResource(
    () => props.code,
    async (code) => {
      const hl = await getHighlighter();
      return hl.codeToHtml(code, {
        lang: "bash",
        themes: { dark: "vitesse-dark", light: "vitesse-light" },
        defaultColor: false,
      });
    },
  );
  return (
    <Show
      when={html()}
      fallback={
        <pre class={styles["bash-command"]}>
          <code>{props.code}</code>
        </pre>
      }
    >
      {(h) => <div class={styles["bash-command"]} innerHTML={h()} />}
    </Show>
  );
}

export default function BashBlockView(props: {
  msg: SessionMessage;
  sessionId: string;
  toolResults: Map<string, { content: string; isError: boolean | null }>;
  expanded: Set<string>;
  toggle: (key: string) => void;
}) {
  const block = getToolUseBlock(props.msg, "Bash")!;
  const input = block.input as { command?: string; description?: string };
  const command = input.command ?? "";
  const description = input.description ?? "";
  const result = props.toolResults.get(block.id);
  const outputKey = `${props.msg.uuid}-bash-output`;
  return (
    <MessageBlock
      variant="bash"
      role="bash"
      label="$"
      sessionId={props.sessionId}
      uuid={props.msg.uuid}
      extraMeta={
        <>
          <span class={styles["bash-desc"]}>{description}</span>
          <Show when={result?.isError}>
            <span class={styles["error-badge"]}>error</span>
          </Show>
        </>
      }
      rightMeta={
        <Show when={totalTokens(props.msg) !== null}>
          <span class={styles['internal-tokens']}>
            {totalTokens(props.msg)?.toLocaleString()} tok
          </span>
        </Show>
      }
    >
      <HighlightedBash code={command} />
      <Show when={result}>
        {(r) => (
          <div class={styles["bash-output-section"]}>
            <button
              class={styles.toggle}
              onClick={() => props.toggle(outputKey)}
            >
              {props.expanded.has(outputKey) ? "\u25BE" : "\u25B8"} Output
            </button>
            <Show when={props.expanded.has(outputKey)}>
              <pre
                class={styles["bash-output"]}
                classList={{ [styles["is-error"]]: !!r().isError }}
              >
                {stripAnsi(r().content)}
              </pre>
            </Show>
          </div>
        )}
      </Show>
    </MessageBlock>
  );
}
