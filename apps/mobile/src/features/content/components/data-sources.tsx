import type { ReactNode } from "react";
import React from "react";
import { Text } from "react-native";
import { Card, CardRow } from "@/components/card";
import { Section } from "@/components/section";
import { SheetNote } from "@/components/sheet-note";
import { useText } from "@/lib/i18n/use-text";
import * as WebBrowser from "expo-web-browser";
import { FormattedMessage } from "react-intl";

import { DATA_SOURCE_LINKS } from "@norish/shared-react/ingredients";
import { useConnectivity } from "@norish/shared-react/offline/react";

import { useCatalogueExport } from "../hooks/use-catalogue-export";

function SourceLink({ url, children }: { url: string; children: ReactNode }) {
  return (
    <Text
      accessibilityRole="link"
      className="text-accent-text"
      onPress={() => void WebBrowser.openBrowserAsync(url)}
    >
      {children}
    </Text>
  );
}

/** One notice, each tag of its message a link to the source it names, opened in the in-app browser. */
function Notice({ notice }: { notice: keyof typeof DATA_SOURCE_LINKS }) {
  const links = Object.entries(DATA_SOURCE_LINKS[notice]).map(
    ([tag, url]) =>
      [tag, (chunks: ReactNode[]) => <SourceLink url={url}>{chunks}</SourceLink>] as const
  );

  return (
    <SheetNote testID={`data-sources-${notice}`}>
      <FormattedMessage
        id={`settings.ingredients.dataSources.${notice}`}
        values={Object.fromEntries(links)}
      />
    </SheetNote>
  );
}

/** Under the Ingredients list: the credits Open Food Facts' licence and the nutrition datasets ask
 * for, and the catalogue as a file to share. */
export function DataSources() {
  const text = useText();
  const { isOffline } = useConnectivity();
  const { busy, download } = useCatalogueExport();

  return (
    <Section title={text("settings.ingredients.dataSources.title")}>
      <Notice notice="notice" />
      <Notice notice="nutritionNotice" />
      <Card>
        <CardRow
          first
          chevron={false}
          disabled={isOffline || busy}
          icon="download-outline"
          label={text("settings.ingredients.dataSources.download")}
          testID="catalogue-export"
          onPress={() => void download()}
        />
      </Card>
      {isOffline ? (
        <SheetNote>{text("settings.ingredients.dataSources.downloadOffline")}</SheetNote>
      ) : null}
    </Section>
  );
}
