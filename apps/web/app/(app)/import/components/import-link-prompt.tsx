"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { usePermissionsContext } from "@/context/permissions-context";
import { useRecipesMutations } from "@/hooks/recipes";
import { ArrowDownTrayIcon, SparklesIcon } from "@heroicons/react/16/solid";
import { Button, Card, toast } from "@heroui/react";
import { useTranslations } from "next-intl";

interface ImportLinkPromptProps {
  /** The recipe link that was sent here, or null when there was no usable one. */
  link: string | null;
  /** The reader's own bookmarklet sent this, so pressing it was the decision. */
  startAtOnce: boolean;
}

/**
 * Where a bookmarklet or share sheet lands. A link without the reader's private
 * code never imports by itself: any website can send a signed-in reader to this
 * address, so the import waits for a press here. The button takes focus, so
 * Return is enough.
 */
export default function ImportLinkPrompt({ link, startAtOnce }: ImportLinkPromptProps) {
  const t = useTranslations("common.import.link");
  const tActions = useTranslations("common.actions");
  const tPaste = useTranslations("common.import.paste");
  const router = useRouter();
  const { importRecipe, importRecipeWithAI } = useRecipesMutations();
  const { isAIEnabled } = usePermissionsContext();
  const [hasStarted, setHasStarted] = useState(false);

  const goToRecipes = () => router.replace("/");

  function startImport(url: string, withAI: boolean) {
    setHasStarted(true);
    (withAI ? importRecipeWithAI : importRecipe)(url);
    toast(tPaste(withAI ? "importingWithAI" : "importing"), {
      description: tPaste("inProgress"),
      variant: "default",
    });
    goToRecipes();
  }

  const shouldStartAtOnce = startAtOnce && link !== null;
  const startedAtOnceRef = useRef(false);
  const startLinkImport = useEffectEvent((url: string) => startImport(url, false));

  useEffect(() => {
    if (!shouldStartAtOnce || startedAtOnceRef.current) return;
    startedAtOnceRef.current = true;
    startLinkImport(link);
  }, [link, shouldStartAtOnce]);

  if (shouldStartAtOnce) {
    return <p className="text-muted mt-8 text-center text-sm">{tPaste("importing")}</p>;
  }

  return (
    <Card className="mx-auto mt-8 w-full max-w-lg">
      <Card.Header>
        <h1 className="text-lg font-semibold">{link ? t("title") : t("noLink")}</h1>
      </Card.Header>
      {link && (
        <Card.Content>
          <p className="text-muted line-clamp-3 text-sm break-all">{link}</p>
        </Card.Content>
      )}
      <Card.Footer className="flex flex-wrap justify-end gap-2">
        {link ? (
          <>
            <Button variant="tertiary" onPress={goToRecipes}>
              {tActions("cancel")}
            </Button>
            {isAIEnabled && (
              <Button
                isDisabled={hasStarted}
                variant="secondary"
                onPress={() => startImport(link, true)}
              >
                <SparklesIcon className="h-4 w-4" />
                {tActions("aiImport")}
              </Button>
            )}
            <Button
              // This one decision is the whole page, and Return should make it.
              // eslint-disable-next-line jsx-a11y-x/no-autofocus
              autoFocus
              isDisabled={hasStarted}
              variant="primary"
              onPress={() => startImport(link, false)}
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              {tActions("import")}
            </Button>
          </>
        ) : (
          <Button variant="primary" onPress={goToRecipes}>
            {t("goToRecipes")}
          </Button>
        )}
      </Card.Footer>
    </Card>
  );
}
