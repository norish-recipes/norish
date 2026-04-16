import React from "react";
import { ScrollView, Text } from "react-native";
import { Card, useThemeColor } from "heroui-native";

export function SimpleTabScreen({
  title,
  subtitle,
  body,
}: {
  title: string;
  subtitle: string;
  body: string;
}) {
  const [textColor, mutedColor] = useThemeColor(["foreground", "muted"]);

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 16 }}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustsScrollIndicatorInsets
      showsVerticalScrollIndicator={false}
    >
      <Card variant="secondary">
        <Card.Body style={{ padding: 16 }}>
          <Card.Title style={{ color: textColor }}>{title}</Card.Title>
          <Card.Description style={{ marginTop: 6, color: mutedColor }}>{body}</Card.Description>
        </Card.Body>
      </Card>
      <Text style={{ color: mutedColor, fontSize: 13, lineHeight: 19 }}>
        Scroll this page to validate native tab minimize-on-scroll behavior.
      </Text>
      {Array.from({ length: 8 }).map((_, index) => (
        <Card key={index} variant="secondary">
          <Card.Body style={{ padding: 16 }}>
            <Text style={{ color: textColor, fontWeight: "600" }}>
              {title} item {index + 1}
            </Text>
            <Text style={{ marginTop: 4, color: mutedColor }}>
              Placeholder content for destination validation.
            </Text>
          </Card.Body>
        </Card>
      ))}
    </ScrollView>
  );
}
