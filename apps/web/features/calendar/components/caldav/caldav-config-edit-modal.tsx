"use client";

import { useEffect, useRef, useState } from "react";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import SecretInput from "@/components/shared/secret-input";
import { ServerIcon } from "@heroicons/react/24/outline";
import {
  Accordion,
  Chip,
  Description,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  TextField,
} from "@heroui/react";
import { useTranslations } from "next-intl";

import {
  useCaldavConfigQuery,
  useCaldavMutations,
  useCaldavPasswordQuery,
} from "@norish/shared-react/calendar";

import { UntrustedCertificateNote } from "./untrusted-certificate-note";
import { useConnectionTest } from "./use-connection-test";

type TimeField = "breakfast" | "lunch" | "dinner" | "snack";

const TIME_RANGE = /^\d{2}:\d{2}-\d{2}:\d{2}$/;

interface CaldavConfigEditModalProps {
  isOpen: boolean;
  onClose: () => void;
}
export default function CaldavConfigEditModal({ isOpen, onClose }: CaldavConfigEditModalProps) {
  const t = useTranslations("settings.caldav.setup");
  const tConfig = useTranslations("settings.caldav.config");
  const tActions = useTranslations("common.actions");
  const { config } = useCaldavConfigQuery();
  const { read: readStoredPassword } = useCaldavPasswordQuery({ enabled: isOpen });
  const { saveConfig, isSavingConfig: saving } = useCaldavMutations();
  const [serverUrl, setServerUrl] = useState("");
  const [calendarUrl, setCalendarUrl] = useState<string | null>(null);
  const {
    calendars,
    setCalendars,
    testResult,
    setTestResult,
    testing,
    runTest,
    trustedCertificate,
    setTrustedCertificate,
    trustAndRetest,
  } = useConnectionTest(setCalendarUrl);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [breakfastTime, setBreakfastTime] = useState("07:00-08:00");
  const [lunchTime, setLunchTime] = useState("12:00-13:00");
  const [dinnerTime, setDinnerTime] = useState("18:00-19:00");
  const [snackTime, setSnackTime] = useState("15:00-16:00");
  const [timeErrors, setTimeErrors] = useState<Partial<Record<TimeField, boolean>>>({});
  // Revealing the stored password tests the connection once per opening.
  const hasAutoTestedRef = useRef(false);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

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
      setTrustedCertificate(config.trustedCertificate);
      setTestResult(null);
      setCalendars([]);
    }
  }

  useEffect(() => {
    if (config && isOpen) {
      hasAutoTestedRef.current = false;
    }
  }, [config, isOpen]);

  const handleRevealPassword = async () => {
    const storedPassword = await readStoredPassword();

    if (storedPassword && serverUrl && username && !testing && !hasAutoTestedRef.current) {
      hasAutoTestedRef.current = true;
      // Lets the revealed password render before the test starts.
      setTimeout(() => {
        void runTest(serverUrl, username, storedPassword, calendarUrl);
      }, 100);
    }

    return storedPassword;
  };
  const validateTimeFormat = (time: string, field: TimeField) => {
    const valid = TIME_RANGE.test(time);

    setTimeErrors((prev) => ({ ...prev, [field]: !valid }));

    return valid;
  };
  const passwordToUse = async () => password || (config ? await readStoredPassword() : null) || "";
  const handleTestConnection = async () =>
    runTest(serverUrl, username, await passwordToUse(), calendarUrl);
  const handleSave = async () => {
    const breakfastValid = validateTimeFormat(breakfastTime, "breakfast");
    const lunchValid = validateTimeFormat(lunchTime, "lunch");
    const dinnerValid = validateTimeFormat(dinnerTime, "dinner");
    const snackValid = validateTimeFormat(snackTime, "snack");

    if (!breakfastValid || !lunchValid || !dinnerValid || !snackValid) {
      return;
    }
    setTestResult(null);
    const saved = await saveConfig({
      serverUrl,
      calendarUrl,
      username,
      // Empty keeps the stored password.
      password,
      enabled,
      breakfastTime,
      lunchTime,
      dinnerTime,
      snackTime,
      trustedCertificate,
    });

    if (saved) onClose();
  };
  const canSave = serverUrl && username && (password || config) && calendarUrl;

  return (
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={onClose}>
      <Modal.Container className="z-[1100]" scroll="inside" size="lg">
        <Modal.Dialog>
          <Modal.Header className="flex items-center gap-2">
            <ServerIcon className="h-5 w-5" />
            {tConfig("editTitle")}
          </Modal.Header>
          <Modal.Body>
            <div className="flex flex-col gap-4">
              <TextField isRequired value={serverUrl} onChange={setServerUrl}>
                <Label>{t("serverUrlLabel")}</Label>
                <Input placeholder={t("serverUrlPlaceholder")} variant="secondary" />
                <Description>{t("serverUrlDescription")}</Description>
              </TextField>

              <TextField isRequired value={username} onChange={setUsername}>
                <Label>{t("usernameLabel")}</Label>
                <Input placeholder={t("usernamePlaceholder")} variant="secondary" />
              </TextField>

              <SecretInput
                isRequired
                isConfigured={!!config}
                label={t("passwordLabel")}
                placeholder={t("passwordPlaceholder")}
                value={password}
                onReveal={handleRevealPassword}
                onValueChange={setPassword}
              />

              {testResult?.untrustedCertificate ? (
                <UntrustedCertificateNote
                  certificate={testResult.untrustedCertificate}
                  isPending={testing}
                  onTrust={async () =>
                    trustAndRetest(serverUrl, username, await passwordToUse(), calendarUrl)
                  }
                />
              ) : (
                testResult && (
                  <Chip color={testResult.success ? "success" : "danger"} size="sm" variant="soft">
                    {testResult.message}
                  </Chip>
                )
              )}

              {/* Calendar Selection - always visible, disabled until calendars fetched */}
              <Select
                isDisabled={calendars.length === 0}
                placeholder={
                  calendars.length === 0
                    ? t("calendarPlaceholderDisabled")
                    : t("calendarPlaceholder")
                }
                value={calendarUrl}
                variant="secondary"
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
                        <Input placeholder="07:00-08:00" variant="secondary" />
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
                        <Input placeholder="12:00-13:00" variant="secondary" />
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
                        <Input placeholder="18:00-19:00" variant="secondary" />
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
                        <Input placeholder="15:00-16:00" variant="secondary" />
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
            <ActionButtonGroup>
              <ActionButton
                action="test"
                isDisabled={!serverUrl || !username || (!password && !config)}
                isPending={testing}
                onPress={handleTestConnection}
              >
                {tActions("test")}
              </ActionButton>
              <ActionButton
                action="save"
                isDisabled={!canSave || Object.values(timeErrors).some(Boolean)}
                isPending={saving}
                onPress={handleSave}
              >
                {tActions("save")}
              </ActionButton>
            </ActionButtonGroup>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
