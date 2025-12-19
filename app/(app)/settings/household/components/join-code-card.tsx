"use client";

import type { HouseholdAdminSettingsDto } from "@/types/dto/household";

import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader, Input, Button } from "@heroui/react";
import { ClipboardDocumentIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

import { useHouseholdSettingsContext } from "../context";

export default function JoinCodeCard() {
  const { household, currentUserId, regenerateJoinCode } = useHouseholdSettingsContext();
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  // Calculate time remaining for join code
  useEffect(() => {
    if (
      !household ||
      !("joinCode" in household) ||
      !household.joinCode ||
      !household.joinCodeExpiresAt
    ) {
      setTimeRemaining("");

      return;
    }

    const calculateTime = () => {
      // Type guard again inside the function
      if (!household || !("joinCodeExpiresAt" in household) || !household.joinCodeExpiresAt) return;

      const now = new Date();
      const expires = new Date(household.joinCodeExpiresAt);
      const diff = expires.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining("Expired");

        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      setTimeRemaining(`${minutes}m ${seconds}s`);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);

    return () => clearInterval(interval);
  }, [household]);

  if (!household) return null;

  // Check if current user is admin and if household has admin fields
  const currentUserData = currentUserId
    ? household.users.find((u) => u.id === currentUserId)
    : null;
  const isAdmin = currentUserData?.isAdmin === true;

  // Type guard: only admins get joinCode fields
  const hasJoinCode = "joinCode" in household;

  if (!isAdmin || !hasJoinCode) return null;

  // Now TypeScript knows household has joinCode fields
  const adminHousehold = household as HouseholdAdminSettingsDto;
  const joinCodeExpired = adminHousehold.joinCodeExpiresAt
    ? new Date(adminHousehold.joinCodeExpiresAt) < new Date()
    : true;

  const handleCopyJoinCode = () => {
    // Type guard ensures household has joinCode
    if ("joinCode" in household && household.joinCode) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(household.joinCode);
      }
    }
  };

  const handleRegenerateCode = async () => {
    await regenerateJoinCode(household.id);
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ClipboardDocumentIcon className="h-5 w-5" />
          Join Code
        </h2>
      </CardHeader>
      <CardBody className="gap-4">
        {adminHousehold.joinCode && !joinCodeExpired ? (
          <>
            <p className="text-default-600 text-base">
              Share this code with others to invite them to your household.
            </p>
            <div className="flex gap-2">
              <Input
                isReadOnly
                classNames={{ input: "font-mono text-lg tracking-wider" }}
                value={adminHousehold.joinCode || ""}
              />
              <Button isIconOnly onPress={handleCopyJoinCode}>
                <ClipboardDocumentIcon className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-default-600 text-base">
                Expires in: <span className="text-warning font-medium">{timeRemaining}</span>
              </span>
              <Button
                color="primary"
                size="sm"
                startContent={<ArrowPathIcon className="h-4 w-4" />}
                variant="flat"
                onPress={handleRegenerateCode}
              >
                Regenerate
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-default-600 text-base">
              No active join code. Generate one to invite new members.
            </p>
            <div className="flex justify-end">
              <Button
                color="primary"
                startContent={<ArrowPathIcon className="h-4 w-4" />}
                onPress={handleRegenerateCode}
              >
                Generate Join Code
              </Button>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
