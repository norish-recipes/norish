"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader, Input, Button } from "@heroui/react";
import { PaintBrushIcon, CheckIcon, ExclamationCircleIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import { useAdminSettingsContext } from "../context";

/**
 * Validates if a URL is a valid HTTPS URL or localhost
 */
function isValidCssUrl(url: string): boolean {
  if (!url) return true; // Empty is valid
  try {
    const urlObj = new URL(url);
    const isLocalhost = urlObj.hostname === "localhost" || urlObj.hostname === "127.0.0.1";
    return urlObj.protocol === "https:" || isLocalhost;
  } catch {
    return false;
  }
}

export default function ThemeConfigCard() {
  const t = useTranslations("settings.admin.theme");
  const { themeConfig, updateThemeConfig, testThemeCss } = useAdminSettingsContext();

  const [cssUrl, setCssUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: "success" | "error" | null;
    message: string;
  }>({ status: null, message: "" });

  // Sync local state with context
  useEffect(() => {
    setCssUrl(themeConfig?.cssUrl || "");
  }, [themeConfig?.cssUrl]);

  const handleTest = async () => {
    if (!cssUrl) {
      setTestResult({
        status: "error",
        message: t("errors.emptyUrl"),
      });
      return;
    }

    if (!isValidCssUrl(cssUrl)) {
      setTestResult({
        status: "error",
        message: t("errors.https"),
      });
      return;
    }

    setTesting(true);
    setTestResult({ status: null, message: "" });

    try {
      const result = await testThemeCss(cssUrl);

      setTestResult({
        status: result.success ? "success" : "error",
        message: result.success ? t("testSuccess") : result.error || t("errors.testFailed"),
      });
    } catch (error) {
      setTestResult({
        status: "error",
        message: error instanceof Error ? error.message : t("errors.testFailed"),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateThemeConfig({
        cssUrl: cssUrl || null,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await updateThemeConfig({ cssUrl: null });
      setCssUrl("");
      setTestResult({ status: null, message: "" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <PaintBrushIcon className="h-5 w-5" />
          {t("title")}
        </h2>
      </CardHeader>
      <CardBody className="gap-6">
        <p className="text-default-500 text-base">{t("description")}</p>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium">{t("cssUrlLabel")}</label>
            <Input
              aria-label={t("cssUrlLabel")}
              classNames={{
                input: "text-sm",
              }}
              errorMessage={!!cssUrl && !isValidCssUrl(cssUrl) ? t("errors.https") : undefined}
              isInvalid={!!cssUrl && !isValidCssUrl(cssUrl)}
              placeholder={t("cssUrlPlaceholder")}
              type="url"
              value={cssUrl}
              onChange={(e) => {
                setCssUrl(e.target.value);
                setTestResult({ status: null, message: "" });
              }}
            />
            <p className="text-default-500 text-xs">{t("cssUrlHint")}</p>
          </div>

          {testResult.status && (
            <div
              className={`flex items-start gap-2 rounded-lg p-3 ${
                testResult.status === "success"
                  ? "bg-success-50 dark:bg-success-900/20"
                  : "bg-danger-50 dark:bg-danger-900/20"
              }`}
            >
              {testResult.status === "success" ? (
                <CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-600 dark:text-success-400" />
              ) : (
                <ExclamationCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger-600 dark:text-danger-400" />
              )}
              <p
                className={`text-sm ${
                  testResult.status === "success"
                    ? "text-success-700 dark:text-success-300"
                    : "text-danger-700 dark:text-danger-300"
                }`}
              >
                {testResult.message}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              isDisabled={saving || !cssUrl}
              isLoading={testing}
              variant="flat"
              onPress={handleTest}
            >
              {t("testButton")}
            </Button>

            <div className="flex gap-2">
              <Button
                isDisabled={saving || testing || (!cssUrl && !themeConfig?.cssUrl)}
                variant="flat"
                onPress={handleClear}
              >
                {t("clearButton")}
              </Button>

              <Button
                isDisabled={testing}
                isLoading={saving}
                color="primary"
                onPress={handleSave}
              >
                {t("saveButton")}
              </Button>
            </div>
          </div>

          {themeConfig?.cssUrl && (
            <div className="rounded-lg bg-content2 p-3">
              <p className="text-sm font-medium">{t("currentTheme")}</p>
              <p className="break-all text-default-500 text-xs">{themeConfig.cssUrl}</p>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-default-200 bg-content1 p-4">
          <p className="mb-2 text-sm font-medium">{t("howItWorks")}</p>
          <ul className="list-inside list-disc space-y-1 text-sm text-default-500">
            <li>{t("howItWorks1")}</li>
            <li>{t("howItWorks2")}</li>
            <li>{t("howItWorks3")}</li>
          </ul>
        </div>
      </CardBody>
    </Card>
  );
}
