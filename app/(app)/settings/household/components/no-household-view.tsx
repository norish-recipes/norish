"use client";

import { useState, FormEvent } from "react";
import { Card, CardBody, CardHeader, Input, Button } from "@heroui/react";
import { HomeIcon, UserGroupIcon } from "@heroicons/react/24/outline";

import { useHouseholdSettingsContext } from "../context";

export default function NoHouseholdView() {
  const { createHousehold, joinHousehold } = useHouseholdSettingsContext();
  const [householdName, setHouseholdName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const handleCreateHousehold = async (e: FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    createHousehold(householdName);
    setHouseholdName("");
    setIsCreating(false);
  };

  const handleJoinHousehold = async (e: FormEvent) => {
    e.preventDefault();
    setIsJoining(true);
    joinHousehold(joinCode);
    setJoinCode("");
    setIsJoining(false);
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <h1 className="text-2xl font-bold">Household Settings</h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Create Household */}
        <Card>
          <CardHeader>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <HomeIcon className="h-5 w-5" />
              Create Household
            </h2>
          </CardHeader>
          <CardBody>
            <form className="flex flex-col gap-4" onSubmit={handleCreateHousehold}>
              <p className="text-default-600 text-base">
                Create a new household to share recipes and groceries with family or friends.
              </p>
              <Input
                isRequired
                label="Household Name"
                placeholder="e.g., Smith Family"
                value={householdName}
                onValueChange={setHouseholdName}
              />
              <div className="flex justify-end">
                <Button color="primary" isLoading={isCreating} type="submit">
                  Create Household
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        {/* Join Household */}
        <Card>
          <CardHeader>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <UserGroupIcon className="h-5 w-5" />
              Join Household
            </h2>
          </CardHeader>
          <CardBody>
            <form className="flex flex-col gap-4" onSubmit={handleJoinHousehold}>
              <p className="text-default-600 text-base">
                Enter a join code to join an existing household.
              </p>
              <Input
                isRequired
                label="Join Code"
                maxLength={8}
                placeholder="8-character code"
                value={joinCode}
                onValueChange={setJoinCode}
              />
              <div className="flex justify-end">
                <Button color="primary" isLoading={isJoining} type="submit">
                  Join Household
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
