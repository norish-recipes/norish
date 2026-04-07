import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Entypo from "@expo/vector-icons/Entypo";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, Separator, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";
import { withUniwind } from "uniwind";

const StyledEntypo = withUniwind(Entypo);

// ---------------------------------------------------------------------------
// Macro definitions — mirrors the web nutrition-card.tsx pattern.
// ---------------------------------------------------------------------------

const MACROS = [
  {
    key: "calories" as const,
    labelKey: "recipes.nutrition.calories",
    unit: "kcal",
    iconName: "flame" as const,
    color: "#f97316", // orange-500
    bg: "rgba(249, 115, 22, 0.12)",
  },
  {
    key: "fat" as const,
    labelKey: "recipes.nutrition.fat",
    unit: "g",
    iconName: "water-outline" as const,
    color: "#eab308", // yellow-500
    bg: "rgba(234, 179, 8, 0.12)",
  },
  {
    key: "carbs" as const,
    labelKey: "recipes.nutrition.carbs",
    unit: "g",
    iconName: "cube-outline" as const,
    color: "#3b82f6", // blue-500
    bg: "rgba(59, 130, 246, 0.12)",
  },
  {
    key: "protein" as const,
    labelKey: "recipes.nutrition.protein",
    unit: "g",
    iconName: "flash" as const,
    color: "#f43f5e", // rose-500
    bg: "rgba(244, 63, 94, 0.12)",
  },
];

// ---------------------------------------------------------------------------
// Portion control (matches web nutrition-portion-control.tsx)
// ---------------------------------------------------------------------------

function formatPortions(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, "");
}

type PortionControlProps = {
  portions: number;
  onChange: (portions: number) => void;
};

function PortionControl({ portions, onChange }: PortionControlProps) {
  const foregroundColor = useThemeColor("foreground");

  const dec = useCallback(() => {
    if (portions <= 1) {
      onChange(Math.max(0.125, portions / 2));
    } else if (portions <= 2) {
      onChange(1);
    } else {
      onChange(portions - 1);
    }
  }, [portions, onChange]);

  const inc = useCallback(() => {
    if (portions < 1) {
      onChange(Math.min(1, portions * 2));
    } else {
      onChange(portions + 1);
    }
  }, [portions, onChange]);

  return (
    <View style={styles.portionRow}>
      <Button
        variant="secondary"
        size="sm"
        isIconOnly
        className="bg-surface-tertiary size-7 rounded-lg"
        onPress={dec}
      >
        <StyledEntypo name="minus" size={14} className="text-foreground" />
      </Button>
      <Text style={[styles.portionValue, { color: foregroundColor }]}>
        {formatPortions(portions)}
      </Text>
      <Button
        variant="secondary"
        size="sm"
        isIconOnly
        className="bg-surface-tertiary size-7 rounded-lg"
        onPress={inc}
      >
        <StyledEntypo name="plus" size={14} className="text-foreground" />
      </Button>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Nutrition section
// ---------------------------------------------------------------------------

type RecipeNutritionProps = {
  nutrition: {
    calories: number | null | undefined;
    fat: string | number | null | undefined;
    carbs: string | number | null | undefined;
    protein: string | number | null | undefined;
  };
};

export function RecipeNutrition({ nutrition }: RecipeNutritionProps) {
  const [foregroundColor, mutedColor] = useThemeColor(["foreground", "muted"] as const);
  const intl = useIntl();

  const [portions, setPortions] = useState(1);

  const values: Record<string, number | null> = {
    calories: nutrition.calories != null ? Number(nutrition.calories) * portions : null,
    fat: nutrition.fat != null ? Number(nutrition.fat) * portions : null,
    carbs: nutrition.carbs != null ? Number(nutrition.carbs) * portions : null,
    protein: nutrition.protein != null ? Number(nutrition.protein) * portions : null,
  };

  const hasData = Object.values(values).some((v) => v != null);
  if (!hasData) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: foregroundColor }]}>
          {intl.formatMessage({ id: "recipes.nutrition.title" })}
        </Text>
        <PortionControl portions={portions} onChange={setPortions} />
      </View>
      <View>
        {MACROS.map((macro, index) => {
          const value = values[macro.key];
          if (value == null) return null;

          return (
            <React.Fragment key={macro.key}>
              <View style={styles.row}>
                <View style={styles.labelSide}>
                  <View style={[styles.iconCircle, { backgroundColor: macro.bg }]}>
                    <Ionicons name={macro.iconName} size={16} color={macro.color} />
                  </View>
                  <Text style={[styles.macroLabel, { color: foregroundColor }]}>
                    {intl.formatMessage({ id: macro.labelKey })}
                  </Text>
                </View>
                <Text style={[styles.macroValue, { color: foregroundColor }]}>
                  {Math.round(value)}
                  <Text style={[styles.macroUnit, { color: mutedColor }]}> {macro.unit}</Text>
                </Text>
              </View>
              {index < MACROS.length - 1 && <Separator />}
            </React.Fragment>
          );
        })}
      </View>
      {portions !== 1 && (
        <Text style={[styles.portionHint, { color: mutedColor }]}>
          {intl.formatMessage({ id: "recipes.nutrition.showingPortions" }, { count: portions })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
  },
  portionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  portionValue: {
    fontSize: 15,
    fontWeight: "600",
    minWidth: 24,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  labelSide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  macroLabel: {
    fontSize: 16,
  },
  macroValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  macroUnit: {
    fontSize: 13,
    fontWeight: "400",
  },
  portionHint: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
  },
});
