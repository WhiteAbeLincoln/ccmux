// AskUserQuestion tool call rendered as a question form with selectable options.
// Top-level DisplayItem kind='ask-user-question'. Also exports the inner AskUserQuestionView
// for reuse, plus the AskUserQuestion type and parseAskUserAnswers helper.

import { For } from "solid-js";
import type { SessionMessage } from "../../lib/types";
import { getToolUseBlock } from "../../lib/session";
import MessageBlock from "./MessageBlock";
import styles from "../SessionView.module.css";

export function AskQuestionBlockView(props: {
  msg: SessionMessage;
  sessionId: string;
  toolResults: Map<string, { content: string; isError: boolean | null }>;
}) {
  const block = getToolUseBlock(props.msg, "AskUserQuestion")!;
  const input = block.input as { questions?: AskUserQuestion[] };
  const questions = input.questions ?? [];
  const result = props.toolResults.get(block.id);
  const answers = result
    ? parseAskUserAnswers(result.content)
    : new Map<string, string>();
  return (
    <MessageBlock
      variant="ask-user-question"
      role="ask-user-question"
      label="Question"
      sessionId={props.sessionId}
      uuid={props.msg.uuid}
    >
      <AskUserQuestionView questions={questions} answers={answers} />
    </MessageBlock>
  );
}

export interface AskUserQuestion {
  question: string;
  header: string;
  options: { label: string; description: string }[];
  multiSelect: boolean;
}

export function parseAskUserAnswers(
  resultContent: string,
): Map<string, string> {
  const answers = new Map<string, string>();
  const regex = /"([^"]+)"="([^"]+)"/g;
  let match;
  while ((match = regex.exec(resultContent)) !== null) {
    answers.set(match[1], match[2]);
  }
  return answers;
}

export default function AskUserQuestionView(props: {
  questions: AskUserQuestion[];
  answers: Map<string, string>;
}) {
  return (
    <div class={styles["ask-questions"]} data-component="ask-user-question">
      <For each={props.questions}>
        {(q) => {
          const answer = () => props.answers.get(q.question);
          return (
            <div
              class={styles["question-group"]}
              data-question={q.header}
              itemscope
              itemtype="https://schema.org/Question"
            >
              <div class={styles["question-header"]}>
                <span class={styles["question-badge"]} itemprop="name">
                  {q.header}
                </span>
                {q.multiSelect && (
                  <span class={styles["multi-badge"]}>multi</span>
                )}
              </div>
              <div class={styles["question-text"]} itemprop="text">
                {q.question}
              </div>
              <div class={styles["question-options"]}>
                <For each={q.options}>
                  {(opt) => {
                    const selected = () => answer() === opt.label;
                    return (
                      <div
                        class={styles["question-option"]}
                        classList={{ [styles["option-selected"]]: selected() }}
                        data-selected={selected() ? "true" : undefined}
                        itemscope
                        itemtype="https://schema.org/Answer"
                        itemprop={
                          selected() ? "acceptedAnswer" : "suggestedAnswer"
                        }
                      >
                        <span class={styles["option-indicator"]}>
                          {selected() ? "\u25CF" : "\u25CB"}
                        </span>
                        <div>
                          <span class={styles["option-label"]} itemprop="text">
                            {opt.label}
                          </span>
                          <span
                            class={styles["option-desc"]}
                            itemprop="description"
                          >
                            {opt.description}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
}
