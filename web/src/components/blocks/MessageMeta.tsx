import { Show } from "solid-js";
import { A } from "@solidjs/router";
import mb from "./MessageMeta.module.css";
import styles from "../SessionView.module.css";

export type MetaProps = {
  result?: { isError?: boolean | null };
  sessionId: string;
  uuid: string;
  tokens?: number;
};

export default function MessageMeta(props: MetaProps) {
  return (
    <span class={mb.meta}>
      <Show when={props.result?.isError}>
        <span class={styles["error-badge"]}>error</span>
      </Show>
      {/*<Show when={props.result && !props.result.isError}>
        <span class={styles["ok-badge"]}>done</span>
      </Show>*/}
      <Show when={props.tokens != null && props.tokens! > 0}>
        <span class={mb["tokens"]}>{props.tokens!.toLocaleString()} tok</span>
      </Show>
      <A class={mb.uuid} href={`/session/${props.sessionId}/raw#${props.uuid}`}>
        {props.uuid.slice(0, 8)}
      </A>
    </span>
  );
}
