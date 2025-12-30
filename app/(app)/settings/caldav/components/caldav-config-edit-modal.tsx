"use client";

import type { CalDavCalendarInfo } from "@/types";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Chip,
  Accordion,
  AccordionItem,
  Select,
  SelectItem,
} from "@heroui/react";
import { ServerIcon } from "@heroicons/react/24/outline";

import { useCalDavSettingsContext } from "../context";

import SecretInput from "@/components/shared/secret-input";

interface CalDavConfigEditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CalDavConfigEditModal({ isOpen, onClose }: CalDavConfigEditModalProps) {
  const { config, saveConfig, testConnection, getCaldavPassword } = useCalDavSettingsContext();

  const [serverUrl, setServerUrl] = useState("");
  const [calendarUrl, setCalendarUrl] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<CalDavCalendarInfo[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [breakfastTime, setBreakfastTime] = useState("07:00-08:00");
  const [lunchTime, setLunchTime] = useState("12:00-13:00");
  const [dinnerTime, setDinnerTime] = useState("18:00-19:00");
  const [snackTime, setSnackTime] = useState("15:00-16:00");

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

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

  // Load existing config
  useEffect(() => {
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
        performTestConnection(serverUrl, username, revealedPassword, calendarUrl);
      }, 100);
    }
    return revealedPassword;
  }, [getCaldavPassword, serverUrl, username, testing, calendarUrl]);

  const validateTimeFormat = (time: string, field: string) => {
    if (!timeRegex.test(time)) {
      setTimeErrors((prev) => ({
        ...prev,
        [field]: "Format must be HH:MM-HH:MM",
      }));

      return false;
    }
    setTimeErrors((prev) => {
      const newErrors = { ...prev };

      delete newErrors[field as keyof typeof timeErrors];

      return newErrors;
    });

    return true;
  };

  const performTestConnection = async (url: string, user: string, pass: string, currentCalendarUrl: string | null = null) => {
    setTesting(true);
    setTestResult(null);
    setCalendars([]);
    try {
      const result = await testConnection(url, user, pass);

      setTestResult(result);
      
      // Store returned calendars for selection
      if (result.success && result.calendars && result.calendars.length > 0) {
        setCalendars(result.calendars);
        // Auto-select first calendar if none selected, or keep existing selection if valid
        if (!currentCalendarUrl || !result.calendars.some(c => c.url === currentCalendarUrl)) {
          setCalendarUrl(result.calendars[0].url);
        }
      }
    } finally {
      setTesting(false);
    }
  };

  const handleTestConnection = async () => {
    // Use form values for test
    const passwordToUse = password || (config ? await getCaldavPassword() : null) || "";
    await performTestConnection(serverUrl, username, passwordToUse, calendarUrl);
  };

  // Auto-test connection when password is entered (for new password)
  useEffect(() => {
    if (serverUrl && username && password && !testing && !hasAutoTestedRef.current && isOpen) {
      hasAutoTestedRef.current = true;
      performTestConnection(serverUrl, username, password, calendarUrl);
    }
  }, [password]);

  const handleSave = async () => {
    // Validate time formats
    const breakfastValid = validateTimeFormat(breakfastTime, "breakfast");
    const lunchValid = validateTimeFormat(lunchTime, "lunch");
    const dinnerValid = validateTimeFormat(dinnerTime, "dinner");
    const snackValid = validateTimeFormat(snackTime, "snack");

    if (!breakfastValid || !lunchValid || !dinnerValid || !snackValid) {
      return;
    }

    setSaving(true);
    setTestResult(null);
    try {
      await saveConfig({
        serverUrl,
        calendarUrl,
        username,
        password, // Empty string if not changed
        enabled,
        breakfastTime,
        lunchTime,
        dinnerTime,
        snackTime,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const canSave = serverUrl && username && (password || config) && calendarUrl;

  return (
    <Modal isOpen={isOpen} scrollBehavior="inside" size="2xl" onClose={onClose}>
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <ServerIcon className="h-5 w-5" />
          Edit CalDAV Configuration
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <Input
              isRequired
              description="Base URL of your CalDAV server (e.g., https://dav.example.com)"
              label="Server URL"
              placeholder="https://dav.example.com"
              value={serverUrl}
              onValueChange={setServerUrl}
            />

            <Input
              isRequired
              label="Username"
              placeholder="username"
              value={username}
              onValueChange={setUsername}
            />

            {/* Password Section */}
            <SecretInput
              isRequired
              isConfigured={!!config}
              label="Password"
              placeholder="Enter password"
              value={password}
              onReveal={handleRevealPassword}
              onValueChange={setPassword}
            />

            {/* Test Connection Result */}
            {testResult && (
              <Chip color={testResult.success ? "success" : "danger"} size="sm" variant="flat">
                {testResult.message}
              </Chip>
            )}

            {/* Calendar Selection - always visible, disabled until calendars fetched */}
            <Select
              description={calendars.length === 0 ? "Test connection to load available calendars" : "Select which calendar to sync meal plans with"}
              isDisabled={calendars.length === 0}
              label="Calendar"
              placeholder={calendars.length === 0 ? "Test connection first" : "Select a calendar"}
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

            {/* Advanced Settings */}
            <Accordion>
              <AccordionItem
                key="advanced"
                aria-label="Advanced Settings"
                title="Advanced Settings"
              >
                <div className="flex flex-col gap-4 pb-4">
                  <p className="text-default-500 text-xs">Timezone: {timezone}</p>

                  <Input
                    description="Format: HH:MM-HH:MM"
                    errorMessage={timeErrors.breakfast}
                    isInvalid={!!timeErrors.breakfast}
                    label="Breakfast Time"
                    placeholder="07:00-08:00"
                    size="sm"
                    value={breakfastTime}
                    onValueChange={(value) => {
                      setBreakfastTime(value);
                      validateTimeFormat(value, "breakfast");
                    }}
                  />

                  <Input
                    description="Format: HH:MM-HH:MM"
                    errorMessage={timeErrors.lunch}
                    isInvalid={!!timeErrors.lunch}
                    label="Lunch Time"
                    placeholder="12:00-13:00"
                    size="sm"
                    value={lunchTime}
                    onValueChange={(value) => {
                      setLunchTime(value);
                      validateTimeFormat(value, "lunch");
                    }}
                  />

                  <Input
                    description="Format: HH:MM-HH:MM"
                    errorMessage={timeErrors.dinner}
                    isInvalid={!!timeErrors.dinner}
                    label="Dinner Time"
                    placeholder="18:00-19:00"
                    size="sm"
                    value={dinnerTime}
                    onValueChange={(value) => {
                      setDinnerTime(value);
                      validateTimeFormat(value, "dinner");
                    }}
                  />

                  <Input
                    description="Format: HH:MM-HH:MM"
                    errorMessage={timeErrors.snack}
                    isInvalid={!!timeErrors.snack}
                    label="Snack Time"
                    placeholder="15:00-16:00"
                    size="sm"
                    value={snackTime}
                    onValueChange={(value) => {
                      setSnackTime(value);
                      validateTimeFormat(value, "snack");
                    }}
                  />
                </div>
              </AccordionItem>
            </Accordion>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            isDisabled={!serverUrl || !username || (!password && !config)}
            isLoading={testing}
            variant="bordered"
            onPress={handleTestConnection}
          >
            Test Connection
          </Button>
          <Button
            color="primary"
            isDisabled={!canSave || Object.keys(timeErrors).length > 0}
            isLoading={saving}
            onPress={handleSave}
          >
            Save Changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
