import React from "react";
import { useIntl } from "react-intl";

import { SettingsPage } from "../components/settings-page";

/** A settings sub-page its own ticket has not filled yet: the page with its title. */
export function SettingsPlaceholderScreen({
  titleId,
  testID,
}: {
  titleId: string;
  testID: string;
}) {
  const intl = useIntl();

  return <SettingsPage testID={testID} title={intl.formatMessage({ id: titleId })} />;
}
