import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, ListGroup, PressableFeedback, Separator, useThemeColor } from 'heroui-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ShellSheet } from '@/components/shell/sheet';
import { useRecipesContext } from '@/context/recipes-context';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AddRecipeSheetProps {
  isPresented: boolean;
  onIsPresentedChange: (value: boolean) => void;
}

// ---------------------------------------------------------------------------
// Sub-sheet identifiers
// ---------------------------------------------------------------------------

type SubSheet = 'url' | 'photo' | 'scratch' | null;

// ---------------------------------------------------------------------------
// Add Recipe Sheet (root)
// ---------------------------------------------------------------------------

export function AddRecipeSheet({ isPresented, onIsPresentedChange }: AddRecipeSheetProps) {
  const [subSheet, setSubSheet] = useState<SubSheet>(null);

  const closeAll = useCallback(() => {
    setSubSheet(null);
    onIsPresentedChange(false);
  }, [onIsPresentedChange]);

  const handleSubSheetClose = useCallback(
    (open: boolean) => {
      if (!open) {
        setSubSheet(null);
      }
    },
    [],
  );

  return (
    <>
      <ShellSheet
        isPresented={isPresented}
        onIsPresentedChange={onIsPresentedChange}
        detents={['medium']}
        initialDetent="medium"
      >
        <AddRecipeMenu onSelect={setSubSheet} />
      </ShellSheet>

      <ImportFromUrlSheet
        isPresented={subSheet === 'url'}
        onIsPresentedChange={handleSubSheetClose}
        onDone={closeAll}
      />

      <ScanPhotoSheet
        isPresented={subSheet === 'photo'}
        onIsPresentedChange={handleSubSheetClose}
      />

      <StartFromScratchSheet
        isPresented={subSheet === 'scratch'}
        onIsPresentedChange={handleSubSheetClose}
        onDone={closeAll}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Root menu content
// ---------------------------------------------------------------------------

function AddRecipeMenu({ onSelect }: { onSelect: (sub: SubSheet) => void }) {
  const [foregroundColor, mutedColor] = useThemeColor([
    'foreground',
    'muted',
  ] as const);

  return (
    <View style={menuStyles.container}>
      <View style={menuStyles.iconContainer}>
        <Ionicons name="restaurant-outline" size={40} color={mutedColor} />
      </View>

      <Text style={[menuStyles.title, { color: foregroundColor }]}>Add Recipe</Text>
      <Text style={[menuStyles.subtitle, { color: mutedColor }]}>
        Import from a URL, scan a photo, or start from scratch.
      </Text>

      <ListGroup>
        <PressableFeedback animation={false} onPress={() => onSelect('url')}>
          <PressableFeedback.Scale>
            <ListGroup.Item disabled>
              <ListGroup.ItemPrefix>
                <Ionicons name="link-outline" size={22} color={mutedColor} />
              </ListGroup.ItemPrefix>
              <ListGroup.ItemContent>
                <ListGroup.ItemTitle>Import from URL</ListGroup.ItemTitle>
                <ListGroup.ItemDescription>Paste a link to any recipe website</ListGroup.ItemDescription>
              </ListGroup.ItemContent>
              <ListGroup.ItemSuffix iconProps={{ size: 16, color: mutedColor }} />
            </ListGroup.Item>
          </PressableFeedback.Scale>
          <PressableFeedback.Ripple />
        </PressableFeedback>

        <Separator className="mx-4" />

        <PressableFeedback animation={false} onPress={() => onSelect('photo')}>
          <PressableFeedback.Scale>
            <ListGroup.Item disabled>
              <ListGroup.ItemPrefix>
                <Ionicons name="camera-outline" size={22} color={mutedColor} />
              </ListGroup.ItemPrefix>
              <ListGroup.ItemContent>
                <ListGroup.ItemTitle>Scan a photo</ListGroup.ItemTitle>
                <ListGroup.ItemDescription>Extract a recipe from an image</ListGroup.ItemDescription>
              </ListGroup.ItemContent>
              <ListGroup.ItemSuffix iconProps={{ size: 16, color: mutedColor }} />
            </ListGroup.Item>
          </PressableFeedback.Scale>
          <PressableFeedback.Ripple />
        </PressableFeedback>

        <Separator className="mx-4" />

        <PressableFeedback animation={false} onPress={() => onSelect('scratch')}>
          <PressableFeedback.Scale>
            <ListGroup.Item disabled>
              <ListGroup.ItemPrefix>
                <Ionicons name="create-outline" size={22} color={mutedColor} />
              </ListGroup.ItemPrefix>
              <ListGroup.ItemContent>
                <ListGroup.ItemTitle>Start from scratch</ListGroup.ItemTitle>
                <ListGroup.ItemDescription>Paste or type a recipe to import</ListGroup.ItemDescription>
              </ListGroup.ItemContent>
              <ListGroup.ItemSuffix iconProps={{ size: 16, color: mutedColor }} />
            </ListGroup.Item>
          </PressableFeedback.Scale>
          <PressableFeedback.Ripple />
        </PressableFeedback>
      </ListGroup>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Import from URL sub-sheet
// ---------------------------------------------------------------------------

function ImportFromUrlSheet({
  isPresented,
  onIsPresentedChange,
  onDone,
}: {
  isPresented: boolean;
  onIsPresentedChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [url, setUrl] = useState('');
  const { importRecipe, importRecipeWithAI } = useRecipesContext();
  const [foregroundColor, mutedColor, accentForegroundColor, backgroundColor, separatorColor] = useThemeColor([
    'foreground',
    'muted',
    'accent-foreground',
    'background',
    'separator',
  ] as const);

  // Auto-fill from clipboard when sheet opens
  useEffect(() => {
    if (!isPresented) {
      setUrl('');
      return;
    }

    let mounted = true;

    const fillFromClipboard = async () => {
      try {
        const hasString = await Clipboard.hasStringAsync();

        if (!hasString || !mounted) return;

        const text = await Clipboard.getStringAsync();

        if (!mounted) return;

        // Only auto-fill if it looks like a URL
        if (/^https?:\/\/.+/i.test(text.trim())) {
          setUrl(text.trim());
        }
      } catch {
        // Clipboard access may fail silently
      }
    };

    void fillFromClipboard();

    return () => {
      mounted = false;
    };
  }, [isPresented]);

  const isValidUrl = /^https?:\/\/.+/i.test(url.trim());

  const handleImport = useCallback(() => {
    if (!isValidUrl) return;
    importRecipe(url.trim());
    onDone();
  }, [importRecipe, isValidUrl, onDone, url]);

  const handleAIImport = useCallback(() => {
    if (!isValidUrl) return;
    importRecipeWithAI(url.trim());
    onDone();
  }, [importRecipeWithAI, isValidUrl, onDone, url]);

  return (
    <ShellSheet
      isPresented={isPresented}
      onIsPresentedChange={onIsPresentedChange}
      detents={['medium']}
      initialDetent="medium"
    >
      <View style={subSheetStyles.container}>
        <Text style={[subSheetStyles.title, { color: foregroundColor }]}>
          Import from URL
        </Text>
        <Text style={[subSheetStyles.subtitle, { color: mutedColor }]}>
          Paste a link to any recipe website.
        </Text>

        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="https://example.com/recipe"
          placeholderTextColor={mutedColor}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="done"
          selectTextOnFocus
          style={[
            subSheetStyles.textInput,
            {
              color: foregroundColor,
              backgroundColor: backgroundColor,
              borderColor: separatorColor,
            },
          ]}
        />

        {/* AI Import (gradient, left) + Import (plain, right) */}
        <View className="flex-row gap-2.5">
          <Button
            variant="primary"
            size="lg"
            className="flex-1 overflow-hidden"
            isDisabled={!isValidUrl}
            onPress={handleAIImport}
          >
            <LinearGradient
              colors={['#fb7185', '#d946ef', '#6366f1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Ionicons name="flash-outline" size={20} color="#fff" />
            <Button.Label style={{ color: '#fff' }}>AI Import</Button.Label>
          </Button>
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            isDisabled={!isValidUrl}
            onPress={handleImport}
          >
            <Ionicons name="arrow-down-circle-outline" size={20} color={accentForegroundColor} />
            <Button.Label>Import</Button.Label>
          </Button>
        </View>
      </View>
    </ShellSheet>
  );
}

// ---------------------------------------------------------------------------
// Scan a photo sub-sheet
// ---------------------------------------------------------------------------

const MAX_PHOTOS = 10;

function ScanPhotoSheet({
  isPresented,
  onIsPresentedChange,
}: {
  isPresented: boolean;
  onIsPresentedChange: (open: boolean) => void;
}) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [foregroundColor, mutedColor, accentForegroundColor, dangerColor] =
    useThemeColor([
      'foreground',
      'muted',
      'accent-foreground',
      'danger',
    ] as const);

  // Reset photos when sheet closes
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
      setPhotos((prev) => [
        ...prev,
        ...result.assets.map((a) => a.uri).slice(0, remaining),
      ]);
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

  return (
    <ShellSheet
      isPresented={isPresented}
      onIsPresentedChange={onIsPresentedChange}
      detents={['medium', 'large']}
      initialDetent="medium"
    >
      <View style={subSheetStyles.container}>
        <Text style={[subSheetStyles.title, { color: foregroundColor }]}>
          Scan a Photo
        </Text>
        <Text style={[subSheetStyles.subtitle, { color: mutedColor }]}>
          Upload or take up to {MAX_PHOTOS} photos of a recipe.
        </Text>

        {/* Photo grid */}
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
                  style={[photoStyles.removeButton, { backgroundColor: dangerColor }]}
                  className="rounded-full"
                >
                  <Ionicons name="close" size={12} color="#fff" />
                </Button>
              </View>
            ))}
          </ScrollView>
        )}

        <Text style={[photoStyles.counter, { color: mutedColor }]}>
          {photos.length} / {MAX_PHOTOS} photos
        </Text>

        {/* Library (secondary, left) + Take Photo (primary, right) */}
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
        {photos.length > 0 && (
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

// ---------------------------------------------------------------------------
// Start from scratch sub-sheet
// ---------------------------------------------------------------------------

function StartFromScratchSheet({
  isPresented,
  onIsPresentedChange,
  onDone,
}: {
  isPresented: boolean;
  onIsPresentedChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [text, setText] = useState('');
  const { importRecipeWithAI } = useRecipesContext();
  const [foregroundColor, mutedColor, accentForegroundColor, surfaceColor, separatorColor] = useThemeColor([
    'foreground',
    'muted',
    'accent-foreground',
    'surface-secondary',
    'separator',
  ] as const);

  useEffect(() => {
    if (!isPresented) {
      setText('');
    }
  }, [isPresented]);

  const hasText = !!text.trim();

  const handleImport = useCallback(() => {
    if (!hasText) return;
    importRecipeWithAI(text.trim());
    onDone();
  }, [importRecipeWithAI, onDone, text, hasText]);

  return (
    <ShellSheet
      isPresented={isPresented}
      onIsPresentedChange={onIsPresentedChange}
      detents={['large']}
      initialDetent="large"
    >
      <View style={subSheetStyles.container}>
        <Text style={[subSheetStyles.title, { color: foregroundColor }]}>
          Start from Scratch
        </Text>
        <Text style={[subSheetStyles.subtitle, { color: mutedColor }]}>
          Paste or type a recipe. We'll structure it for you.
        </Text>

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Paste your recipe here…"
          placeholderTextColor={mutedColor}
          multiline
          textAlignVertical="top"
          style={[
            subSheetStyles.textArea,
            {
              color: foregroundColor,
              backgroundColor: surfaceColor,
              borderColor: separatorColor,
            },
          ]}
        />

        {/* AI Import (gradient, left) + Import (secondary, right) */}
        <View className="flex-row gap-2.5">
          <Button
            variant="primary"
            size="lg"
            className="flex-1 overflow-hidden"
            isDisabled={!hasText}
            onPress={handleImport}
          >
            <LinearGradient
              colors={['#fb7185', '#d946ef', '#6366f1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Ionicons name="flash-outline" size={20} color="#fff" />
            <Button.Label style={{ color: '#fff' }}>AI Import</Button.Label>
          </Button>
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            isDisabled={!hasText}
            onPress={handleImport}
          >
            <Ionicons name="arrow-down-circle-outline" size={20} color={accentForegroundColor} />
            <Button.Label>Import</Button.Label>
          </Button>
        </View>
      </View>
    </ShellSheet>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const menuStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  iconContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

const subSheetStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: -8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    flex: 1,
    minHeight: 200,
  },
});

const photoStyles = StyleSheet.create({
  scrollWrapper: {
    maxHeight: 110,
  },
  scrollContent: {
    gap: 10,
  },
  thumbContainer: {
    width: 90,
    height: 90,
    borderRadius: 10,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
  },
  counter: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: -8,
  },
});
