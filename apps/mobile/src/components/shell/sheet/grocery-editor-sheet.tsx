import type { StoreDto } from "@norish/shared/contracts";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { PanelButton } from "@/components/shell/panel-button";
import { ShellSheet } from "@/components/shell/sheet";
import { storeTintColor } from "@/lib/groceries/grocery-utils";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { RecurrenceTranslations } from "@norish/shared/lib/recurrence/formatter";
import { formatRecurrenceSummary } from "@norish/shared/lib/recurrence/formatter";

import type { GroceryRecurrenceSettings } from "./grocery-recurrence-sheet";
import {
  DEFAULT_GROCERY_RECURRENCE_SETTINGS,
  GroceryRecurrenceSheet,
} from "./grocery-recurrence-sheet";

export type {
  GroceryRecurrenceFrequency,
  GroceryRecurrenceSettings,
} from "./grocery-recurrence-sheet";

export type GroceryEditorFormValue = {
  itemText: string;
  storeId: string | null;
  recurrence: GroceryRecurrenceSettings;
};

type GroceryEditorSheetProps = {
  isPresented: boolean;
  mode: "create" | "edit";
  stores: StoreDto[];
  initialValue?: GroceryEditorFormValue;
  onIsPresentedChange: (open: boolean) => void;
  onSubmit?: (value: GroceryEditorFormValue) => void;
  onDelete?: () => void;
};

const EMPTY_VALUE: GroceryEditorFormValue = {
  itemText: "",
  storeId: null,
  recurrence: DEFAULT_GROCERY_RECURRENCE_SETTINGS,
};

