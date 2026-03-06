import { useThemeColor } from 'heroui-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type RecipeStepsProps = {
  steps: string[];
};

export function RecipeSteps({ steps }: RecipeStepsProps) {
  const [foregroundColor, accentColor, accentForegroundColor] = useThemeColor([
    'foreground',
    'accent',
    'accent-foreground',
  ] as const);

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: foregroundColor }]}>
        Instructions
      </Text>
      {steps.map((step, index) => (
        <View key={index} style={styles.stepRow}>
          <View style={[styles.stepNumber, { backgroundColor: accentColor }]}>
            <Text
              style={[styles.stepNumberText, { color: accentForegroundColor }]}
            >
              {index + 1}
            </Text>
          </View>
          <Text style={[styles.stepText, { color: foregroundColor }]}>
            {step}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
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
  stepText: {
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
});
