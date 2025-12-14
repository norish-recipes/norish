import { ClockIcon, FireIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/16/solid";
import { Card, CardBody, Chip, Divider, Link } from "@heroui/react";
import Image from "next/image";

import AuthorChip from "./components/author-chip";
import { useRecipeContextRequired } from "./context";

import ActionsMenu from "@/app/(app)/recipes/[id]/components/actions-menu";
import IngredientsList from "@/app/(app)/recipes/[id]/components/ingredient-list";
import ServingsControl from "@/app/(app)/recipes/[id]/components/servings-control";
import StepsList from "@/app/(app)/recipes/[id]/components/steps-list";
import SystemConvertMenu from "@/app/(app)/recipes/[id]/components/system-convert-menu";
import WakeLockToggle from "@/app/(app)/recipes/[id]/components/wake-lock-toggle";
import { formatMinutesHM } from "@/lib/helpers";

export default function RecipePageMobile() {
  var { recipe } = useRecipeContextRequired();

  return (
    <div className="flex w-full flex-col">
      {/* Hero Image */}
      <div className="bg-default-200 relative h-72 w-full overflow-hidden">
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
            <span className="text-sm font-medium opacity-70">No image available</span>
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
      </div>

      {/* Main Content Card */}
      <Card
        className="bg-content1 relative z-10 mx-3 -mt-6 overflow-visible rounded-xl"
        shadow="sm"
      >
        <CardBody className="space-y-4 px-4 py-5">
          {/* Back text */}
          <div className="w-fit hover:underline">
            <Link className="text-default-500 text-sm" href="/">
              ← Back to recipes
            </Link>
          </div>
          <div className="absolute top-4 right-4 z-50">
            <ActionsMenu id={recipe.id} />
          </div>

          <Divider />

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

          {/* Time info */}
          <div className="text-default-500 flex flex-wrap items-center gap-4 text-sm">
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

          {/* Description */}
          {recipe.description && (
            <p className="text-default-600 text-base leading-relaxed">{recipe.description}</p>
          )}

          {/* Tags */}
          {recipe.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-2">
              {recipe.tags.map((t: { name: string }) => (
                <Chip key={t.name} size="sm" variant="flat">
                  {t.name}
                </Chip>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Ingredients Card */}
      <Card className="bg-content1 mx-3 mt-4 rounded-xl" shadow="sm">
        <CardBody className="space-y-4 px-4 py-5">
          {/* Header row: title + actions */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Ingredients</h2>
            <div className="flex items-center gap-2">
              <ServingsControl />
              {recipe.systemUsed && <SystemConvertMenu />}
            </div>
          </div>

          <Divider />
          {/* Ingredients list */}
          <div className="-mx-1">
            <IngredientsList />
          </div>
        </CardBody>
      </Card>

      {/* Steps Card */}
      <Card className="bg-content1 mx-3 mt-4 rounded-xl" shadow="sm">
        <CardBody className="space-y-3 px-4 py-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Steps</h2>
            <WakeLockToggle />
          </div>
          <Divider />
          <div className="-mx-1">
            <StepsList />
          </div>
        </CardBody>
      </Card>

      <div className="pb-5" />
    </div>
  );
}
