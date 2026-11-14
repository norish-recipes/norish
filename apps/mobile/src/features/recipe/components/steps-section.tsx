import type { ReactNode } from "react";
import React, { Fragment, useState } from "react";
import { Image, Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useServerImage } from "@/lib/network/server-url";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import {
  useAmountDisplayPreference,
  useLoadedPageRecipe,
  usePageIngredients,
  useUnitFormatter,
} from "@norish/shared-react/recipes";
import { formatAmount } from "@norish/shared/lib/format-amount";
import { namesNoFood } from "@norish/shared/lib/ingredient-text";
import { resolveStepIngredients } from "@norish/shared/lib/step-ingredients";

import { plainText, stepRows } from "../utils/recipe-rows";
import { IngredientIcon } from "./ingredient-icon";
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
function StepPhotos({ images, label }: { images: { image: string }[]; label: string }) {
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

/** The lines a step uses, as chips with their amounts at the page's servings. */
function StepChips({ step, lines, systemUsed }: { step: Step; lines: Line[]; systemUsed: string }) {
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
            className="bg-default h-[30px] flex-row items-center gap-1.5 rounded-full pr-2.5 pl-1"
            style={tint ? { backgroundColor: tint.soft } : undefined}
          >
            {namesNoFood(item.name) ? null : (
              <IngredientIcon
                ingredientId={lineAt.get(item.ingredientOrder)?.ingredientId}
                size={22}
              />
            )}
            <Text className="text-foreground text-[13px]">{label}</Text>
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
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: done }}
      className="flex-row gap-3"
      testID={`recipe-step-${number}`}
      onPress={() => onToggle(number)}
    >
      <View className="bg-accent size-7 items-center justify-center rounded-full">
        {done ? (
          <Ionicons color={accentForeground} name="checkmark" size={16} />
        ) : (
          <Text className="text-accent-foreground text-sm font-semibold">{number}</Text>
        )}
      </View>
      <View className="min-w-0 flex-1 gap-3">
        <Text
          className={`pt-0.5 text-base leading-6 ${done ? "text-muted line-through" : "text-foreground"}`}
        >
          {plainText(step.step)}
        </Text>
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
