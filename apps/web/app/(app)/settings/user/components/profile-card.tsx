"use client";

import { useEffect, useRef, useState } from "react";
import UserAvatar from "@/components/shared/user-avatar";
import { TrashIcon } from "@heroicons/react/16/solid";
import { PencilIcon } from "@heroicons/react/20/solid";
import { UserCircleIcon } from "@heroicons/react/24/outline";
import { Button, Card, Input, Label, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useUserSettingsContext } from "../context";

export default function ProfileCard() {
  const t = useTranslations("settings.user.profile");
  const { user, updateName, updateImage, deleteImage, isDeletingAvatar } = useUserSettingsContext();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update name when user data loads
  useEffect(() => {
    if (user?.name) {
      setName(user.name);
    }
  }, [user?.name]);
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
      <Card.Header>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <UserCircleIcon className="h-5 w-5" />
          {t("title")}
        </h2>
      </Card.Header>
      <Card.Content className="gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              aria-label={t("avatarHint")}
              className="rounded-full"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              <UserAvatar
                className="size-24 cursor-pointer text-2xl transition-opacity hover:opacity-80"
                email={user?.email}
                image={imagePreview || user?.image}
                name={user?.name}
                userId={user?.id}
              />
            </button>
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
                className="absolute -bottom-1 -left-1 h-7 w-7 min-w-0 rounded-full"
                size="sm"
                onPress={handleDeleteImage}
                variant="danger"
                isPending={isDeletingAvatar}
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              isIconOnly
              aria-label={t("avatarHint")}
              className="absolute right-0 bottom-0 h-6 w-6 min-w-0 rounded-full"
              size="sm"
              onPress={() => fileInputRef.current?.click()}
              variant="primary"
            >
              <PencilIcon className="!size-3" />
            </Button>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <TextField value={name} onChange={setName}>
              <Label>{t("nameLabel")}</Label>
              <Input variant="secondary" placeholder={t("namePlaceholder")} />
            </TextField>
            <p className="text-muted text-xs">{t("avatarHint")}</p>
          </div>
        </div>
        <TextField isDisabled isReadOnly value={user?.email || ""}>
          <Label>{t("emailLabel")}</Label>
          <Input variant="secondary" />
        </TextField>
        <div className="flex justify-end">
          <Button
            isDisabled={!hasPendingChanges}
            onPress={handleSaveProfile}
            variant="primary"
            isPending={saving}
          >
            {t("saveChanges")}
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}
