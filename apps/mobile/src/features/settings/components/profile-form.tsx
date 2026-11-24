import type * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { UserAvatar } from "@/components/user-avatar";
import { usePhotoSourceSheet } from "@/hooks/use-photo-source-sheet";
import { useText } from "@/lib/i18n/use-text";
import { useServerImage } from "@/lib/network/server-url";
import { isOfflineNow } from "@/lib/offline/offline-now";
import { File } from "expo-file-system";

import { useConnectivity } from "@norish/shared-react/offline/react";
import { useProfileMutations, useProfileQuery } from "@norish/shared-react/reader";

import { useDraft } from "../hooks/use-draft";
import { NAME_DRAFT, saveProfile } from "../utils/profile-rules";
import { settingsWrite } from "../utils/settings-write";
import { SettingsField, SubmitButton } from "./settings-form";
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
  const text = useText();
  const { isOffline } = useConnectivity();
  const { user } = useProfileQuery();
  const { updateName, uploadAvatar, deleteAvatar } = useProfileMutations();
  const toImage = useServerImage();
  const openPhotoSources = usePhotoSourceSheet(text("settings.mobile.changePhoto"));
  const [photo, setPhoto] = useState<File | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const savedName = user?.name ?? "";
  const name = useDraft(NAME_DRAFT, savedName, { editing, offline: isOffline });
  const image = photo ? { uri: photo.uri } : user?.image ? toImage(user.image) : null;

  const save = () =>
    name.save(() =>
      saveProfile({
        draft: name.draft,
        savedName,
        photo,
        updateName: name.request(updateName, "profile-name"),
        uploadAvatar: name.request(uploadAvatar, "profile-photo-upload"),
        setDraft: name.setDraft,
        setPhoto,
        offline: isOfflineNow,
      })
    );
  // A staged photo is only dropped; a saved one is deleted on the server, and a new photo or Save
  // waits for it, as either would send the version the delete moves on.
  const sendDelete = settingsWrite(deleteAvatar, "profile-photo-delete");
  const discardOrDeletePhoto = async () => {
    if (photo) return setPhoto(null);
    setDeleting(true);
    await sendDelete();
    setDeleting(false);
  };

  return (
    <>
      <View className="items-center gap-3 pt-3">
        <Pressable
          accessibilityLabel={text("settings.mobile.changePhoto")}
          accessibilityRole="button"
          className={isOffline ? "opacity-40" : ""}
          disabled={isOffline || deleting}
          testID="settings-profile-avatar"
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
            className={isOffline ? "opacity-40" : ""}
            disabled={isOffline || deleting || name.saving}
            hitSlop={8}
            testID="settings-profile-avatar-remove"
            onPress={() => void discardOrDeletePhoto()}
          >
            <Text className="text-danger text-[15px] font-medium">
              {text("settings.user.profile.deleteAvatar")}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View className="pt-5">
        <SettingsField
          autoCapitalize="words"
          hint={text("settings.mobile.avatarHint")}
          label={text("settings.user.profile.nameLabel")}
          placeholder={text("settings.user.profile.namePlaceholder")}
          returnKeyType="done"
          testID="settings-profile-name"
          value={name.shown}
          onBlur={() => setEditing(false)}
          onChangeText={name.setDraft}
          onFocus={() => setEditing(true)}
        />
      </View>
      <SettingsGroup>
        <SettingsRow
          testID="settings-profile-email"
          title={text("settings.user.profile.emailLabel")}
          value={user?.email}
        />
      </SettingsGroup>
      <SubmitButton
        isDisabled={!name.canSave(photo !== null) || deleting}
        label={text("common.actions.save")}
        testID="settings-profile-save"
        onPress={() => void save()}
      />
    </>
  );
}
