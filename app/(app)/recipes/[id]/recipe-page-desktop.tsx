"use client";

import {
  WrenchScrewdriverIcon,
  FireIcon,
  ClockIcon,
  ArrowTopRightOnSquareIcon,
  ArrowLeftIcon,
  SunIcon,
  MoonIcon,
  CakeIcon,
} from "@heroicons/react/16/solid";
import { Card, CardBody, CardHeader, Chip } from "@heroui/react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import AuthorChip from "./components/author-chip";
import { useRecipeContextRequired } from "./context";
import ServingsControl from "./components/servings-control";
import AmountDisplayToggle from "./components/amount-display-toggle";

import { formatMinutesHM, sortTagsWithAllergyPriority, isAllergenTag } from "@/lib/helpers";
import SystemConvertMenu from "@/app/(app)/recipes/[id]/components/system-convert-menu";
import StepsList from "@/app/(app)/recipes/[id]/components/steps-list";
import IngredientsList from "@/app/(app)/recipes/[id]/components/ingredient-list";
import ActionsMenu from "@/app/(app)/recipes/[id]/components/actions-menu";
import AddToGroceries from "@/app/(app)/recipes/[id]/components/add-to-groceries-button";
import WakeLockToggle from "@/app/(app)/recipes/[id]/components/wake-lock-toggle";
import MediaCarousel, { buildMediaItems } from "@/components/shared/media-carousel";
import SmartMarkdownRenderer from "@/components/shared/smart-markdown-renderer";
import HeartButton from "@/components/shared/heart-button";
import DoubleTapContainer from "@/components/shared/double-tap-container";
import StarRating from "@/components/shared/star-rating";
import { useFavoritesQuery, useFavoritesMutation } from "@/hooks/favorites";
import { useRatingQuery, useRatingsMutation } from "@/hooks/ratings";
import NutritionCard from "@/components/recipes/nutrition-card";

