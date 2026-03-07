import { Image } from 'expo-image';
import { useThemeColor } from 'heroui-native';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DummyStep } from './dummy-data';
import { MediaCarouselModal } from './media-carousel-modal';
import { SmartText } from './text-renderer';

// ─── Props ────────────────────────────────────────────────────────────────────

type RecipeStepsProps = {
  steps: DummyStep[];
};

// ─── Component ───────────────────────────────────────────────────────────────

export function RecipeSteps({ steps }: RecipeStepsProps) {
  const [foregroundColor, accentColor, accentForegroundColor, mutedColor] =
    useThemeColor([
      'foreground',
      'accent',
      'accent-foreground',
      'muted',
    ] as const);

  // Carousel state
  const [carouselVisible, setCarouselVisible] = useState(false);
  const [carouselImages, setCarouselImages] = useState<string[]>([]);
  const [carouselStartIndex, setCarouselStartIndex] = useState(0);

  const openCarousel = useCallback(
    (images: string[], startIndex: number) => {
      setCarouselImages(images);
      setCarouselStartIndex(startIndex);
      setCarouselVisible(true);
    },
    [],
  );

  // Count actual numbered steps (skip headings)
  let stepNumber = 0;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: foregroundColor }]}>
        Instructions
      </Text>

      {steps.map((step, index) => {
        const isHeading = step.text.trim().startsWith('#');

        if (isHeading) {
          const headingText = step.text.trim().replace(/^#+\s*/, '');
          return (
            <View key={index} style={styles.headingRow}>
              <Text style={[styles.headingText, { color: foregroundColor }]}>
                {headingText}
              </Text>
            </View>
          );
        }

        stepNumber++;
        const currentNumber = stepNumber;
        const stepImages = step.images ?? [];
        const imageUris = stepImages.map((si) => si.image);

        return (
          <View key={index} style={styles.stepRow}>
            {/* Step number badge */}
            <View style={[styles.stepNumber, { backgroundColor: accentColor }]}>
              <Text
                style={[
                  styles.stepNumberText,
                  { color: accentForegroundColor },
                ]}
              >
                {currentNumber}
              </Text>
            </View>

            {/* Step content */}
            <View style={styles.stepContent}>
              <SmartText
                style={[styles.stepText, { color: foregroundColor }]}
                highlightTimers
              >
                {step.text}
              </SmartText>

              {/* Step images — thumbnails that open the carousel */}
              {stepImages.length > 0 && (
                <View style={styles.imageRow}>
                  {stepImages.map((img, imgIdx) => (
                    <Pressable
                      key={imgIdx}
                      onPress={() => openCarousel(imageUris, imgIdx)}
                      style={({ pressed }) => [
                        styles.imageThumbnail,
                        { borderColor: `${mutedColor}30` },
                        pressed && styles.imageThumbnailPressed,
                      ]}
                    >
                      <Image
                        source={{ uri: img.image }}
                        contentFit="cover"
                        transition={200}
                        style={StyleSheet.absoluteFill}
                      />
                      {/* Multi-image badge */}
                      {stepImages.length > 1 && imgIdx === 0 && (
                        <View style={[styles.imageBadge, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                          <Text style={styles.imageBadgeText}>
                            {stepImages.length}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>
        );
      })}

      {/* Full-screen carousel for step images */}
      <MediaCarouselModal
        visible={carouselVisible}
        images={carouselImages}
        startIndex={carouselStartIndex}
        onClose={() => setCarouselVisible(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  headingRow: {
    marginTop: 16,
    marginBottom: 10,
    paddingLeft: 4,
  },
  headingText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
    gap: 10,
  },
  stepText: {
    fontSize: 15,
    lineHeight: 22,
  },
  imageRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  imageThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
  },
  imageThumbnailPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  imageBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
  },
  imageBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});
