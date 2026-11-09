import { readImportLink } from "@/lib/import-link";
import { readRequestProfile } from "@/lib/request-profile";

import { isImportLinkCode } from "@norish/config/crypto";

import ImportLinkPrompt from "./components/import-link-prompt";

export default async function ImportPage({ searchParams }: PageProps<"/import">) {
  const [{ url, text, code }, { userId }] = await Promise.all([searchParams, readRequestProfile()]);
  const hasValidCode = typeof code === "string" && !!userId && isImportLinkCode(userId, code);

  return <ImportLinkPrompt link={readImportLink({ url, text })} startAtOnce={hasValidCode} />;
}
