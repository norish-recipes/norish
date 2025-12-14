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
import ImageLightbox from "@/components/shared/image-lightbox";

export default function RecipePageDesktop() {
  var { recipe } = useRecipeContextRequired();
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <div className="hidden flex-col space-y-6 px-6 pb-10 md:flex">
      {/* Back link */}
      <div className="flex items-center justify-between">
        <div className="w-fit">
          <Link className="text-default-500 text-sm hover:underline" href="/">
            ← Back to recipes
          </Link>
        </div>
      </div>

      {/* Header section */}
      <Card className="bg-content1 overflow-hidden rounded-2xl shadow-md">
        <div className="grid grid-cols-2">
          {/* Image Section */}
          <div className="bg-default-200 h-100% relative min-h-[400px] overflow-hidden">
            {recipe.image ? (
              <button
                className="group relative h-full w-full cursor-pointer focus:outline-none"
                type="button"
                onClick={() => setLightboxOpen(true)}
              >
                <Image
                  fill
                  unoptimized
                  alt={recipe.name ?? "Recipe image"}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  src={recipe.image}
                />
                {/* Gradient overlay for readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/10 to-transparent transition-colors group-hover:from-black/40" />
                {/* Hover indicator */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="rounded-full bg-black/50 px-4 py-2 text-sm font-medium text-white">
                    Click to enlarge
                  </span>
                </div>
              </button>
            ) : (
              <div className="text-default-500 flex h-full w-full items-center justify-center">
                <span className="text-sm font-medium opacity-70">No image available</span>
              </div>
            )}

            {/* Author badge */}
            {recipe.author && (
              <div className="absolute top-4 left-4 z-50">
                <AuthorChip image={recipe.author.image} name={recipe.author.name} />
              </div>
            )}
          </div>

          {/* Info Section */}
          <div className="flex flex-col justify-between p-8">
            <CardHeader className="flex-col items-start gap-2 px-0 pt-0">
              <div className="flex w-full items-start justify-between">
                <div>
                  <h1 className="text-3xl font-bold">
                    {recipe.name}
                    {recipe.url && (
                      <a
                        className="ml-2 inline-block align-middle"
                        href={recipe.url}
                        rel="noopener noreferrer"
                        target="_blank"
                        title="View original recipe"
                      >
                        <ArrowTopRightOnSquareIcon className="text-default-400 hover:text-primary inline h-5 w-5" />
                      </a>
                    )}
                  </h1>
                  {recipe.description && (
                    <p className="text-default-600 mt-3 max-w-md text-base">{recipe.description}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-1 ml-4 flex-shrink-0">
                  <ActionsMenu id={recipe.id} />
                </div>
              </div>

              {/* Tags */}
              {recipe.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {recipe.tags.map((t: { name: string }) => (
                    <Chip key={t.name} size="sm" variant="flat">
                      {t.name}
                    </Chip>
                  ))}
                </div>
              )}
            </CardHeader>

            {/* Meta section */}
            <CardBody className="space-y-6 px-0 pt-6 pb-0">
              {/* Time info */}
              {(recipe.prepMinutes || recipe.cookMinutes || recipe.totalMinutes !== 0) && (
                <div className="text-default-500 flex flex-wrap items-center gap-4 text-sm">
                  {recipe.prepMinutes && recipe.prepMinutes > 0 && (
                    <span className="flex items-center gap-1">
                      <WrenchScrewdriverIcon className="h-4 w-4" /> Prep{" "}
                      {formatMinutesHM(recipe.prepMinutes)}
                    </span>
                  )}

                  {recipe.prepMinutes && recipe.cookMinutes && (
                    <Divider className="h-4" orientation="vertical" />
                  )}

                  {recipe.cookMinutes && (
                    <span className="flex items-center gap-1">
                      <FireIcon className="h-4 w-4" /> Cook {formatMinutesHM(recipe.cookMinutes)}
                    </span>
                  )}

                  {(recipe.cookMinutes || recipe.prepMinutes) && recipe.totalMinutes !== 0 && (
                    <Divider className="h-4" orientation="vertical" />
                  )}

                  {recipe.totalMinutes && recipe.totalMinutes !== 0 && (
                    <span className="flex items-center gap-1">
                      <ClockIcon className="h-4 w-4" /> Total {formatMinutesHM(recipe.totalMinutes)}
                    </span>
                  )}
                </div>
              )}
            </CardBody>
          </div>
        </div>
      </Card>

      {/* Content grid */}
      <div className="grid grid-cols-5 gap-6">
        {/* Ingredients */}
        <Card className="bg-content1 col-span-2">
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Ingredients</h2>
            <div className="flex items-center gap-2">
              {recipe.servings && <ServingsControl />}
              {recipe.systemUsed && <SystemConvertMenu />}
            </div>
          </CardHeader>
          <CardBody>
            <IngredientsList />
          </CardBody>
        </Card>

        {/* Steps */}
        <Card className="bg-content1 col-span-3 px-4">
          <CardHeader>
            <h2 className="text-lg font-semibold">Steps</h2>
          </CardHeader>
          <CardBody>
            <StepsList />
          </CardBody>
        </Card>
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

