import Feather from '@expo/vector-icons/Feather';
import { Avatar, useThemeColor } from 'heroui-native';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

type RecipeAuthorProps = {
  name: string;
  initials: string;
};

export function RecipeAuthor({ name, initials }: RecipeAuthorProps) {
  const foregroundColor = useThemeColor('foreground');

  return (
    <Pressable style={styles.container}>
      <Avatar alt={name} size="sm" className="size-8 border-foreground/20">
        <Avatar.Fallback>
          <Text style={styles.fallbackText}>{initials}</Text>
        </Avatar.Fallback>
      </Avatar>
      <Text style={[styles.name, { color: foregroundColor }]}>{name}</Text>
      <Feather name="chevron-right" size={16} color={foregroundColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  fallbackText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  name: {
    fontSize: 15,
    marginLeft: 8,
    flex: 1,
  },
});
