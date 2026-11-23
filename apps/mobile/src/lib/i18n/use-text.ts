import { useIntl } from "react-intl";

/** A message by its full id, with its values when it takes any. */
export function useText() {
  const intl = useIntl();

  return (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
}
