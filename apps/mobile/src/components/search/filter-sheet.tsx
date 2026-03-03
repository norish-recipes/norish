import { useThemeColor } from 'heroui-native';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ShellSheet } from '@/components/shell/sheet';
import type { SearchFilters } from '@/lib/recipes/search-filters';
import {
  ALL_TAGS,
  COOKING_TIME_OPTIONS,
  COURSE_OPTIONS,
  DEFAULT_FILTERS,
} from '@/lib/recipes/search-filters';

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionHeader({ title }: { title: string }) {
  const [foregroundColor] = useThemeColor(['foreground'] as const);
  return (
    <Text style={[sectionStyles.header, { color: foregroundColor }]}>{title}</Text>
  );
}

// ---------------------------------------------------------------------------
// Chip toggle (generic)
// ---------------------------------------------------------------------------

function ChipToggle({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const [accentColor, foregroundColor, surfaceColor, separatorColor] = useThemeColor([
    'accent',
    'foreground',
    'surface',
    'separator',
  ] as const);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        chipStyles.chip,
        {
          backgroundColor: active ? accentColor : surfaceColor,
          borderColor: active ? accentColor : separatorColor,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={[chipStyles.label, { color: active ? '#ffffff' : foregroundColor }]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Cooking time section
// ---------------------------------------------------------------------------

function CookingTimeSection({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <View style={sectionStyles.section}>
      <SectionHeader title="Cooking time" />
      <View style={sectionStyles.chipRow}>
        {COOKING_TIME_OPTIONS.map((opt) => (
          <ChipToggle
            key={opt.value}
            label={opt.label}
            active={value === opt.value}
            onPress={() => onChange(value === opt.value ? null : opt.value)}
          />
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Course (categories) section
// ---------------------------------------------------------------------------

function CourseSection({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <View style={sectionStyles.section}>
      <SectionHeader title="Category" />
      <View style={sectionStyles.chipRow}>
        {COURSE_OPTIONS.map((course) => (
          <ChipToggle
            key={course}
            label={course}
            active={value === course}
            onPress={() => onChange(value === course ? null : course)}
          />
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tags section
// ---------------------------------------------------------------------------

function TagsSection({
  value,
  onChange,
}: {
  value: Set<string>;
  onChange: (value: Set<string>) => void;
}) {
  const handleToggle = useCallback(
    (tag: string) => {
      const next = new Set(value);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      onChange(next);
    },
    [value, onChange],
  );

  return (
    <View style={sectionStyles.section}>
      <SectionHeader title="Tags" />
      <View style={sectionStyles.chipRow}>
        {ALL_TAGS.map((tag) => (
          <ChipToggle
            key={tag}
            label={tag}
            active={value.has(tag)}
            onPress={() => handleToggle(tag)}
          />
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Favorites section
// ---------------------------------------------------------------------------

function FavoritesSection({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={sectionStyles.section}>
      <SectionHeader title="Favorites" />
      <View style={sectionStyles.chipRow}>
        <ChipToggle label="Favorites only" active={value} onPress={() => onChange(!value)} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Min rating section
// ---------------------------------------------------------------------------

function MinRatingSection({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const STARS = [1, 2, 3, 4, 5];
  return (
    <View style={sectionStyles.section}>
      <SectionHeader title="Min rating" />
      <View style={sectionStyles.chipRow}>
        {STARS.map((star) => (
          <ChipToggle
            key={star}
            label={'★'.repeat(star)}
            active={value === star}
            onPress={() => onChange(value === star ? null : star)}
          />
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main FilterSheet
// ---------------------------------------------------------------------------

interface FilterSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  filters: SearchFilters;
  onApply: (filters: SearchFilters) => void;
}

export function FilterSheet({ isOpen, onOpenChange, filters, onApply }: FilterSheetProps) {
  // Staged draft state — changes only commit on "Apply"
  const [draft, setDraft] = useState<SearchFilters>(filters);
  const [titleColor, mutedColor, accentColor, surfaceColor, separatorColor] = useThemeColor([
    'foreground',
    'muted',
    'accent',
    'surface',
    'separator',
  ] as const);

  // Sync draft from outside when the sheet opens
  React.useEffect(() => {
    if (isOpen) {
      setDraft(filters);
    }
  }, [isOpen, filters]);

  const handleApply = useCallback(() => {
    onApply(draft);
    onOpenChange(false);
  }, [draft, onApply, onOpenChange]);

  const handleReset = useCallback(() => {
    setDraft(DEFAULT_FILTERS);
  }, []);

  return (
    <ShellSheet
      isPresented={isOpen}
      onIsPresentedChange={onOpenChange}
    >
      <View style={sheetStyles.container}>
        {/* Sheet header */}
        <View style={sheetStyles.titleRow}>
          <Text style={[sheetStyles.title, { color: titleColor }]}>Filters</Text>
          <Text style={[sheetStyles.subtitle, { color: mutedColor }]}>
            Narrow your recipe search
          </Text>
        </View>

        {/* Scrollable filter sections */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={sheetStyles.scrollContent}
          style={sheetStyles.scrollWrapper}
        >
          <CookingTimeSection
            value={draft.maxCookingTime}
            onChange={(v) => setDraft((d) => ({ ...d, maxCookingTime: v }))}
          />
          <CourseSection
            value={draft.course}
            onChange={(v) => setDraft((d) => ({ ...d, course: v }))}
          />
          <FavoritesSection
            value={draft.liked}
            onChange={(v) => setDraft((d) => ({ ...d, liked: v }))}
          />
          <MinRatingSection
            value={draft.minRating}
            onChange={(v) => setDraft((d) => ({ ...d, minRating: v }))}
          />
          <TagsSection
            value={draft.tags}
            onChange={(v) => setDraft((d) => ({ ...d, tags: v }))}
          />
        </ScrollView>

        {/* Footer */}
        <View style={sheetStyles.footer}>
          <Pressable
            onPress={handleReset}
            style={({ pressed }) => [
              sheetStyles.footerButton,
              sheetStyles.resetButton,
              { backgroundColor: surfaceColor, borderColor: separatorColor, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[sheetStyles.footerButtonLabel, { color: titleColor }]}>Reset</Text>
          </Pressable>
          <Pressable
            onPress={handleApply}
            style={({ pressed }) => [
              sheetStyles.footerButton,
              sheetStyles.applyButton,
              { backgroundColor: accentColor, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[sheetStyles.footerButtonLabel, { color: '#ffffff' }]}>Apply</Text>
          </Pressable>
        </View>
      </View>
    </ShellSheet>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const sectionStyles = StyleSheet.create({
  section: {
    gap: 10,
  },
  header: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});

const chipStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
});

const sheetStyles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  titleRow: {
    gap: 3,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
  },
  scrollWrapper: {
    flex: 1,
  },
  scrollContent: {
    gap: 20,
    paddingBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  footerButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButton: {
    borderWidth: 1,
  },
  applyButton: {
    flex: 2,
  },
  footerButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
});
