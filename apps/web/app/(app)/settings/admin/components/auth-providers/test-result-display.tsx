"use client";

import type { TestResult } from "./types";

import { CheckIcon, XMarkIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

interface TestResultDisplayProps {
  result: TestResult | null;
}

export function TestResultDisplay({ result }: TestResultDisplayProps) {
  const t = useTranslations("settings.admin.authProviders.form");

  if (!result) return null;

  return (
    <div
      className={`flex items-center gap-2 rounded-lg p-2 ${
        result.success ? "bg-success-100 text-success-700" : "bg-danger-100 text-danger-700"
      }`}
    >
      {result.success ? <CheckIcon className="h-4 w-4" /> : <XMarkIcon className="h-4 w-4" />}
      {result.success ? t("testSuccess") : result.error}
    </div>
  );
}
