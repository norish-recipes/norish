import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { Avatar, useThemeColor } from "heroui-native";

import type { AuthorDTO } from "@norish/shared/contracts";

type RecipeAuthorProps = {
  author: AuthorDTO | undefined;
};

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join("");
}

export function RecipeAuthor({ author }: RecipeAuthorProps) {
  const foregroundColor = useThemeColor("foreground");

  if (!author?.name) return null;

  const initials = getInitials(author.name);

  return (
    <Pressable style={styles.container}>
      <Avatar alt={author.name} size="sm" className="border-foreground/20 size-8">
        <Avatar.Fallback>
          <Text style={styles.fallbackText}>{initials}</Text>
        </Avatar.Fallback>
      </Avatar>
      <Text style={[styles.name, { color: foregroundColor }]}>{author.name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  fallbackText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ffffff",
  },
  name: {
    fontSize: 15,
    marginLeft: 8,
    flex: 1,
  },
});
