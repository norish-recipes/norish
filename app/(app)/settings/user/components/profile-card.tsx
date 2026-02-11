"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader, Input, Button, Avatar } from "@heroui/react";
import { UserCircleIcon } from "@heroicons/react/24/outline";
import { TrashIcon } from "@heroicons/react/16/solid";
import { PencilIcon } from "@heroicons/react/20/solid";
import { useRef } from "react";
import { useTranslations } from "next-intl";

import { useUserSettingsContext } from "../context";

function withQueryParams(url: string, params: Record<string, string | number>) {
  const [path, hash = ""] = url.split("#");
  const separator = path.includes("?") ? "&" : "?";
  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");

  return `${path}${separator}${query}${hash ? `#${hash}` : ""}`;
}

export default function ProfileCard() {
  const t = useTranslations("settings.user.profile");
  const { user, updateName, updateImage, deleteImage, isDeletingAvatar } = useUserSettingsContext();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(() => Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update name when user data loads
  useEffect(() => {
    if (user?.name) {
      setName(user.name);
    }
  }, [user?.name]);

  useEffect(() => {
    if (user) {
      setAvatarRefreshKey(Date.now());
    }
  }, [user]);

  const handleSaveProfile = async () => {
    const hasNameChanges = name !== user?.name;
    const hasImageChanges = pendingImageFile !== null;

    if (!hasNameChanges && !hasImageChanges) {
      return;
    }

    setSaving(true);

    try {
      if (hasNameChanges) {
        await updateName(name);
      }

      if (pendingImageFile) {
        await updateImage(pendingImageFile);
        setImagePreview(null);
        setPendingImageFile(null);
      }
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

    setPendingImageFile(file);
  };

  const handleDeleteImage = async () => {
    setImagePreview(null);
    setPendingImageFile(null);
    await deleteImage();
  };

  const hasPendingChanges = name !== user?.name || pendingImageFile !== null;
  const hasImage = imagePreview || user?.image;

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <UserCircleIcon className="h-5 w-5" />
          {t("title")}
        </h2>
      </CardHeader>
      <CardBody className="gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar
              isBordered
              className="h-24 w-24 cursor-pointer text-2xl transition-opacity hover:opacity-80"
              name={user?.name?.[0]?.toUpperCase() || "U"}
              src={
                imagePreview || !user?.image
                  ? imagePreview || undefined
                  : withQueryParams(user.image, { v: avatarRefreshKey })
              }
              onClick={() => fileInputRef.current?.click()}
            />
            <input
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              type="file"
              onChange={handleImageSelect}
            />
            {hasImage && (
              <Button
                isIconOnly
                aria-label={t("deleteAvatar")}
                className="absolute -bottom-1 -left-1 h-7 w-7 min-w-0"
                color="danger"
                isLoading={isDeletingAvatar}
                radius="full"
                size="sm"
                variant="solid"
                onPress={handleDeleteImage}
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              isIconOnly
              aria-label={t("avatarHint")}
              className="absolute -right-1 -bottom-1 h-7 w-7 min-w-0"
              color="primary"
              radius="full"
              size="sm"
              variant="solid"
              onPress={() => fileInputRef.current?.click()}
            >
              <PencilIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Input
              label={t("nameLabel")}
              placeholder={t("namePlaceholder")}
              value={name}
              onValueChange={setName}
            />
            <p className="text-default-500 text-xs">{t("avatarHint")}</p>
          </div>
        </div>
        <Input isDisabled isReadOnly label={t("emailLabel")} value={user?.email || ""} />
        <div className="flex justify-end">
          <Button
            color="primary"
            isDisabled={!hasPendingChanges}
            isLoading={saving}
            onPress={handleSaveProfile}
          >
            {t("saveChanges")}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
