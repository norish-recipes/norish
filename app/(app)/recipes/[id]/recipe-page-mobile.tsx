import {
  ClockIcon,
  FireIcon,
  ArrowTopRightOnSquareIcon,
  ArrowLeftIcon,
  SunIcon,
  MoonIcon,
  CakeIcon,
} from "@heroicons/react/16/solid";
import { Card, CardBody, Chip, Divider, Link } from "@heroui/react";
import { useTranslations } from "next-intl";

import AuthorChip from "./components/author-chip";
import { useRecipeContextRequired } from "./context";

import ActionsMenu from "@/app/(app)/recipes/[id]/components/actions-menu";
import AddToGroceries from "@/app/(app)/recipes/[id]/components/add-to-groceries-button";
import IngredientsList from "@/app/(app)/recipes/[id]/components/ingredient-list";
import ServingsControl from "@/app/(app)/recipes/[id]/components/servings-control";
import AmountDisplayToggle from "@/app/(app)/recipes/[id]/components/amount-display-toggle";
import StepsList from "@/app/(app)/recipes/[id]/components/steps-list";
import SystemConvertMenu from "@/app/(app)/recipes/[id]/components/system-convert-menu";
import WakeLockToggle from "@/app/(app)/recipes/[id]/components/wake-lock-toggle";
import { formatMinutesHM, sortTagsWithAllergyPriority, isAllergenTag } from "@/lib/helpers";
import SmartMarkdownRenderer from "@/components/shared/smart-markdown-renderer";
import HeartButton from "@/components/shared/heart-button";
import DoubleTapContainer from "@/components/shared/double-tap-container";
import StarRating from "@/components/shared/star-rating";
import MediaCarousel, { buildMediaItems } from "@/components/shared/media-carousel";
import { useFavoritesQuery, useFavoritesMutation } from "@/hooks/favorites";
import { useRatingQuery, useRatingsMutation } from "@/hooks/ratings";
import { NutritionSection } from "@/components/recipes/nutrition-card";
import { MOBILE_RECIPE_MEDIA_HEIGHT_STYLE } from "@/app/(app)/recipes/[id]/recipe-layout-constants";

export default function RecipePageMobile() {
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
  const tForm = useTranslations("recipes.form");

  const isFavorite = checkFavorite(recipe.id);
  const handleToggleFavorite = () => toggleFavorite(recipe.id);
  const handleRateRecipe = (rating: number) => rateRecipe(recipe.id, rating);

  // Build media items for MediaCarousel (videos + images)
  const mediaItems = buildMediaItems(recipe);

  return (
    <div
      className="flex w-full flex-col"
      style={{ marginTop: "calc(-1.5rem - env(safe-area-inset-top))" }}
    >
      {/* Hero Image/Video Carousel */}
      <div
        className="relative w-full overflow-hidden"
        style={{ height: MOBILE_RECIPE_MEDIA_HEIGHT_STYLE }}
      >
        <DoubleTapContainer className="h-full w-full" onDoubleTap={handleToggleFavorite}>
          <MediaCarousel
            aspectRatio="4/3"
            className="h-full w-full"
            items={mediaItems}
            rounded={false}
          />
        </DoubleTapContainer>

        {/* Author chip */}
        {recipe?.author && (
          <div
            className="absolute left-4 z-50"
            style={{ top: `calc(3.5rem + env(safe-area-inset-top))` }}
          >
            <AuthorChip
              image={recipe.author.image}
              name={recipe.author.name}
              userId={recipe.author.id}
            />
          </div>
        )}

        {/* Heart button - bottom right (always visible) */}
        <div className="absolute right-4 bottom-8 z-50">
          <HeartButton
            showBackground
            isFavorite={isFavorite}
            size="lg"
            onToggle={handleToggleFavorite}
          />
        </div>
      </div>

      {/* Unified Content Card - contains all sections */}
      <Card
        className="bg-content1 relative z-10 -mt-6 overflow-visible rounded-t-3xl"
        radius="none"
        shadow="sm"
      >
        <CardBody className="space-y-6 px-4 py-5">
          {/* Back link and Actions */}
          <div className="flex items-center justify-between">
            <div className="w-fit hover:underline">
              <Link className="text-default-500 flex items-center gap-1 text-base" href="/">
                <ArrowLeftIcon className="h-4 w-4" />
                {t("backToRecipes")}
              </Link>
            </div>
            <div className="flex-shrink-0">
              <ActionsMenu id={recipe.id} />
            </div>
          </div>

          {/* Title */}
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

          {/* Description */}
          {recipe.description && (
            <p className="text-base leading-relaxed">
              <SmartMarkdownRenderer text={recipe.description} />
            </p>
          )}

          {/* Categories */}
          {recipe.categories.length > 0 && (
            <div className="text-default-500 flex flex-wrap items-center gap-4 text-base">
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
                    {tForm(`category.${category.toLowerCase()}`)}
                  </span>
                );
              })}
            </div>
          )}

          {/* Time info */}
          {(recipe.prepMinutes || recipe.totalMinutes) && (
            <div className="text-default-500 flex flex-wrap items-center gap-4 text-base">
              {recipe.prepMinutes && (
                <div className="flex items-center gap-1">
                  <ClockIcon className="h-4 w-4" />
                  {formatMinutesHM(recipe.prepMinutes)} {t("prep")}
                </div>
              )}
              {recipe.totalMinutes && recipe.totalMinutes !== 0 && (
                <div className="flex items-center gap-1">
                  <FireIcon className="h-4 w-4" />
                  {formatMinutesHM(recipe.totalMinutes)} {t("total")}
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          {recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {sortTagsWithAllergyPriority(recipe.tags, allergies).map((tag: { name: string }) => {
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
              })}
            </div>
          )}

          <Divider />

          {/* Ingredients Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("ingredients")}</h2>
              <div className="flex items-center gap-2">
                <AmountDisplayToggle />
                <ServingsControl />
                {recipe.systemUsed && <SystemConvertMenu />}
              </div>
            </div>

            <div className="-mx-1">
              <IngredientsList />
            </div>

            {/* Add to groceries button - below ingredients */}
            <AddToGroceries recipeId={recipe.id} />
          </div>

          <Divider />

          {/* Notes */}
          {recipe.notes && (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{t("notes")}</h2>
                </div>
                <div>
                  <SmartMarkdownRenderer text={recipe.notes} />
                </div>
              </div>
              <Divider />
            </>
          )}

          {/* Steps Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("steps")}</h2>
              <WakeLockToggle />
            </div>

            <div className="-mx-1">
              <StepsList />
            </div>

            {/* Rating Section */}
            <div className="bg-default-100 -mx-1 flex flex-col items-center gap-4 rounded-xl py-6">
              <p className="text-default-600 font-medium">{t("ratingPrompt")}</p>
              <StarRating
                isLoading={isRating || isRatingLoading}
                value={userRating ?? averageRating}
                onChange={handleRateRecipe}
              />
            </div>
          </div>

          {/* Nutrition Section */}
          <NutritionSection />
        </CardBody>
      </Card>

      <div className="pb-5" />
    </div>
  );
}
