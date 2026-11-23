import { useIntl } from "react-intl";

/** A message by its id, for messages that take no values. */
export function useText() {
  const intl = useIntl();

  return (id: string) => intl.formatMessage({ id });
}
