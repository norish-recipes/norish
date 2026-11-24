import { useConfirm } from "@/hooks/use-confirm";
import { useText } from "@/lib/i18n/use-text";

import type { SettingsRowAction } from "../utils/row-actions";
import { settingsWrite } from "../utils/settings-write";

type ConfirmedWrite = {
  title: string;
  message: string;
  confirmLabelId: string;
  /** False asks a plain question: the confirm button is not styled destructive. */
  destructive?: boolean;
  send: () => unknown;
  /** Drops a repeat for the same key while one is in flight. */
  key?: string;
};

/** A Settings write behind the native confirm: hands back the press that asks, then writes. */
export function useConfirmedWrite() {
  const confirm = useConfirm();

  return ({ send, key, ...ask }: ConfirmedWrite) =>
    () =>
      confirm({
        ...ask,
        onConfirm: key === undefined ? settingsWrite(send) : settingsWrite(send, key),
      });
}

/** A row's Delete behind the confirm whose title, message and confirmButton are under `modal`;
 * a repeat for the same `id` is dropped while one is in flight. */
export function useDeleteAction() {
  const text = useText();
  const confirmedWrite = useConfirmedWrite();

  return ({
    modal,
    id,
    send,
  }: {
    modal: string;
    id: string;
    send: () => Promise<unknown>;
  }): SettingsRowAction => ({
    kind: "delete",
    label: text("common.actions.delete"),
    onPress: confirmedWrite({
      title: text(`${modal}.title`),
      message: text(`${modal}.message`),
      confirmLabelId: `${modal}.confirmButton`,
      send,
      key: `delete:${id}`,
    }),
  });
}
