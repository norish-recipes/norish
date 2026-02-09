"use client";

import type { CalDavCalendarInfo } from "@/types";

import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Button,
  useDisclosure,
  Link,
  Select,
  SelectItem,
} from "@heroui/react";
import { ServerIcon } from "@heroicons/react/24/outline";
import { InformationCircleIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import { useCalDavSettingsContext } from "../context";

import CalDavConfigSummary from "./caldav-config-summary";
import CalDavConfigEditModal from "./caldav-config-edit-modal";

export default function CalDavConfigCard() {
  const t = useTranslations("settings.caldav.setup");
  const { config, saveConfig, testConnection } = useCalDavSettingsContext();
  const {
    isOpen: isEditModalOpen,
    onOpen: onEditModalOpen,
    onClose: onEditModalClose,
  } = useDisclosure();

  // Initial setup form state (only used when no config exists)
  const [serverUrl, setServerUrl] = useState("");
  const [calendarUrl, setCalendarUrl] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<CalDavCalendarInfo[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [breakfastTime, setBreakfastTime] = useState("07:00-08:00");
  const [lunchTime, setLunchTime] = useState("12:00-13:00");
  const [dinnerTime, setDinnerTime] = useState("18:00-19:00");
  const [snackTime, setSnackTime] = useState("15:00-16:00");

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Track if we've already auto-tested to avoid duplicate calls
  const hasAutoTestedRef = useRef(false);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setCalendars([]);
    try {
      const result = await testConnection(serverUrl, username, password);

      setTestResult(result);

      // Store returned calendars for selection
      if (result.success && result.calendars && result.calendars.length > 0) {
        setCalendars(result.calendars);
        // Auto-select first calendar
        if (!calendarUrl) {
          setCalendarUrl(result.calendars[0].url);
        }
      }
    } finally {
      setTesting(false);
    }
  };

  // Auto-test connection when all credentials are filled
  useEffect(() => {
    // Skip if already testing or if we've already auto-tested
    if (testing || hasAutoTestedRef.current) return;

    if (serverUrl && username && password) {
      hasAutoTestedRef.current = true;
      // Use a local function to avoid dependency issues
      const runAutoTest = async () => {
        setTesting(true);
        setTestResult(null);
        setCalendars([]);
        try {
          const result = await testConnection(serverUrl, username, password);

          setTestResult(result);

          // Store returned calendars for selection
          if (result.success && result.calendars && result.calendars.length > 0) {
            setCalendars(result.calendars);
            // Auto-select first calendar
            if (!calendarUrl) {
              setCalendarUrl(result.calendars[0].url);
            }
          }
        } finally {
          setTesting(false);
        }
      };

      runAutoTest();
    }
    // Reset auto-test flag if credentials change after a test
    if (!serverUrl || !username || !password) {
      hasAutoTestedRef.current = false;
    }
  }, [serverUrl, username, password, testing, testConnection, calendarUrl]);

  const handleInitialSetup = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      await saveConfig({
        serverUrl,
        calendarUrl,
        username,
        password,
        enabled: true,
        breakfastTime,
        lunchTime,
        dinnerTime,
        snackTime,
      });
      setPassword(""); // Clear password after save
    } finally {
      setSaving(false);
    }
  };

  // If config exists, show summary
  if (config) {
    return (
      <>
        <CalDavConfigSummary onEditClick={onEditModalOpen} />
        <CalDavConfigEditModal isOpen={isEditModalOpen} onClose={onEditModalClose} />
      </>
    );
  }

  // If no config, show initial setup form with guidance
  const canSave = serverUrl && username && password && calendarUrl;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <ServerIcon className="text-primary h-6 w-6" />
          <div>
            <h2 className="text-lg font-semibold">{t("title")}</h2>
            <p className="text-default-500 mt-1 text-base">{t("description")}</p>
          </div>
        </div>
      </CardHeader>

      <CardBody className="gap-4">
        {/* Guidance Section */}
        <div className="bg-primary/10 border-primary/20 rounded-lg border p-4">
          <div className="flex gap-3">
            <InformationCircleIcon className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-primary mb-2 text-base font-medium">{t("gettingStarted")}</p>
              <p className="text-default-600 mb-2 text-xs">{t("providerDescription")}</p>
              <ul className="text-default-600 ml-4 list-disc space-y-1 text-xs">
                <li>
                  <Link
                    isExternal
                    href="https://docs.nextcloud.com/server/latest/user_manual/en/groupware/calendar.html"
                    size="sm"
                    target="_blank"
                  >
                    Nextcloud Calendar
                  </Link>
                </li>
                <li>
                  <Link isExternal href="https://radicale.org/" size="sm" target="_blank">
                    Radicale
                  </Link>
                </li>
                <li>
                  <Link
                    isExternal
                    href="https://support.apple.com/guide/calendar/set-up-accounts-icl4308d6701/mac"
                    size="sm"
                    target="_blank"
                  >
                    Apple Calendar
                  </Link>
                </li>
                <li>
                  <Link
                    isExternal
                    href="https://support.google.com/calendar/answer/99358"
                    size="sm"
                    target="_blank"
                  >
                    Google Calendar
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Setup Form */}
        <Input
          isRequired
          description={t("serverUrlDescription")}
          label={t("serverUrlLabel")}
          placeholder={t("serverUrlPlaceholder")}
          value={serverUrl}
          onValueChange={setServerUrl}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            isRequired
            label={t("usernameLabel")}
            placeholder={t("usernamePlaceholder")}
            value={username}
            onValueChange={setUsername}
          />
          <Input
            isRequired
            endContent={
              <button
                className="focus:outline-none"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeSlashIcon className="text-default-400 h-4 w-4" />
                ) : (
                  <EyeIcon className="text-default-400 h-4 w-4" />
                )}
              </button>
            }
            label={t("passwordLabel")}
            placeholder={t("passwordPlaceholder")}
            type={showPassword ? "text" : "password"}
            value={password}
            onValueChange={setPassword}
          />
        </div>

        {/* Calendar Selection - always visible, disabled until calendars fetched */}
        <Select
          description={
            calendars.length === 0 ? t("calendarDescriptionDisabled") : t("calendarDescription")
          }
          isDisabled={calendars.length === 0}
          label={t("calendarLabel")}
          placeholder={
            calendars.length === 0 ? t("calendarPlaceholderDisabled") : t("calendarPlaceholder")
          }
          selectedKeys={calendarUrl ? [calendarUrl] : []}
          onSelectionChange={(keys) => {
            const selected = Array.from(keys)[0] as string;

            setCalendarUrl(selected || null);
          }}
        >
          {calendars.map((cal) => (
            <SelectItem key={cal.url}>{cal.displayName}</SelectItem>
          ))}
        </Select>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            description={t("timeFormat")}
            label={t("breakfastTime")}
            placeholder="07:00-08:00"
            size="sm"
            value={breakfastTime}
            onValueChange={setBreakfastTime}
          />
          <Input
            description={t("timeFormat")}
            label={t("lunchTime")}
            placeholder="12:00-13:00"
            size="sm"
            value={lunchTime}
            onValueChange={setLunchTime}
          />
          <Input
            description={t("timeFormat")}
            label={t("dinnerTime")}
            placeholder="18:00-19:00"
            size="sm"
            value={dinnerTime}
            onValueChange={setDinnerTime}
          />
          <Input
            description={t("timeFormat")}
            label={t("snackTime")}
            placeholder="15:00-16:00"
            size="sm"
            value={snackTime}
            onValueChange={setSnackTime}
          />
        </div>

        {testResult && (
          <div
            className={`rounded-lg p-3 text-base ${
              testResult.success ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
            }`}
          >
            {testResult.message}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button
            isDisabled={!canSave}
            isLoading={testing}
            variant="bordered"
            onPress={handleTestConnection}
          >
            {t("testConnection")}
          </Button>
          <Button
            color="primary"
            isDisabled={!canSave}
            isLoading={saving}
            onPress={handleInitialSetup}
          >
            {t("saveConfiguration")}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