export function GroceryEditorSheet({
  isPresented,
  mode,
  stores,
  initialValue,
  onIsPresentedChange,
  onSubmit,
  onDelete,
}: GroceryEditorSheetProps) {
  const intl = useIntl();
  const [itemText, setItemText] = useState(initialValue?.itemText ?? "");
  const [storeId, setStoreId] = useState<string | null>(initialValue?.storeId ?? null);
  const [recurrence, setRecurrence] = useState<GroceryRecurrenceSettings>(
    initialValue?.recurrence ?? EMPTY_VALUE.recurrence
  );
  const [recurrenceSheetOpen, setRecurrenceSheetOpen] = useState(false);
  const [foregroundColor, mutedColor, surfaceColor, separatorColor, accentColor] = useThemeColor([
    "foreground",
    "muted",
    "surface-secondary",
    "separator",
    "accent",
  ] as const);

  useEffect(() => {
    if (!isPresented) {
      if (mode === "create") {
        setItemText("");
        setStoreId(null);
        setRecurrence(EMPTY_VALUE.recurrence);
      }
      setRecurrenceSheetOpen(false);
      return;
    }

    const next = initialValue ?? EMPTY_VALUE;
    setItemText(next.itemText);
    setStoreId(next.storeId);
    setRecurrence(next.recurrence);
  }, [initialValue, isPresented, mode]);

  const selectedStore = useMemo(
    () => stores.find((store) => store.id === storeId) ?? null,
    [storeId, stores]
  );

  const hasText = itemText.trim().length > 0;
  const titleId = mode === "create" ? "groceries.panel.addTitle" : "groceries.panel.editTitle";
  const placeholderId =
    mode === "create" ? "groceries.panel.placeholder" : "groceries.panel.editPlaceholder";
  const editorSheetPresented = isPresented && !recurrenceSheetOpen;
  const recurrenceFormatterTranslations = useMemo<RecurrenceTranslations>(
    () => ({
      every: intl.formatMessage({ id: "common.recurrence.every" }),
      everyOther: intl.formatMessage({ id: "common.recurrence.everyOther" }),
      on: intl.formatMessage({ id: "common.recurrence.on" }),
      day: intl.formatMessage({ id: "common.recurrence.day" }),
      days: intl.formatMessage({ id: "common.recurrence.days" }),
      week: intl.formatMessage({ id: "common.recurrence.week" }),
      weeks: intl.formatMessage({ id: "common.recurrence.weeks" }),
      month: intl.formatMessage({ id: "common.recurrence.month" }),
      months: intl.formatMessage({ id: "common.recurrence.months" }),
      today: intl.formatMessage({ id: "common.recurrence.today" }),
      tomorrow: intl.formatMessage({ id: "common.recurrence.tomorrow" }),
      weekdaysFull: {
        "0": intl.formatMessage({ id: "common.recurrence.weekdaysFull.0" }),
        "1": intl.formatMessage({ id: "common.recurrence.weekdaysFull.1" }),
        "2": intl.formatMessage({ id: "common.recurrence.weekdaysFull.2" }),
        "3": intl.formatMessage({ id: "common.recurrence.weekdaysFull.3" }),
        "4": intl.formatMessage({ id: "common.recurrence.weekdaysFull.4" }),
        "5": intl.formatMessage({ id: "common.recurrence.weekdaysFull.5" }),
        "6": intl.formatMessage({ id: "common.recurrence.weekdaysFull.6" }),
      },
    }),
    [intl]
  );

  const handleEditorPresentedChange = useCallback(
    (open: boolean) => {
      if (recurrenceSheetOpen) return;
      onIsPresentedChange(open);
    },
    [onIsPresentedChange, recurrenceSheetOpen]
  );

  const handleSubmit = useCallback(() => {
    if (!hasText) return;
    onSubmit?.({ itemText: itemText.trim(), storeId, recurrence });
    if (mode === "create") {
      setItemText("");
      setStoreId(null);
      setRecurrence(EMPTY_VALUE.recurrence);
    } else {
      onIsPresentedChange(false);
    }
  }, [hasText, itemText, mode, onIsPresentedChange, onSubmit, recurrence, storeId]);

  const handleDelete = useCallback(() => {
    onDelete?.();
    onIsPresentedChange(false);
  }, [onDelete, onIsPresentedChange]);

  const handleRecurrenceConfirm = useCallback((settings: GroceryRecurrenceSettings) => {
    setRecurrence(settings);
    setRecurrenceSheetOpen(false);
  }, []);

  return (
    <>
      <ShellSheet
        isPresented={editorSheetPresented}
        onIsPresentedChange={handleEditorPresentedChange}
        detents={["medium", "large"]}
        initialDetent="medium"
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: foregroundColor }]}>
              {intl.formatMessage({ id: titleId })}
            </Text>
            <Text style={[styles.subtitle, { color: mutedColor }]}>
              {intl.formatMessage({
                id:
                  mode === "create"
                    ? "groceries.panel.autoDetectFromHistory"
                    : "groceries.panel.savePreference",
              })}
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: mutedColor }]}>
              {intl.formatMessage({ id: "groceries.panel.itemName" })}
            </Text>
            <TextInput
              value={itemText}
              onChangeText={setItemText}
              placeholder={intl.formatMessage({ id: placeholderId })}
              placeholderTextColor={mutedColor}
              returnKeyType={mode === "create" ? "done" : "send"}
              onSubmitEditing={handleSubmit}
              style={[
                styles.textInput,
                {
                  color: foregroundColor,
                  backgroundColor: surfaceColor,
                  borderColor: separatorColor,
                },
              ]}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: mutedColor }]}>
              {intl.formatMessage({
                id:
                  mode === "create"
                    ? "groceries.panel.storeOptional"
                    : "groceries.panel.selectStore",
              })}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.storeList}
            >
              <StoreChip
                label={intl.formatMessage({ id: "groceries.panel.noStore" })}
                selected={!selectedStore}
                tintColor={accentColor}
                foregroundColor={foregroundColor}
                mutedColor={mutedColor}
                surfaceColor={surfaceColor}
                separatorColor={separatorColor}
                onPress={() => setStoreId(null)}
              />
              {stores.map((store) => (
                <StoreChip
                  key={store.id}
                  label={store.name}
                  selected={store.id === storeId}
                  tintColor={storeTintColor(store)}
                  foregroundColor={foregroundColor}
                  mutedColor={mutedColor}
                  surfaceColor={surfaceColor}
                  separatorColor={separatorColor}
                  onPress={() => setStoreId(store.id)}
                />
              ))}
            </ScrollView>
          </View>

          {/* Recurrence row — opens a sub-sheet instead of toggling inline */}
          <Pressable
            onPress={() => setRecurrenceSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={intl.formatMessage({ id: "groceries.panel.recurrence" })}
            style={[
              styles.repeatRow,
              {
                backgroundColor: surfaceColor,
                borderColor: recurrence.enabled ? accentColor : separatorColor,
              },
            ]}
          >
            <View style={[styles.repeatIcon, { backgroundColor: `${accentColor}18` }]}>
              <Ionicons name="repeat-outline" size={18} color={accentColor} />
            </View>
            <View style={styles.repeatText}>
              <Text style={[styles.repeatTitle, { color: foregroundColor }]}>
                {intl.formatMessage({ id: "groceries.panel.recurrence" })}
              </Text>
              <Text style={[styles.repeatSubtitle, { color: mutedColor }]}>
                {recurrence.enabled
                  ? formatRecurrenceSummary(recurrence.pattern, recurrenceFormatterTranslations)
                  : intl.formatMessage({ id: "groceries.panel.addRepeat" })}
              </Text>
            </View>
            {recurrence.enabled ? (
              <View style={[styles.activeBadge, { backgroundColor: `${accentColor}18` }]}>
                <Text style={[styles.activeBadgeText, { color: accentColor }]}>On</Text>
              </View>
            ) : null}
            <Ionicons name="chevron-forward" size={18} color={mutedColor} />
          </Pressable>

          <View style={styles.actions}>
            {mode === "edit" && onDelete ? (
              <PanelButton variant="secondary" onPress={handleDelete}>
                <Ionicons name="trash-outline" size={17} color="#ef4444" />
                <Button.Label style={{ color: "#ef4444" }}>
                  {intl.formatMessage({ id: "common.actions.delete" })}
                </Button.Label>
              </PanelButton>
            ) : null}
            <PanelButton variant="primary" isDisabled={!hasText} onPress={handleSubmit}>
              <Button.Label>
                {intl.formatMessage({
                  id: mode === "create" ? "common.actions.add" : "common.actions.save",
                })}
              </Button.Label>
            </PanelButton>
          </View>
        </View>
      </ShellSheet>

      <GroceryRecurrenceSheet
        isPresented={recurrenceSheetOpen}
        onIsPresentedChange={setRecurrenceSheetOpen}
        value={recurrence}
        onConfirm={handleRecurrenceConfirm}
      />
    </>
  );
}

