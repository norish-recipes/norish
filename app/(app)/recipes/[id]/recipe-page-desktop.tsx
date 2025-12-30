"use client";

import { useState } from "react";
import {
  WrenchScrewdriverIcon,
  FireIcon,
  ClockIcon,
  ArrowTopRightOnSquareIcon,
  ArrowLeftIcon,
} from "@heroicons/react/20/solid";
import { Card, CardBody, CardHeader, Chip } from "@heroui/react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

import AuthorChip from "./components/author-chip";
import { useRecipeContextRequired } from "./context";
import ServingsControl from "./components/servings-control";

import { formatMinutesHM } from "@/lib/helpers";
import SystemConvertMenu from "@/app/(app)/recipes/[id]/components/system-convert-menu";
import StepsList from "@/app/(app)/recipes/[id]/components/steps-list";
import IngredientsList from "@/app/(app)/recipes/[id]/components/ingredient-list";
import ActionsMenu from "@/app/(app)/recipes/[id]/components/actions-menu";
import AddToGroceries from "@/app/(app)/recipes/[id]/components/add-to-groceries-button";
import WakeLockToggle from "@/app/(app)/recipes/[id]/components/wake-lock-toggle";
import ImageLightbox from "@/components/shared/image-lightbox";
import SmartMarkdownRenderer from "@/components/shared/smart-markdown-renderer";
import HeartButton from "@/components/shared/heart-button";
import DoubleTapContainer from "@/components/shared/double-tap-container";
import StarRating from "@/components/shared/star-rating";
import { useFavoritesQuery, useFavoritesMutation } from "@/hooks/favorites";
import { useRatingQuery, useRatingsMutation } from "@/hooks/ratings";
import NutritionCard from "@/components/recipes/nutrition-card";

export default function RecipePageDesktop() {
  var { recipe, currentServings: _currentServings } = useRecipeContextRequired();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { isFavorite: checkFavorite } = useFavoritesQuery();
  const { toggleFavorite } = useFavoritesMutation();
  const { userRating, averageRating, isLoading: isRatingLoading } = useRatingQuery(recipe.id);
  const { rateRecipe, isRating } = useRatingsMutation();
  const t = useTranslations("recipes.detail");
  const tCard = useTranslations("recipes.card");

  const isFavorite = checkFavorite(recipe.id);
  const handleToggleFavorite = () => toggleFavorite(recipe.id);
  const handleRateRecipe = (rating: number) => rateRecipe(recipe.id, rating);

  return (
    <div className="hidden flex-col space-y-6 px-6 pb-10 md:flex">
      {/* Back link */}
      <div className="w-fit">
        <Link className="text-default-500 flex items-center gap-1 text-base hover:underline" href="/">
          <ArrowLeftIcon className="h-4 w-4" />
          {t("backToRecipes")}
        </Link>
      </div>

      {/* Main content grid: 2 columns */}
      <div className="grid grid-cols-5 gap-6">
        {/* LEFT column: Info card + Ingredients card (stacked) */}
        <div className="col-span-2 flex flex-col gap-6">
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
                <p className="text-default-600 text-base leading-relaxed">
                  <SmartMarkdownRenderer text={recipe.description} />
                </p>
              )}

              {/* Meta info row */}
              {(recipe.prepMinutes || recipe.cookMinutes || recipe.totalMinutes !== 0) && (
                <div className="text-default-500 flex flex-wrap items-center gap-4 text-base">
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
                  {recipe.tags.map((tag: { name: string }) => (
                    <Chip key={tag.name} size="sm" variant="flat">
                      {tag.name}
                    </Chip>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Ingredients Card (separate) */}
          <Card className="bg-content1 rounded-2xl shadow-md">
            <CardBody className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{t("ingredients")}</h2>
                <div className="flex items-center gap-2">
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
        <div className="col-span-3 flex flex-col gap-6">
          {/* Hero image */}
          <DoubleTapContainer
            className="bg-default-200 relative min-h-[400px] overflow-hidden rounded-2xl"
            onDoubleTap={handleToggleFavorite}
          >
            {recipe.image ? (
              <Image
                fill
                unoptimized
                alt={recipe.name ?? "Recipe image"}
                className="h-full w-full object-cover"
                src={recipe.image}
              />
            ) : (
              <div className="text-default-500 flex h-full w-full items-center justify-center">
                <span className="text-base font-medium opacity-70">{tCard("noImage")}</span>
              </div>
            )}

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
          </DoubleTapContainer>

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

      {recipe.image && (
        <ImageLightbox
          images={[{ src: recipe.image, alt: recipe.name ?? "Recipe image" }]}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}
