import { readImportLink } from "@/lib/import-link";

import ImportLinkPrompt from "./components/import-link-prompt";

export default async function ImportPage({ searchParams }: PageProps<"/import">) {
  const { url, text } = await searchParams;

  return <ImportLinkPrompt link={readImportLink({ url, text })} />;
}
