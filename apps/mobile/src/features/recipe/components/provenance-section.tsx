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
        <View>
          {recipe.originRegion ? (
            <View className="border-separator flex-row items-center justify-between border-t py-3">
              <Text className="text-muted text-base">
                {intl.formatMessage({ id: "recipes.provenance.region" })}
              </Text>
              <Text className="text-foreground text-base">{recipe.originRegion}</Text>
            </View>
          ) : null}
          {recipe.cuisines.length > 0 ? (
            <View className="border-separator flex-row items-center gap-3 border-t py-2.5">
              <Text className="text-muted text-base">
                {intl.formatMessage({ id: "recipes.provenance.cuisines" })}
              </Text>
              <View className="flex-1 flex-row flex-wrap justify-end gap-2">
                {recipe.cuisines.map((cuisine) => (
                  <Chip key={cuisine.id} size="sm" variant="secondary">
                    <Chip.Label>{cuisine.name}</Chip.Label>
                  </Chip>
                ))}
              </View>
            </View>
          ) : null}
          {recipe.provenanceNote ? (
            <Text className="text-muted border-separator border-t pt-3 text-base leading-6">
              {recipe.provenanceNote}
            </Text>
          ) : null}
        </View>
      )}
    </SectionCard>
  );
}
