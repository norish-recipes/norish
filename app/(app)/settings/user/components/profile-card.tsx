"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader, Input, Button, Avatar } from "@heroui/react";
import { UserCircleIcon } from "@heroicons/react/24/outline";
import { useRef } from "react";

import { useUserSettingsContext } from "../context";

export default function ProfileCard() {
  const { user, updateName, updateImage } = useUserSettingsContext();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update name when user data loads
  useEffect(() => {
    if (user?.name) {
      setName(user.name);
    }
  }, [user?.name]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await updateName(name);
    } finally {
      setSaving(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return;
    }

    // Create preview
    const reader = new FileReader();

    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    await updateImage(file).catch(() => {
      setImagePreview(null);
    });
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <UserCircleIcon className="h-5 w-5" />
          Profile
        </h2>
      </CardHeader>
      <CardBody className="gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar
              isBordered
              className="h-24 w-24 cursor-pointer text-2xl transition-opacity hover:opacity-80"
              name={user?.name?.[0]?.toUpperCase() || "U"}
              src={imagePreview || user?.image || undefined}
              onClick={() => fileInputRef.current?.click()}
            />
            <input
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              type="file"
              onChange={handleImageSelect}
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Input label="Name" placeholder="Your name" value={name} onValueChange={setName} />
            <p className="text-default-500 text-xs">Click your avatar to change picture</p>
          </div>
        </div>
        <Input isDisabled isReadOnly label="Email" value={user?.email || ""} />
        <div className="flex justify-end">
          <Button
            color="primary"
            isDisabled={name === user?.name}
            isLoading={saving}
            onPress={handleSaveProfile}
          >
            Save Changes
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
