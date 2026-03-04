import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { Button, useThemeColor } from 'heroui-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';

import {
  colorStyles,
  photoStyles,
  subSheetStyles,
} from '@/components/shell/sheet/add-recipe-sheet.styles';
import { ShellSheet } from '@/components/shell/sheet';
import { usePermissionsContext } from '@/context/permissions-context';
import { canShowAIAction } from '@/lib/permissions/mobile-action-visibility';

const MAX_PHOTOS = 10;

interface ScanPhotoSheetProps {
  isPresented: boolean;
  onIsPresentedChange: (open: boolean) => void;
}

export function ScanPhotoSheet({ isPresented, onIsPresentedChange }: ScanPhotoSheetProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const { isAIEnabled, isLoading: isLoadingPermissions } = usePermissionsContext();
  const [foregroundColor, mutedColor, accentForegroundColor, dangerColor] = useThemeColor([
    'foreground',
    'muted',
    'accent-foreground',
    'danger',
  ] as const);

  useEffect(() => {
    if (!isPresented) {
      setPhotos([]);
    }
  }, [isPresented]);

  const pickFromLibrary = useCallback(async () => {
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });

    if (!result.canceled) {
      setPhotos((prev) => [...prev, ...result.assets.map((asset) => asset.uri).slice(0, remaining)]);
    }
  }, [photos.length]);

  const takePhoto = useCallback(async () => {
    if (photos.length >= MAX_PHOTOS) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, result.assets[0]!.uri]);
    }
  }, [photos.length]);

  const removePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const atMax = photos.length >= MAX_PHOTOS;
  const showAIActions = canShowAIAction({
    isAIEnabled,
    isLoadingPermissions,
  });

  return (
    <ShellSheet
      isPresented={isPresented}
      onIsPresentedChange={onIsPresentedChange}
      detents={['medium', 'large']}
      initialDetent="medium"
    >
      <View style={subSheetStyles.container}>
        <Text style={[subSheetStyles.title, colorStyles.text(foregroundColor)]}>Scan a Photo</Text>
        <Text style={[subSheetStyles.subtitle, colorStyles.text(mutedColor)]}>
          Upload or take up to {MAX_PHOTOS} photos of a recipe.
        </Text>

        {photos.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={photoStyles.scrollContent}
            style={photoStyles.scrollWrapper}
          >
            {photos.map((uri, index) => (
              <View key={`${uri}-${index}`} style={photoStyles.thumbContainer}>
                <Image source={{ uri }} style={photoStyles.thumb} />
                <Button
                  isIconOnly
                  variant="danger"
                  size="sm"
                  onPress={() => removePhoto(index)}
                  style={[
                    photoStyles.removeButton,
                    colorStyles.removeButtonBackground(dangerColor),
                  ]}
                  className="rounded-full"
                >
                  <Ionicons name="close" size={12} color="#fff" />
                </Button>
              </View>
            ))}
          </ScrollView>
        )}

        <Text style={[photoStyles.counter, colorStyles.text(mutedColor)]}>
          {photos.length} / {MAX_PHOTOS} photos
        </Text>

        <View className="flex-row gap-2.5">
          <Button
            variant="secondary"
            size="lg"
            className="flex-1"
            isDisabled={atMax}
            onPress={pickFromLibrary}
          >
            <Ionicons name="images-outline" size={20} color={foregroundColor} />
            <Button.Label>Library</Button.Label>
          </Button>
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            isDisabled={atMax}
            onPress={takePhoto}
          >
            <Ionicons name="camera-outline" size={20} color={accentForegroundColor} />
            <Button.Label>Take Photo</Button.Label>
          </Button>
        </View>

        {photos.length > 0 && showAIActions && (
          <Button variant="primary" size="lg" className="w-full">
            <Ionicons name="flash-outline" size={20} color={accentForegroundColor} />
            <Button.Label>
              Import from {photos.length} {photos.length === 1 ? 'Photo' : 'Photos'}
            </Button.Label>
          </Button>
        )}
      </View>
    </ShellSheet>
  );
}