export default function RecipePageDesktop() {
  const {
    recipe,
    currentServings: _currentServings,
    allergies,
    allergySet,
  } = useRecipeContextRequired();
  const { isFavorite: checkFavorite } = useFavoritesQuery();
  const { toggleFavorite } = useFavoritesMutation();
  const { userRating, averageRating, isLoading: isRatingLoading } = useRatingQuery(recipe.id);
  const { rateRecipe, isRating } = useRatingsMutation();
  const t = useTranslations("recipes.detail");

  const isFavorite = checkFavorite(recipe.id);
  const handleToggleFavorite = () => toggleFavorite(recipe.id);
  const handleRateRecipe = (rating: number) => rateRecipe(recipe.id, rating);

  // Build media items for MediaCarousel (videos + images)
  const mediaItems = buildMediaItems(recipe);

  return (
    <div className="hidden flex-col space-y-6 px-6 pb-10 md:flex">
      {/* Back link */}
      <div className="w-fit">
        <Link
          className="text-default-500 flex items-center gap-1 text-base hover:underline"
          href="/"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {t("backToRecipes")}
        </Link>
      </div>

      {/* Main content grid: 2 columns */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
        {/* LEFT column: Info card + Ingredients card (stacked) */}
        <div className="flex flex-col gap-6 md:col-span-1 lg:col-span-2">
          {/* Info Card */}
          <Card className="bg-content1 rounded-2xl shadow-md">
            <CardBody className="space-y-4 p-6">
              {/* Title and Actions */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h1 className="text-2xl leading-tight font-bold">
                    {recipe.name}
                    {recipe.url && (
                      <a
                        className="ml-2 inline-block align-middle"
                        href={recipe.url}
                        rel="noopener noreferrer"
                        target="_blank"
                        title={t("viewOriginal")}
                      >
                        <ArrowTopRightOnSquareIcon className="text-default-400 hover:text-primary inline h-4 w-4" />
                      </a>
                    )}
                  </h1>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <ActionsMenu id={recipe.id} />
                </div>
              </div>

              {/* Description */}
              {recipe.description && (
                <p className="text-base leading-relaxed">
                  <SmartMarkdownRenderer text={recipe.description} />
                </p>
              )}

              {/* Categories */}
              {recipe.categories.length > 0 && (
                <div className="text-default-500 flex flex-wrap items-center gap-x-4 gap-y-2 text-base">
                  {recipe.categories.map((category) => {
                    const IconComponent =
                      {
                        Breakfast: FireIcon,
                        Lunch: SunIcon,
                        Dinner: MoonIcon,
                        Snack: CakeIcon,
                      }[category] || SunIcon;

                    return (
                      <span key={category} className="flex items-center gap-1">
                        <IconComponent className="h-4 w-4" />
                        {category}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Meta info row */}
              {(recipe.prepMinutes || recipe.cookMinutes || recipe.totalMinutes !== 0) && (
                <div className="text-default-500 flex flex-wrap items-center gap-x-4 gap-y-2 text-base">
                  {recipe.prepMinutes && recipe.prepMinutes > 0 && (
                    <span className="flex items-center gap-1">
                      <WrenchScrewdriverIcon className="h-4 w-4" />
                      {formatMinutesHM(recipe.prepMinutes)}
                    </span>
                  )}
                  {recipe.cookMinutes && (
                    <span className="flex items-center gap-1">
                      <FireIcon className="h-4 w-4" />
                      {formatMinutesHM(recipe.cookMinutes)}
                    </span>
                  )}
                  {recipe.totalMinutes && recipe.totalMinutes !== 0 && (
                    <span className="flex items-center gap-1">
                      <ClockIcon className="h-4 w-4" />
                      {formatMinutesHM(recipe.totalMinutes)}
                    </span>
                  )}
                </div>
              )}

              {/* Tags */}
              {recipe.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {sortTagsWithAllergyPriority(recipe.tags, allergies).map(
                    (tag: { name: string }) => {
                      const isAllergen = isAllergenTag(tag.name, allergySet);

                      return (
                        <Chip
                          key={tag.name}
                          className={isAllergen ? "bg-warning text-warning-foreground" : ""}
                          size="sm"
                          variant="flat"
                        >
                          {tag.name}
                        </Chip>
                      );
                    }
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Ingredients Card (separate) */}
          <Card className="bg-content1 rounded-2xl shadow-md">
            <CardBody className="space-y-4 p-6">
              <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
                <h2 className="text-lg font-semibold">{t("ingredients")}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <AmountDisplayToggle />
                  {recipe.servings && <ServingsControl />}
                  {recipe.systemUsed && <SystemConvertMenu />}
                </div>
              </div>

              <IngredientsList />

              {/* Add to groceries button */}
              <AddToGroceries recipeId={recipe.id} />
            </CardBody>
          </Card>

          {/* Nutrition Card */}
          <NutritionCard />
        </div>

        {/* RIGHT column: Image + Steps (stacked) */}
        <div className="flex flex-col gap-6 md:col-span-1 lg:col-span-3">
          {/* Hero image/video carousel - wrapped to match Card styling */}
          <div className="relative overflow-hidden rounded-2xl shadow-md">
            <DoubleTapContainer onDoubleTap={handleToggleFavorite}>
              <MediaCarousel className="min-h-[400px]" items={mediaItems} rounded={false} />
            </DoubleTapContainer>

            {/* Heart button - top right (always visible) */}
            <div className="absolute top-4 right-4 z-50">
              <HeartButton
                showBackground
                isFavorite={isFavorite}
                size="lg"
                onToggle={handleToggleFavorite}
              />
            </div>

            {/* Author badge */}
            {recipe.author && (
              <div className="absolute top-4 left-4 z-50">
                <AuthorChip image={recipe.author.image} name={recipe.author.name} />
              </div>
            )}
          </div>

          {/* Notes */}
          {recipe.notes && (
            <Card className="bg-content1 rounded-2xl shadow-md">
              <CardHeader className="flex items-center justify-between px-6 pt-6">
                <h2 className="text-lg font-semibold">{t("notes")}</h2>
              </CardHeader>
              <CardBody className="p-6 pt-0">
                <SmartMarkdownRenderer text={recipe.notes} />
              </CardBody>
            </Card>
          )}

          {/* Steps Card (below image in right column) */}
          <Card className="bg-content1 rounded-2xl shadow-md">
            <CardHeader className="flex items-center justify-between px-6 pt-6">
              <h2 className="text-lg font-semibold">{t("steps")}</h2>
              <WakeLockToggle />
            </CardHeader>
            <CardBody className="px-3 pt-2 pb-0">
              <StepsList />
            </CardBody>

            {/* Rating Section */}
            <div className="bg-default-100 mx-3 mt-4 mb-3 flex flex-col items-center gap-4 rounded-xl py-6">
              <p className="text-default-600 font-medium">{t("ratingPrompt")}</p>
              <StarRating
                isLoading={isRating || isRatingLoading}
                value={userRating ?? averageRating}
                onChange={handleRateRecipe}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
