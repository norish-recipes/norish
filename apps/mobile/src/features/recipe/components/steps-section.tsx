import type { ComponentRef, ReactNode } from "react";
import type { LayoutRectangle } from "react-native";
import React, { Fragment, useRef, useState } from "react";
import { Image, Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useServerImage } from "@/lib/network/server-url";
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
import { plainText, stepRows } from "../utils/recipe-rows";
import { IngredientIcon } from "./ingredient-icon";
import { InlineMarkdown } from "./inline-markdown";
import { TimerChip, TimerChipButton } from "./timer-chip";
import { SectionCard, useTint } from "./tint";

type Recipe = ReturnType<typeof useLoadedPageRecipe>;
type Step = Recipe["steps"][number];
type Line = ReturnType<typeof usePageIngredients>[number];

/** Keys a step's photos by place: the same picture can sit twice, so only its place tells them apart. */
function byPlace<T>(items: T[], render: (item: T, index: number) => ReactNode) {
  // eslint-disable-next-line @eslint-react/no-array-index-key
  return items.map((item, index) => <Fragment key={index}>{render(item, index)}</Fragment>);
}

/** A step's own photos as small thumbnails; one opens the pages in full. */
export function StepPhotos({ images, label }: { images: { image: string }[]; label: string }) {
  const toImage = useServerImage();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState<number | null>(null);

  return (
    <>
      <View className="flex-row flex-wrap gap-2">
        {byPlace(images, (image, index) => (
          <Pressable
            accessibilityLabel={`${label} ${index + 1}`}
            accessibilityRole="button"
            onPress={() => setOpen(index)}
          >
            <Image
              className="bg-default size-16 rounded-lg"
              resizeMode="cover"
              source={toImage(image.image)}
            />
          </Pressable>
        ))}
      </View>
      <Modal
        transparent
        animationType="fade"
        visible={open !== null}
        onRequestClose={() => setOpen(null)}
      >
        <Pressable className="flex-1 justify-center bg-black/90" onPress={() => setOpen(null)}>
          <ScrollView
            horizontal
            pagingEnabled
            contentOffset={{ x: (open ?? 0) * width, y: 0 }}
            showsHorizontalScrollIndicator={false}
          >
            {byPlace(images, (image) => (
              <Image
                resizeMode="contain"
                source={toImage(image.image)}
                style={{ width, height: width * 1.2 }}
              />
            ))}
          </ScrollView>
        </Pressable>
      </Modal>
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
    <View ref={containerRef}>
      <Text className={className}>
        <InlineMarkdown
          disableLinks={disableLinks}
          renderTimer={(index) => {
            const match = matches[index];

            return match ? (
              <TimerChip
                index={index}
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

  return (
    <View className="flex-row flex-wrap gap-1.5">
      {resolved.map((item) => {
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
            {namesNoFood(item.name) ? null : (
              <IngredientIcon
                ingredientId={lineAt.get(item.ingredientOrder)?.ingredientId}
                size={large ? 26 : 22}
              />
            )}
            <Text className={`text-foreground ${large ? "text-[15px]" : "text-[13px]"}`}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
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

  return (
    // Not one button, so VoiceOver reaches the step's timer chips; the number is the toggle.
    <Pressable
      accessible={false}
      className="flex-row gap-3"
      testID={`recipe-step-${number}`}
      onPress={() => onToggle(number)}
    >
      <Pressable
        accessibilityLabel={intl.formatMessage({ id: "recipes.cookMode.stepLabel" }, { number })}
        accessibilityRole="button"
        accessibilityState={{ selected: done }}
        className="bg-accent size-7 items-center justify-center rounded-full"
        testID={`recipe-step-${number}-toggle`}
        onPress={() => onToggle(number)}
      >
        {done ? (
          <Ionicons color={accentForeground} name="checkmark" size={16} />
        ) : (
          <Text className="text-accent-foreground text-sm font-semibold">{number}</Text>
        )}
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
