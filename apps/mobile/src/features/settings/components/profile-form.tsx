import type * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { LabelWithHint } from "@/components/hint-button";
import { SheetInput } from "@/components/sheet-input";
import { usePhotoSourceSheet } from "@/hooks/use-photo-source-sheet";
import { useServerImage } from "@/lib/network/server-url";
import { File } from "expo-file-system";
import { Image } from "expo-image";
import { Avatar, Button, TextField } from "heroui-native";
import { useIntl } from "react-intl";

import { useConnectivity } from "@norish/shared-react/offline/react";
import { useProfileMutations, useProfileQuery } from "@norish/shared-react/reader";

import { canSaveProfile } from "../utils/profile-rules";
import { SettingsGroup } from "./settings-group";
import { SettingsRow } from "./settings-row";

const PICKER: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.9,
};

/** The Reader's photo, name and email: a photo or name change waits for Save, Remove acts at once. */
export function ProfileForm() {
  const intl = useIntl();
  const { isOffline } = useConnectivity();
  const { user } = useProfileQuery();
  const { updateName, uploadAvatar, deleteAvatar, isDeletingAvatar } = useProfileMutations();
  const toImage = useServerImage();
  const openPhotoSources = usePhotoSourceSheet(
    intl.formatMessage({ id: "settings.mobile.changePhoto" })
  );
  const [draft, setDraft] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const savedName = user?.name ?? "";
  const name = draft ?? savedName;
  const image = photo ? { uri: photo.uri } : user?.image ? toImage(user.image) : null;
  const canSave = canSaveProfile({
    name,
    savedName,
    hasNewPhoto: photo !== null,
    saving,
    offline: isOffline,
  });

  const save = async () => {
    setSaving(true);

    if (name !== savedName) await updateName(name);
    if (photo && (await uploadAvatar(photo))) setPhoto(null);
    setDraft(null);
    setSaving(false);
  };
  const removePhoto = () => {
    if (photo) setPhoto(null);
    else void deleteAvatar();
  };

  return (
    <>
      <View className="items-center gap-3 pt-3">
        <Pressable
          accessibilityLabel={intl.formatMessage({ id: "settings.mobile.changePhoto" })}
          accessibilityRole="button"
          disabled={isOffline}
          style={{ opacity: isOffline ? 0.4 : 1 }}
          testID="profile-avatar"
          onPress={() => openPhotoSources(PICKER, ([asset]) => setPhoto(new File(asset!.uri)))}
        >
          <Avatar alt={savedName} className="size-24">
            {image ? (
              <Avatar.Image asChild source={image}>
                <Image contentFit="cover" style={{ width: "100%", height: "100%" }} />
              </Avatar.Image>
            ) : null}
            <Avatar.Fallback
              classNames={{
                container: "bg-avatar",
                text: "text-foreground text-[36px] font-semibold",
              }}
            >
              {savedName.slice(0, 1).toUpperCase()}
            </Avatar.Fallback>
          </Avatar>
        </Pressable>
        {image ? (
          <Pressable
            accessibilityRole="button"
            disabled={isOffline || isDeletingAvatar}
            hitSlop={8}
            style={{ opacity: isOffline ? 0.4 : 1 }}
            testID="profile-avatar-remove"
            onPress={removePhoto}
          >
            <Text className="text-danger text-[15px] font-medium">
              {intl.formatMessage({ id: "settings.user.profile.deleteAvatar" })}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View className="pt-5">
        <LabelWithHint
          hint={intl.formatMessage({ id: "settings.mobile.avatarHint" })}
          label={intl.formatMessage({ id: "settings.user.profile.nameLabel" })}
          testID="profile-name-hint"
        />
        <TextField>
          <SheetInput
            accessibilityLabel={intl.formatMessage({ id: "settings.user.profile.nameLabel" })}
            autoCapitalize="words"
            editable={!isOffline}
            placeholder={intl.formatMessage({ id: "settings.user.profile.namePlaceholder" })}
            returnKeyType="done"
            testID="profile-name"
            value={name}
            onChangeText={setDraft}
          />
        </TextField>
      </View>
      <SettingsGroup>
        <SettingsRow
          testID="profile-email"
          title={intl.formatMessage({ id: "settings.user.profile.emailLabel" })}
          value={user?.email}
        />
      </SettingsGroup>
      <Button
        className="mt-4 h-[50px] rounded-full"
        isDisabled={!canSave}
        testID="profile-save"
        onPress={() => void save()}
      >
        <Button.Label className="text-base font-semibold">
          {intl.formatMessage({ id: "common.actions.save" })}
        </Button.Label>
      </Button>
    </>
  );
}
