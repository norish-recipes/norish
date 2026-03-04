import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Chip } from 'heroui-native';
import React from 'react';
import { ScrollView, View } from 'react-native';

import type { RecipeCardItem } from '@/lib/recipes/recipe-card.types';
import { styles } from '@/styles/recipe-card.styles';

type RecipeCardImageProps = {
  recipe: RecipeCardItem;
  likedColor: string;
};

export function RecipeCardImage({ recipe, likedColor }: RecipeCardImageProps) {
  const tags = recipe.tags ?? [];

  return (
    <View className="relative w-full overflow-hidden bg-black" style={styles.imageContainer}>
      <Image
        source={
          recipe.imageHeaders ? { uri: recipe.imageUrl, headers: recipe.imageHeaders } : { uri: recipe.imageUrl }
        }
        contentFit="cover"
        transition={300}
        style={styles.imageFill}
      />

      {recipe.liked ? (
        <View className="absolute left-2.5 top-2.5">
          <BlurView intensity={60} tint="dark" style={styles.heartPill}>
            <Ionicons name="heart" size={13} color={likedColor} />
          </BlurView>
        </View>
      ) : null}

      {tags.length > 0 ? (
        <View className="absolute inset-x-0 bottom-0 pb-2.5" pointerEvents="box-none">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagRow}>
            {tags.map((chip) => (
              <Chip
                key={`${recipe.id}-${chip}`}
                size="sm"
                variant="soft"
                color="default"
                animation="disable-all"
                className="shrink-0 bg-black/40 backdrop-blur-md"
              >
                <Chip.Label className="text-white text-xs">{chip}</Chip.Label>
              </Chip>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
