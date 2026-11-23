import type * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { LabelWithHint } from "@/components/hint-button";
import { SheetInput } from "@/components/sheet-input";
import { UserAvatar } from "@/components/user-avatar";
import { usePhotoSourceSheet } from "@/hooks/use-photo-source-sheet";
import { useServerImage } from "@/lib/network/server-url";
import { File } from "expo-file-system";
import { Button, TextField } from "heroui-native";
import { useIntl } from "react-intl";

import { useConnectivity } from "@norish/shared-react/offline/react";
import { useProfileMutations, useProfileQuery } from "@norish/shared-react/reader";

import {
  afterSave,
  canSaveProfile,
  keptDraft,
  nameToSend,
  shownName,
} from "../utils/profile-rules";
import { writeBlocked } from "../utils/row-actions";
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
  const [editing, setEditing] = useState(false);
  const savedName = user?.name ?? "";
  const kept = keptDraft({ draft, savedName, editing, saving });

  // Dropped while rendering: a draft left in the field would hide, and a save undo, a later rename.
  if (kept !== draft) setDraft(kept);
  const image = photo ? { uri: photo.uri } : user?.image ? toImage(user.image) : null;
  const blocked = writeBlocked(true, isOffline);
  const canSave = canSaveProfile({
    draft,
    savedName,
    hasNewPhoto: photo !== null,
    saving,
    offline: isOffline,
  });

  const save = async () => {
    const sentDraft = draft;
    const sentPhoto = photo;
    const name = nameToSend(draft, savedName);

    setSaving(true);
    if (name !== null) {
      const tookIt = await updateName(name);

      setDraft((current) => afterSave(current, sentDraft, tookIt));
    }
    if (sentPhoto) {
      const tookIt = await uploadAvatar(sentPhoto);

      setPhoto((current) => afterSave(current, sentPhoto, tookIt));
    }
    setSaving(false);
  };
  // A staged photo is only dropped; a saved one is deleted on the server.
  const discardOrDeletePhoto = () => {
    if (photo) setPhoto(null);
    else void deleteAvatar();
  };

  return (
    <>
      <View className="items-center gap-3 pt-3">
        <Pressable
          accessibilityLabel={intl.formatMessage({ id: "settings.mobile.changePhoto" })}
          accessibilityRole="button"
          className={blocked ? "opacity-40" : ""}
          disabled={isOffline}
          testID="profile-avatar"
          onPress={() =>
            openPhotoSources(PICKER, ([asset]) => {
              if (asset) setPhoto(new File(asset.uri));
            })
          }
        >
          <UserAvatar
            className="size-24"
            initialClassName="text-[36px]"
            name={savedName}
            source={image}
          />
        </Pressable>
        {image ? (
          <Pressable
            accessibilityRole="button"
            className={blocked ? "opacity-40" : ""}
            disabled={isOffline || isDeletingAvatar || saving}
            hitSlop={8}
            testID="profile-avatar-remove"
            onPress={discardOrDeletePhoto}
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
            value={shownName(draft, savedName)}
            onBlur={() => setEditing(false)}
            onChangeText={setDraft}
            onFocus={() => setEditing(true)}
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
