import type { SwipeableRecipeRowRef } from "@/components/home/swipeable-recipe-row";
import type { RecipeCardItem } from "@/lib/recipes/recipe-card.types";
import React, { useCallback, useEffect, useRef } from "react";
import { LayoutChangeEvent, Pressable } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { RecipeCard } from "@/components/home/recipe-card";
import { SwipeableRecipeRow } from "@/components/home/swipeable-recipe-row";

type SwipeableRecipeListItemProps = {
  item: RecipeCardItem;
  onDelete: (id: string) => void;
  onPress: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  isDeleting: boolean;
  canDelete: boolean;
};

function SwipeableRecipeListItemComponent({
  item,
  onDelete,
  onPress,
  onToggleFavorite,
  isDeleting,
  canDelete,
}: SwipeableRecipeListItemProps) {
  const rowRef = useRef<SwipeableRecipeRowRef>(null);
  const opacity = useSharedValue(1);
  const height = useSharedValue(-1);
  const naturalHeight = useRef<number>(0);

  useEffect(() => {
    if (isDeleting) {
      height.value = naturalHeight.current;
      height.value = withTiming(0, { duration: 100 });
      opacity.value = withTiming(0, { duration: 100 });
    }
  }, [height, isDeleting, opacity]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    if (naturalHeight.current === 0) {
      naturalHeight.current = event.nativeEvent.layout.height;
    }
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    if (height.value < 0) {
      return { opacity: opacity.value };
    }

    return {
      opacity: opacity.value,
      height: height.value,
      overflow: "hidden",
    };
  });

  const handleDelete = useCallback(() => {
    onDelete(item.id);
  }, [item.id, onDelete]);

  const handlePress = useCallback(() => {
    onPress(item.id);
  }, [item.id, onPress]);

  const handleDoubleTapLike = useCallback(() => {
    onToggleFavorite(item.id);
  }, [item.id, onToggleFavorite]);

  return (
    <Animated.View style={animatedStyle} onLayout={handleLayout}>
      <SwipeableRecipeRow
        ref={rowRef}
        recipeName={item.title}
        onDelete={canDelete ? handleDelete : undefined}
      >
        <Pressable onPress={handlePress}>
          <RecipeCard recipe={item} onPress={handlePress} onDoubleTapLike={handleDoubleTapLike} />
        </Pressable>
      </SwipeableRecipeRow>
    </Animated.View>
  );
}

export const SwipeableRecipeListItem = React.memo(SwipeableRecipeListItemComponent);
