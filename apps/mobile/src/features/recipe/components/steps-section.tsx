import type { ComponentRef } from "react";
import type { LayoutRectangle } from "react-native";
import React, { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { ZoomIn, ZoomOut } from "react-native-reanimated";
import { IngredientIcon, IngredientIconSlots } from "@/components/ingredient-icon";
import { ServerImage } from "@/components/server-image";
import { lightImpact } from "@/lib/haptics";
import { sprung } from "@/lib/motion/spring";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { StepIngredientRefLike } from "@norish/shared/lib/step-ingredients";
import {
  useAmountDisplayPreference,
  useLoadedPageRecipe,
  usePageIngredients,
  useUnitFormatter,
} from "@norish/shared-react/recipes";
import { formatAmount } from "@norish/shared/lib/format-amount";
import { namesNoFood } from "@norish/shared/lib/ingredient-text";
import { resolveStepIngredients } from "@norish/shared/lib/step-ingredients";

import { useStepTimers } from "../hooks/use-step-timers";
import { imageItems } from "../utils/hero-items";
import { plainText, stepRows } from "../utils/recipe-rows";
import { InlineMarkdown } from "./inline-markdown";
import { MediaViewer } from "./media-viewer";
import { TimerChip, TimerChipButton } from "./timer-chip";
import { SectionCard, useTint } from "./tint";

type Recipe = ReturnType<typeof useLoadedPageRecipe>;
type Step = Recipe["steps"][number];
type Line = ReturnType<typeof usePageIngredients>[number];

/** A step's own photos as small thumbnails; one opens the viewer on it. */
export function StepPhotos({ images, label }: { images: { image: string }[]; label: string }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <>
      <View className="flex-row flex-wrap gap-2">
        {imageItems(images).map((item, index) => (
          <Pressable
            key={item.key}
            accessibilityLabel={`${label} ${index + 1}`}
            accessibilityRole="button"
            onPress={() => setOpen(index)}
          >
            <ServerImage
              className="bg-default size-16 rounded-lg"
              contentFit="cover"
              path={item.path}
            />
          </Pressable>
        ))}
      </View>
      {open === null ? null : (
        <MediaViewer
          items={imageItems(images)}
          label={label}
          start={open}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

/** A step's text with its durations as timer chips; `stepIndex` counts steps, not headings, from 0. */
export function StepText({
  text,
  stepIndex,
  size,
  className,
  disableLinks = false,
}: {
  text: string;
  stepIndex: number;
  size: "page" | "cook";
  className: string;
  disableLinks?: boolean;
}) {
  const { matches, marked } = useStepTimers(text);
  const [frames, setFrames] = useState<ReadonlyMap<number, LayoutRectangle>>(() => new Map());
  const containerRef = useRef<ComponentRef<typeof View>>(null);
  const [layouts, setLayouts] = useState(0);
  // Kept when unchanged, so a chip measuring itself on every commit settles.
  const place = (index: number, frame: LayoutRectangle) =>
    setFrames((prev) => {
      const last = prev.get(index);

      const same =
        last?.x === frame.x &&
        last.y === frame.y &&
        last.width === frame.width &&
        last.height === frame.height;

      return same ? prev : new Map(prev).set(index, frame);
    });

  return (
    <View ref={containerRef} onLayout={() => setLayouts((count) => count + 1)}>
      <Text className={className}>
        <InlineMarkdown
          disableLinks={disableLinks}
          renderTimer={(index) => {
            const match = matches[index];

            return match ? (
              <TimerChip
                index={index}
                layouts={layouts}
                match={match}
                size={size}
                stepIndex={stepIndex}
                withinRef={containerRef}
                onPlace={(frame) => place(index, frame)}
              />
            ) : null;
          }}
          text={marked}
        />
      </Text>
      {matches.map((match, index) => {
        const frame = frames.get(index);

        return frame ? (
          <TimerChipButton
            key={match.startIndex}
            frame={frame}
            index={index}
            match={match}
            size={size}
            stepIndex={stepIndex}
          />
        ) : null;
      })}
    </View>
  );
}

/** The lines a step uses, as chips with their amounts at the page's servings; larger in cook mode. */
export function StepChips({
  step,
  lines,
  systemUsed,
  large = false,
}: {
  step: { stepIngredients?: StepIngredientRefLike[] };
  lines: Line[];
  systemUsed: string;
  large?: boolean;
}) {
  const intl = useIntl();
  const { mode } = useAmountDisplayPreference();
  const { formatUnitOnly } = useUnitFormatter(intl.locale);
  const tint = useTint();
  const resolved = resolveStepIngredients(
    step.stepIngredients ?? [],
    lines.map((line) => ({
      ingredientName: line.ingredientName,
      amount: line.amount == null ? null : Number(line.amount),
      unit: line.unit ?? null,
      systemUsed: line.systemUsed,
      order: line.order,
    })),
    systemUsed
  );

  if (resolved.length === 0) return null;

  const lineAt = new Map(
    lines.filter((line) => line.systemUsed === systemUsed).map((line) => [line.order, line])
  );

  const chips = resolved.map((item) => ({
    item,
    foodId: namesNoFood(item.name) ? null : (lineAt.get(item.ingredientOrder)?.ingredientId ?? null),
  }));

  return (
    <IngredientIconSlots rows={chips}>
      <View className="flex-row flex-wrap gap-1.5">
        {chips.map(({ item, foodId }) => {
          const label = [
            item.amount != null ? formatAmount(item.amount, mode) : "",
            item.unit ? formatUnitOnly(item.unit, item.amount) : "",
            plainText(item.name),
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <View
              key={item.ingredientOrder}
              className={`bg-default flex-row items-center gap-1.5 rounded-full pr-2.5 ${large ? "h-[38px] pl-1.5" : "h-[30px] pl-1"}`}
              style={tint ? { backgroundColor: tint.soft } : undefined}
            >
              <IngredientIcon ingredientId={foodId} size={large ? 26 : 22} />
              <Text className={`text-foreground ${large ? "text-[15px]" : "text-[13px]"}`}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </IngredientIconSlots>
  );
}

function StepLine({
  step,
  number,
  done,
  lines,
  systemUsed,
  onToggle,
}: {
  step: Step;
  number: number;
  done: boolean;
  lines: Line[];
  systemUsed: string;
  onToggle: (number: number) => void;
}) {
  const intl = useIntl();
  const [accentForeground] = useThemeColor(["accent-foreground"] as const);
  const toggle = () => {
    lightImpact();
    onToggle(number);
  };

  return (
    // Not one button, so VoiceOver reaches the step's timer chips; the number is the toggle.
    <Pressable
      accessible={false}
      className="flex-row gap-3"
      testID={`recipe-step-${number}`}
      onPress={toggle}
    >
      <Pressable
        accessibilityLabel={intl.formatMessage({ id: "recipes.cookMode.stepLabel" }, { number })}
        accessibilityRole="button"
        accessibilityState={{ selected: done }}
        className="bg-accent size-7 items-center justify-center rounded-full"
        testID={`recipe-step-${number}-toggle`}
        onPress={toggle}
      >
        {/* The number and the check swap by scale; each is laid over the other while one leaves. */}
        <Animated.View
          key={done ? "check" : "number"}
          className="absolute"
          entering={sprung(ZoomIn.springify())}
          exiting={sprung(ZoomOut.springify())}
        >
          {done ? (
            <Ionicons color={accentForeground} name="checkmark" size={16} />
          ) : (
            <Text className="text-accent-foreground text-sm font-semibold">{number}</Text>
          )}
        </Animated.View>
      </Pressable>
      <View className="min-w-0 flex-1 gap-3">
        <StepText
          className={`pt-0.5 text-base leading-6 ${done ? "text-muted line-through" : "text-foreground"}`}
          disableLinks={done}
          size="page"
          stepIndex={number - 1}
          text={step.step}
        />
        <StepChips lines={lines} step={step} systemUsed={systemUsed} />
        {step.images && step.images.length > 0 ? (
          <StepPhotos
            images={step.images}
            label={intl.formatMessage({ id: "recipes.detail.stepPhoto" })}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

/** The Steps card: numbered steps that tick off, their ingredient chips and photos. */
export function StepsSection() {
  const intl = useIntl();
  const recipe = useLoadedPageRecipe();
  const lines = usePageIngredients();
  const [done, setDone] = useState<ReadonlySet<number>>(() => new Set());
  const rows = stepRows(recipe.steps ?? [], recipe.systemUsed ?? "metric");
  const toggle = (number: number) => {
    const next = new Set(done);

    if (!next.delete(number)) next.add(number);
    setDone(next);
  };

  if (rows.length === 0) return null;

  return (
    <SectionCard testID="recipe-steps" title={intl.formatMessage({ id: "recipes.detail.steps" })}>
      <View className="gap-[18px]">
        {rows.map((row) =>
          row.kind === "heading" ? (
            <Text key={row.key} className="text-muted text-[15px] font-semibold">
              {row.text}
            </Text>
          ) : (
            <StepLine
              key={row.key}
              done={done.has(row.number)}
              lines={lines}
              number={row.number}
              step={row.step}
              systemUsed={recipe.systemUsed ?? "metric"}
              onToggle={toggle}
            />
          )
        )}
      </View>
    </SectionCard>
  );
}
