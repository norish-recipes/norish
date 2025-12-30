"use client";

import type { CalDavCalendarInfo } from "@/types";

import { useState, useEffect, useRef } from "react";
import { Card, CardBody, CardHeader, Input, Button, useDisclosure, Link, Select, SelectItem } from "@heroui/react";
import {
  ServerIcon,
  EyeIcon,
  EyeSlashIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";

import { useCalDavSettingsContext } from "../context";

import CalDavConfigSummary from "./caldav-config-summary";
import CalDavConfigEditModal from "./caldav-config-edit-modal";

export default function CalDavConfigCard() {
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
    if (serverUrl && username && password && !testing && !hasAutoTestedRef.current) {
      hasAutoTestedRef.current = true;
      handleTestConnection();
    }
    // Reset auto-test flag if credentials change after a test
    if (!serverUrl || !username || !password) {
      hasAutoTestedRef.current = false;
    }
  }, [serverUrl, username, password]);

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
            <h2 className="text-lg font-semibold">Setup CalDAV Sync</h2>
            <p className="text-default-500 mt-1 text-base">
              Connect your CalDAV-compatible calendar to automatically sync your meal plans
            </p>
          </div>
        </div>
      </CardHeader>

      <CardBody className="gap-4">
        {/* Guidance Section */}
        <div className="bg-primary/10 border-primary/20 rounded-lg border p-4">
          <div className="flex gap-3">
            <InformationCircleIcon className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-primary mb-2 text-base font-medium">Getting Started with CalDAV</p>
              <p className="text-default-600 mb-2 text-xs">
                You&apos;ll need a CalDAV-compatible calendar service. Popular providers include:
              </p>
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
          description="Base URL of your CalDAV server (e.g., https://dav.example.com)"
          label="Server URL"
          placeholder="https://dav.example.com"
          value={serverUrl}
          onValueChange={setServerUrl}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            isRequired
            label="Username"
            placeholder="username"
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
            label="Password"
            placeholder="••••••••"
            type={showPassword ? "text" : "password"}
            value={password}
            onValueChange={setPassword}
          />
        </div>

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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            description="Format: HH:MM-HH:MM"
            label="Breakfast Time"
            placeholder="07:00-08:00"
            size="sm"
            value={breakfastTime}
            onValueChange={setBreakfastTime}
          />
          <Input
            description="Format: HH:MM-HH:MM"
            label="Lunch Time"
            placeholder="12:00-13:00"
            size="sm"
            value={lunchTime}
            onValueChange={setLunchTime}
          />
          <Input
            description="Format: HH:MM-HH:MM"
            label="Dinner Time"
            placeholder="18:00-19:00"
            size="sm"
            value={dinnerTime}
            onValueChange={setDinnerTime}
          />
          <Input
            description="Format: HH:MM-HH:MM"
            label="Snack Time"
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
            Test Connection
          </Button>
          <Button
            color="primary"
            isDisabled={!canSave}
            isLoading={saving}
            onPress={handleInitialSetup}
          >
            Save Configuration
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
