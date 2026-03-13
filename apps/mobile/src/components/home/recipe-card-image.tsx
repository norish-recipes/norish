import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Chip } from 'heroui-native';
import React from 'react';
import { ScrollView, View } from 'react-native';

import type { RecipeCardItem } from '@/lib/recipes/recipe-card.types';
import { styles } from '@/styles/recipe-card.styles';

import { isAllergenTag, sortTagsWithAllergyPriority } from '@norish/shared/lib/helpers';

type RecipeCardImageProps = {
  recipe: RecipeCardItem;
  likedColor: string;
};

export function RecipeCardImage({ recipe, likedColor }: RecipeCardImageProps) {
  const allergies = recipe.allergies ?? [];
  const allergySet = React.useMemo(
    () => new Set(allergies.map((item) => item.toLowerCase())),
    [allergies],
  );
  const tags = React.useMemo(() => {
    const sorted = sortTagsWithAllergyPriority(
      (recipe.tags ?? []).map((name) => ({ name })),
      allergies,
    ).map((tag) => tag.name);

    if (!recipe.liked || sorted.includes('favorite')) {
      return sorted;
    }

    const allergyCount = sorted.filter((tag) => isAllergenTag(tag, allergySet)).length;
    return [...sorted.slice(0, allergyCount), 'favorite', ...sorted.slice(allergyCount)];
  }, [recipe.tags, recipe.liked, allergies, allergySet]);

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
            {tags.map((chip) => {
              const isAllergen = isAllergenTag(chip, allergySet);
              const isFavoriteTag = chip.toLowerCase() === 'favorite';

              return (
                <Chip
                  key={`${recipe.id}-${chip}`}
                  size="sm"
                  variant="soft"
                  color={isAllergen ? 'warning' : isFavoriteTag ? 'success' : 'default'}
                  animation="disable-all"
                  className={
                    isAllergen || isFavoriteTag
                      ? 'shrink-0'
                      : 'shrink-0 bg-black/40 backdrop-blur-md'
                  }
                >
                  <Chip.Label className={`text-xs ${isAllergen || isFavoriteTag ? '' : 'text-white'}`}>
                    {chip}
                  </Chip.Label>
                </Chip>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
