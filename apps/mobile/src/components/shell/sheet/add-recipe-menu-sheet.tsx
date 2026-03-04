import Ionicons from '@expo/vector-icons/Ionicons';
import { ListGroup, PressableFeedback, Separator, useThemeColor } from 'heroui-native';
import React from 'react';
import { Text, View } from 'react-native';

import { colorStyles, menuStyles } from '@/components/shell/sheet/add-recipe-sheet.styles';

interface AddRecipeMenuSheetProps {
  onSelect: (sub: 'url' | 'photo' | 'scratch') => void;
}

export function AddRecipeMenuSheet({ onSelect }: AddRecipeMenuSheetProps) {
  const [foregroundColor, mutedColor] = useThemeColor(['foreground', 'muted'] as const);

  return (
    <View style={menuStyles.container}>
      <View style={menuStyles.iconContainer}>
        <Ionicons name="restaurant-outline" size={40} color={mutedColor} />
      </View>

      <Text style={[menuStyles.title, colorStyles.text(foregroundColor)]}>Add Recipe</Text>
      <Text style={[menuStyles.subtitle, colorStyles.text(mutedColor)]}>
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
