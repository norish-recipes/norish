import React from "react";
import { Text, View } from "react-native";
import { Chip } from "heroui-native";
import { useIntl } from "react-intl";

import { useHiddenItemVisibility } from "@norish/shared-react/reader";
import { useLoadedPageRecipe, usePageEnrichment } from "@norish/shared-react/recipes";
import { hasSubstantiveProvenance } from "@norish/shared/lib/recipe-enrichment";
import { countryEndonym, countryFlagEmoji } from "@norish/shared/lib/recipe-provenance";

import { SectionCard } from "./tint";

/** Where the dish comes from: country, region, cuisines and a note. */
export function ProvenanceSection() {
  const intl = useIntl();
  const recipe = useLoadedPageRecipe();
  const enrichment = usePageEnrichment();
  const { showProvenance } = useHiddenItemVisibility();
  const inferring = enrichment.isBusy("recipe-provenance");

  if (!showProvenance || (!hasSubstantiveProvenance(recipe) && !inferring)) return null;

  const flag = countryFlagEmoji(recipe.originCountry);
  const country = inferring
    ? null
    : (recipe.originCountryName ?? countryEndonym(recipe.originCountry, intl.locale));
  const title = `${flag ? `${flag} ` : ""}${country ?? intl.formatMessage({ id: "recipes.provenance.title" })}`;

  return (
    <SectionCard testID="recipe-provenance" title={title}>
      {inferring ? (
        <Text className="text-muted pb-2 text-sm">
          {intl.formatMessage({ id: "recipes.actions.inferringProvenance" })}
        </Text>
      ) : (
        <View className="gap-3">
          {recipe.originRegion ? (
            <View className="flex-row items-baseline gap-2">
              <Text className="text-muted text-sm">
                {intl.formatMessage({ id: "recipes.provenance.region" })}
              </Text>
              <Text className="text-foreground text-base">{recipe.originRegion}</Text>
            </View>
          ) : null}
          {recipe.cuisines.length > 0 ? (
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="text-muted text-sm">
                {intl.formatMessage({ id: "recipes.provenance.cuisines" })}
              </Text>
              {recipe.cuisines.map((cuisine) => (
                <Chip key={cuisine.id} size="sm" variant="secondary">
                  <Chip.Label>{cuisine.name}</Chip.Label>
                </Chip>
              ))}
            </View>
          ) : null}
          {recipe.provenanceNote ? (
            <Text className="text-foreground text-base leading-6">{recipe.provenanceNote}</Text>
          ) : null}
        </View>
      )}
    </SectionCard>
  );
}
