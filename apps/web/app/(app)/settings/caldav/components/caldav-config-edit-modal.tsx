"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SecretInput from "@/components/shared/secret-input";
import { ServerIcon } from "@heroicons/react/24/outline";
import {
  Accordion,
  Button,
  Chip,
  Description,
  FieldError,
  Input,
  InputGroup,
  Label,
  ListBox,
  Modal,
  Select,
  TextField,
} from "@heroui/react";
import { useTranslations } from "next-intl";

import { useCalDavSettingsContext } from "../context";
import { useConnectionTest } from "../use-connection-test";

interface CalDavConfigEditModalProps {
  isOpen: boolean;
  onClose: () => void;
}
export default function CalDavConfigEditModal({ isOpen, onClose }: CalDavConfigEditModalProps) {
  const t = useTranslations("settings.caldav.setup");
  const tConfig = useTranslations("settings.caldav.config");
  const {
    config,
    saveConfig,
    getCaldavPassword,
    isSavingConfig: saving,
  } = useCalDavSettingsContext();
  const [serverUrl, setServerUrl] = useState("");
  const [calendarUrl, setCalendarUrl] = useState<string | null>(null);
  const { calendars, setCalendars, testResult, setTestResult, testing, runTest } =
    useConnectionTest(setCalendarUrl);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [breakfastTime, setBreakfastTime] = useState("07:00-08:00");
  const [lunchTime, setLunchTime] = useState("12:00-13:00");
  const [dinnerTime, setDinnerTime] = useState("18:00-19:00");
  const [snackTime, setSnackTime] = useState("15:00-16:00");
  const [timeErrors, setTimeErrors] = useState<{
    breakfast?: string;
    lunch?: string;
    dinner?: string;
    snack?: string;
  }>({});

  // Track if we've already auto-tested to avoid duplicate calls
  const hasAutoTestedRef = useRef(false);

  // Get user's timezone
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Time format regex
  const timeRegex = /^\d{2}:\d{2}-\d{2}:\d{2}$/;

  // Load existing config each time the modal opens or the config changes while open
  const [loadedFor, setLoadedFor] = useState<{ config: typeof config; isOpen: boolean } | null>(
    null
  );

  if (loadedFor?.config !== config || loadedFor?.isOpen !== isOpen) {
    setLoadedFor({ config, isOpen });

    if (config && isOpen) {
      setServerUrl(config.serverUrl);
      setCalendarUrl(config.calendarUrl ?? null);
      setUsername(config.username);
      setPassword("");
      setEnabled(config.enabled);
      setBreakfastTime(config.breakfastTime);
      setLunchTime(config.lunchTime);
      setDinnerTime(config.dinnerTime);
      setSnackTime(config.snackTime);
      setTestResult(null);
      setCalendars([]);
    }
  }

  useEffect(() => {
    if (config && isOpen) {
      hasAutoTestedRef.current = false;
    }
  }, [config, isOpen]);
  const handleRevealPassword = useCallback(async () => {
    const revealedPassword = await getCaldavPassword();

    // Auto-test after revealing password
    if (revealedPassword && serverUrl && username && !testing && !hasAutoTestedRef.current) {
      hasAutoTestedRef.current = true;
      // Small delay to allow state to update
      setTimeout(() => {
        runTest(serverUrl, username, revealedPassword, calendarUrl);
      }, 100);
    }
    return revealedPassword;
  }, [getCaldavPassword, serverUrl, username, testing, calendarUrl, runTest]);
  const validateTimeFormat = (time: string, field: string) => {
    if (!timeRegex.test(time)) {
      setTimeErrors((prev) => ({
        ...prev,
        [field]: "Format must be HH:MM-HH:MM",
      }));
      return false;
    }
    setTimeErrors((prev) => {
      const newErrors = {
        ...prev,
      };
      delete newErrors[field as keyof typeof timeErrors];
      return newErrors;
    });
    return true;
  };
  const handleTestConnection = async () => {
    // Use form values for test
    const passwordToUse = password || (config ? await getCaldavPassword() : null) || "";
    await runTest(serverUrl, username, passwordToUse, calendarUrl);
  };

  // Auto-test connection when password is entered (for new password)
  useEffect(() => {
    if (serverUrl && username && password && !testing && !hasAutoTestedRef.current && isOpen) {
      hasAutoTestedRef.current = true;
      runTest(serverUrl, username, password, calendarUrl);
    }
  }, [password, serverUrl, username, testing, isOpen, runTest, calendarUrl]);
  const handleSave = async () => {
    // Validate time formats
    const breakfastValid = validateTimeFormat(breakfastTime, "breakfast");
    const lunchValid = validateTimeFormat(lunchTime, "lunch");
    const dinnerValid = validateTimeFormat(dinnerTime, "dinner");
    const snackValid = validateTimeFormat(snackTime, "snack");
    if (!breakfastValid || !lunchValid || !dinnerValid || !snackValid) {
      return;
    }
    setTestResult(null);
    await saveConfig({
      serverUrl,
      calendarUrl,
      username,
      password,
      // Empty string if not changed
      enabled,
      breakfastTime,
      lunchTime,
      dinnerTime,
      snackTime,
    }).then(() => onClose());
  };
  const canSave = serverUrl && username && (password || config) && calendarUrl;
  return (
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container className="z-[1100]" size="lg" scroll="inside">
        <Modal.Dialog>
          <Modal.Header className="flex items-center gap-2">
            <ServerIcon className="h-5 w-5" />
            {tConfig("editTitle")}
          </Modal.Header>
          <Modal.Body>
            <div className="flex flex-col gap-4">
              <TextField isRequired value={serverUrl} onChange={setServerUrl}>
                <Label>{t("serverUrlLabel")}</Label>
                <Input variant="secondary" placeholder={t("serverUrlPlaceholder")} />
                <Description>{t("serverUrlDescription")}</Description>
              </TextField>

              <TextField isRequired value={username} onChange={setUsername}>
                <Label>{t("usernameLabel")}</Label>
                <Input variant="secondary" placeholder={t("usernamePlaceholder")} />
              </TextField>

              {/* Password Section */}
              <SecretInput
                isRequired
                isConfigured={!!config}
                label={t("passwordLabel")}
                placeholder={t("passwordPlaceholder")}
                value={password}
                onReveal={handleRevealPassword}
                onValueChange={setPassword}
              />

              {/* Test Connection Result */}
              {testResult && (
                <Chip color={testResult.success ? "success" : "danger"} size="sm" variant="soft">
                  {testResult.message}
                </Chip>
              )}

              {/* Calendar Selection - always visible, disabled until calendars fetched */}
              <Select
                variant="secondary"
                isDisabled={calendars.length === 0}
                placeholder={
                  calendars.length === 0
                    ? t("calendarPlaceholderDisabled")
                    : t("calendarPlaceholder")
                }
                value={calendarUrl}
                onChange={(selected) => {
                  setCalendarUrl(typeof selected === "string" ? selected : null);
                }}
              >
                <Label>{t("calendarLabel")}</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <span className="text-muted px-1 text-xs">
                  {calendars.length === 0
                    ? t("calendarDescriptionDisabled")
                    : t("calendarDescription")}
                </span>
                <Select.Popover>
                  <ListBox>
                    {calendars.map((cal) => (
                      <ListBox.Item key={cal.url} id={cal.url} textValue={cal.displayName}>
                        {cal.displayName}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>

              {/* Advanced Settings */}
              <Accordion>
                <Accordion.Item id="advanced">
                  <Accordion.Heading>
                    <Accordion.Trigger aria-label={tConfig("advancedSettings")}>
                      {tConfig("advancedSettings")}
                      <Accordion.Indicator />
                    </Accordion.Trigger>
                  </Accordion.Heading>
                  <Accordion.Panel>
                    <Accordion.Body className="flex flex-col gap-4 pb-4">
                      <p className="text-muted text-xs">
                        {tConfig("timezone", {
                          timezone,
                        })}
                      </p>

                      <TextField
                        isInvalid={!!timeErrors.breakfast}
                        value={breakfastTime}
                        onChange={(value) => {
                          setBreakfastTime(value);
                          validateTimeFormat(value, "breakfast");
                        }}
                      >
                        <Label>{t("breakfastTime")}</Label>
                        <Input variant="secondary" placeholder="07:00-08:00" />
                        {timeErrors.breakfast ? (
                          <FieldError>{t("timeFormatError")}</FieldError>
                        ) : (
                          <Description>{t("timeFormat")}</Description>
                        )}
                      </TextField>

                      <TextField
                        isInvalid={!!timeErrors.lunch}
                        value={lunchTime}
                        onChange={(value) => {
                          setLunchTime(value);
                          validateTimeFormat(value, "lunch");
                        }}
                      >
                        <Label>{t("lunchTime")}</Label>
                        <Input variant="secondary" placeholder="12:00-13:00" />
                        {timeErrors.lunch ? (
                          <FieldError>{t("timeFormatError")}</FieldError>
                        ) : (
                          <Description>{t("timeFormat")}</Description>
                        )}
                      </TextField>

                      <TextField
                        isInvalid={!!timeErrors.dinner}
                        value={dinnerTime}
                        onChange={(value) => {
                          setDinnerTime(value);
                          validateTimeFormat(value, "dinner");
                        }}
                      >
                        <Label>{t("dinnerTime")}</Label>
                        <Input variant="secondary" placeholder="18:00-19:00" />
                        {timeErrors.dinner ? (
                          <FieldError>{t("timeFormatError")}</FieldError>
                        ) : (
                          <Description>{t("timeFormat")}</Description>
                        )}
                      </TextField>

                      <TextField
                        isInvalid={!!timeErrors.snack}
                        value={snackTime}
                        onChange={(value) => {
                          setSnackTime(value);
                          validateTimeFormat(value, "snack");
                        }}
                      >
                        <Label>{t("snackTime")}</Label>
                        <Input variant="secondary" placeholder="15:00-16:00" />
                        {timeErrors.snack ? (
                          <FieldError>{t("timeFormatError")}</FieldError>
                        ) : (
                          <Description>{t("timeFormat")}</Description>
                        )}
                      </TextField>
                    </Accordion.Body>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button
              isDisabled={!serverUrl || !username || (!password && !config)}
              onPress={handleTestConnection}
              variant="secondary"
              isPending={testing}
            >
              {t("testConnection")}
            </Button>
            <Button
              isDisabled={!canSave || Object.keys(timeErrors).length > 0}
              onPress={handleSave}
              variant="primary"
              isPending={saving}
            >
              {tConfig("saveChanges")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
