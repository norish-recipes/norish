"use client";

import { useState } from "react";
import {
  WrenchScrewdriverIcon,
  FireIcon,
  ClockIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/16/solid";
import { Card, CardBody, CardHeader, Chip, Divider } from "@heroui/react";
import Image from "next/image";
import Link from "next/link";

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
import { useFavoritesQuery, useFavoritesMutation } from "@/hooks/favorites";

export default function RecipePageDesktop() {
  var { recipe } = useRecipeContextRequired();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { isFavorite: checkFavorite } = useFavoritesQuery();
  const { toggleFavorite } = useFavoritesMutation();

  const isFavorite = checkFavorite(recipe.id);
  const handleToggleFavorite = () => toggleFavorite(recipe.id);

  return (
    <div className="hidden flex-col space-y-6 px-6 pb-10 md:flex">
      {/* Back link */}
      <div className="w-fit">
        <Link className="text-default-500 text-sm hover:underline" href="/">
          ← Back to recipes
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
                  <h1 className="text-2xl font-bold leading-tight">
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
                </div>
                <div className="ml-4 flex-shrink-0">
                  <ActionsMenu id={recipe.id} />
                </div>
              </div>

              {/* Description */}
              {recipe.description && (
                <p className="text-default-600 text-sm leading-relaxed">
                  <SmartMarkdownRenderer text={recipe.description} />
                </p>
              )}

              {/* Meta info row */}
              {(recipe.prepMinutes || recipe.cookMinutes || recipe.totalMinutes !== 0) && (
                <div className="text-default-500 flex flex-wrap items-center gap-4 text-sm">
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
                  {recipe.tags.map((t: { name: string }) => (
                    <Chip key={t.name} size="sm" variant="flat">
                      {t.name}
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
                <h2 className="text-lg font-semibold">Ingredients</h2>
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
        </div>

        {/* RIGHT column: Image + Steps (stacked) */}
        <div className="col-span-3 flex flex-col gap-6">
          {/* Hero image */}
          <DoubleTapContainer
            onDoubleTap={handleToggleFavorite}
            className="bg-default-200 relative min-h-[400px] overflow-hidden rounded-2xl"
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
                <span className="text-sm font-medium opacity-70">No image available</span>
              </div>
            )}

            {/* Heart button - top right (always visible) */}
            <div className="absolute top-4 right-4 z-50">
              <HeartButton
                isFavorite={isFavorite}
                onToggle={handleToggleFavorite}
                size="lg"
                showBackground
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
              <h2 className="text-lg font-semibold">Steps</h2>
              <WakeLockToggle />
            </CardHeader>
            <CardBody className="px-3 pt-2 pb-6">
              <StepsList />
            </CardBody>
          </Card>
        </div>
      </div>

      {
        recipe.image && (
          <ImageLightbox
            images={[{ src: recipe.image, alt: recipe.name ?? "Recipe image" }]}
            isOpen={lightboxOpen}
            onClose={() => setLightboxOpen(false)}
          />
        )
      }
    </div>
  );
}

