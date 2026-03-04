import { Card } from 'heroui-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { styles as screenStyles } from '@/styles/index.styles';

type RecipeEmptyStateCardProps = {
  title: string;
  description: string;
  dashedBorder?: boolean;
};

export function RecipeEmptyStateCard({
  title,
  description,
  dashedBorder = true,
}: RecipeEmptyStateCardProps) {
  return (
    <View style={styles.container}>
      <Card
        variant="secondary"
        className={dashedBorder ? 'rounded-2xl border border-dashed border-separator' : 'rounded-2xl border border-separator'}
      >
        <Card.Body style={screenStyles.emptyBody}>
          <Card.Title style={screenStyles.emptyTitle}>{title}</Card.Title>
          <Card.Description style={screenStyles.emptyDescription}>{description}</Card.Description>
        </Card.Body>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
});
