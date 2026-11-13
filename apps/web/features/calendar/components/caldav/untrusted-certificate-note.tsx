"use client";

import { ActionButton } from "@/components/shared/action-button";
import { Note } from "@/components/shared/note";
import { useTranslations } from "next-intl";

import type { UntrustedCertificate } from "@norish/shared/contracts";

interface UntrustedCertificateNoteProps {
  certificate: UntrustedCertificate;
  isPending: boolean;
  onTrust: () => void;
}

/** A test refused only because nothing vouches for the server's certificate: offer to trust it. */
export function UntrustedCertificateNote({
  certificate,
  isPending,
  onTrust,
}: UntrustedCertificateNoteProps) {
  const t = useTranslations("settings.caldav.setup.untrustedCertificate");

  return (
    <Note status="warning" title={t("title")}>
      <p className="mb-2">{t("description", { name: certificate.name })}</p>
      <p className="mb-1">{t("fingerprint")}</p>
      <p className="mb-3 font-mono text-xs break-all">{certificate.fingerprint}</p>
      <ActionButton action="apply" isPending={isPending} onPress={onTrust}>
        {t("trust")}
      </ActionButton>
    </Note>
  );
}
