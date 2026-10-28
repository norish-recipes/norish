"use client";

import { CheckIcon, XMarkIcon } from "@heroicons/react/16/solid";

/** A Test connection's outcome: the success line, or the reason it failed. */
export function ConnectionTestResult({
  result,
  successLabel,
}: {
  result: { success: boolean; error?: string } | null | undefined;
  successLabel: string;
}) {
  if (!result) return null;

  return (
    <div
      role="status"
      className={`flex items-center gap-2 rounded-lg p-2 ${result.success ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
    >
      {result.success ? <CheckIcon className="h-4 w-4" /> : <XMarkIcon className="h-4 w-4" />}
      {result.success ? successLabel : result.error}
    </div>
  );
}