type StoreChipProps = {
  label: string;
  selected: boolean;
  tintColor: string;
  foregroundColor: string;
  mutedColor: string;
  surfaceColor: string;
  separatorColor: string;
  onPress: () => void;
};

function StoreChip({
  label,
  selected,
  tintColor,
  foregroundColor,
  mutedColor,
  surfaceColor,
  separatorColor,
  onPress,
}: StoreChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.storeChip,
        {
          backgroundColor: selected ? `${tintColor}18` : surfaceColor,
          borderColor: selected ? tintColor : separatorColor,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={[styles.storeDot, { backgroundColor: tintColor }]} />
      <Text style={[styles.storeChipText, { color: selected ? foregroundColor : mutedColor }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 24,
    gap: 18,
  },
  header: {
    gap: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  textInput: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 17,
    fontWeight: "600",
  },
  storeList: {
    gap: 8,
    paddingRight: 20,
  },
  storeChip: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  storeDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  storeChipText: {
    fontSize: 14,
    fontWeight: "700",
  },
  repeatRow: {
    minHeight: 64,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  repeatIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  repeatText: {
    flex: 1,
    gap: 2,
  },
  repeatTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  repeatSubtitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  activeBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  actions: {
    marginTop: "auto",
    flexDirection: "row",
    gap: 10,
  },
});
