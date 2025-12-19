import { ClockIcon, FireIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/16/solid";
import { Card, CardBody, Chip, Divider, Link } from "@heroui/react";
import Image from "next/image";

import AuthorChip from "./components/author-chip";
import { useRecipeContextRequired } from "./context";

import ActionsMenu from "@/app/(app)/recipes/[id]/components/actions-menu";
import AddToGroceries from "@/app/(app)/recipes/[id]/components/add-to-groceries-button";
import IngredientsList from "@/app/(app)/recipes/[id]/components/ingredient-list";
import ServingsControl from "@/app/(app)/recipes/[id]/components/servings-control";
import StepsList from "@/app/(app)/recipes/[id]/components/steps-list";
import SystemConvertMenu from "@/app/(app)/recipes/[id]/components/system-convert-menu";
import WakeLockToggle from "@/app/(app)/recipes/[id]/components/wake-lock-toggle";
import { formatMinutesHM } from "@/lib/helpers";
import SmartMarkdownRenderer from "@/components/shared/smart-markdown-renderer";
import HeartButton from "@/components/shared/heart-button";
import DoubleTapContainer from "@/components/shared/double-tap-container";
import StarRating from "@/components/shared/star-rating";
import { useFavoritesQuery, useFavoritesMutation } from "@/hooks/favorites";
import { useRatingQuery, useRatingsMutation } from "@/hooks/ratings";
import { NutritionSection } from "@/components/recipes/nutrition-card";

export default function RecipePageMobile() {
  var { recipe, currentServings } = useRecipeContextRequired();
  const { isFavorite: checkFavorite } = useFavoritesQuery();
  const { toggleFavorite } = useFavoritesMutation();
  const { userRating, averageRating, isLoading: isRatingLoading } = useRatingQuery(recipe.id);
  const { rateRecipe, isRating } = useRatingsMutation();

  const isFavorite = checkFavorite(recipe.id);
  const handleToggleFavorite = () => toggleFavorite(recipe.id);
  const handleRateRecipe = (rating: number) => rateRecipe(recipe.id, rating);

  return (
    <div className="flex w-full flex-col">
      {/* Hero Image */}
      <DoubleTapContainer
        onDoubleTap={handleToggleFavorite}
        className="bg-default-200 relative h-72 w-full overflow-hidden"
      >
        {recipe.image ? (
          <Image
            fill
            priority
            unoptimized
            alt={recipe.name ?? "Recipe image"}
            className="object-cover"
            src={recipe.image}
          />
        ) : (
          <div className="text-default-500 flex h-full w-full items-center justify-center">
            <span className="text-base font-medium opacity-70">No image available</span>
          </div>
        )}

        {/* Author chip */}
        {recipe?.author && (
          <div
            className="absolute left-4 z-50"
            style={{ top: `calc(1rem + env(safe-area-inset-top))` }}
          >
            <AuthorChip image={recipe.author.image} name={recipe.author.name} />
          </div>
        )}

        {/* Heart button - bottom right (always visible) */}
        <div className="absolute right-4 bottom-4 z-50">
          <HeartButton
            isFavorite={isFavorite}
            onToggle={handleToggleFavorite}
            size="lg"
            showBackground
          />
        </div>
      </DoubleTapContainer>

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
              <Link className="text-default-500 text-base" href="/">
                ← Back to recipes
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
                title="View original recipe"
              >
                <ArrowTopRightOnSquareIcon className="text-default-400 hover:text-primary inline h-4 w-4" />
              </a>
            )}
          </h1>

          {/* Description */}
          {recipe.description && (
            <p className="text-default-600 text-base leading-relaxed">
              <SmartMarkdownRenderer text={recipe.description} />
            </p>
          )}

          {/* Time info */}
          {(recipe.prepMinutes || recipe.totalMinutes) && (
            <div className="text-default-500 flex flex-wrap items-center gap-4 text-base">
              {recipe.prepMinutes && (
                <div className="flex items-center gap-1">
                  <ClockIcon className="h-4 w-4" />
                  {formatMinutesHM(recipe.prepMinutes)} prep
                </div>
              )}
              {recipe.totalMinutes && recipe.totalMinutes !== 0 && (
                <div className="flex items-center gap-1">
                  <FireIcon className="h-4 w-4" />
                  {formatMinutesHM(recipe.totalMinutes)} total
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          {recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {recipe.tags.map((t: { name: string }) => (
                <Chip key={t.name} size="sm" variant="flat">
                  {t.name}
                </Chip>
              ))}
            </div>
          )}

          <Divider />

          {/* Ingredients Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Ingredients</h2>
              <div className="flex items-center gap-2">
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

          {/* Steps Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Steps</h2>
              <WakeLockToggle />
            </div>

            <div className="-mx-1">
              <StepsList />
            </div>

            {/* Rating Section */}
            <div className="bg-default-100 -mx-1 flex flex-col items-center gap-4 rounded-xl py-6">
              <p className="text-default-600 font-medium">What did you think of this recipe?</p>
              <StarRating
                value={userRating ?? averageRating}
                onChange={handleRateRecipe}
                isLoading={isRating || isRatingLoading}
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
