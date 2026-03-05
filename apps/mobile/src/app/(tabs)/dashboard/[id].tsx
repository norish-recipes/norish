import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Card } from 'heroui-native';
import React, { useMemo } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useIntl } from 'react-intl';

import { useTRPC } from '@/providers/trpc-provider';

export default function RecipeDetailScreen() {
  const intl = useIntl();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = useMemo(() => (typeof params.id === 'string' ? params.id : ''), [params.id]);
  const trpc = useTRPC();
  const recipeQuery = useQuery(
    trpc.recipes.get.queryOptions(
      { id },
      {
        enabled: id.length > 0,
      },
    ),
  );

  const recipe = recipeQuery.data;

  return (
    <>
      <Stack.Screen options={{ title: recipe?.name ?? intl.formatMessage({ id: 'recipes.detail.notFound' }) }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {recipeQuery.isLoading ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <ActivityIndicator />
          </View>
        ) : recipe ? (
          <Card variant="secondary" className="rounded-2xl">
            <Card.Body className="gap-3">
              <Text style={{ fontSize: 22, fontWeight: '700' }}>{recipe.name}</Text>
              {recipe.description ? (
                <Text style={{ fontSize: 15, opacity: 0.8 }}>{recipe.description}</Text>
              ) : null}
              <Text style={{ fontSize: 14, opacity: 0.7 }}>
                {intl.formatMessage({ id: 'recipes.form.servings' })}: {recipe.servings} ·{' '}
                {intl.formatMessage({ id: 'recipes.timeInputs.total' })}: {recipe.totalMinutes ?? 0}{' '}
                {intl.formatMessage({ id: 'common.time.minutes' })}
              </Text>
            </Card.Body>
          </Card>
        ) : (
          <Card variant="secondary" className="rounded-2xl border border-separator">
            <Card.Body>
              <Text style={{ fontSize: 16, fontWeight: '600' }}>
                {intl.formatMessage({ id: 'recipes.detail.notFound' })}
              </Text>
            </Card.Body>
          </Card>
        )}
      </ScrollView>
    </>
  );
}
