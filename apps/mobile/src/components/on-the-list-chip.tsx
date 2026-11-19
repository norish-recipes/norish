import React from "react";
import { useIntl } from "react-intl";

import { Pill } from "./pill";

/** A kept food that still has a grocery to buy: handled, so nobody adds it twice. */
export function OnTheListChip({ testID = "on-the-list" }: { testID?: string }) {
  const intl = useIntl();

  return (
    <Pill size="tag" testID={testID} tone="active">
      {intl.formatMessage({ id: "groceries.pantry.onTheList" })}
    </Pill>
  );
}
