"use client";

import { EntryComboBox } from "@/components/shared/entry-combo-box";
import { SortableTagChips } from "@/components/shared/sortable-tag-chips";
import { useTranslations } from "next-intl";

import { hasName } from "@norish/shared-react/lists";

interface TagPickerProps {
  value: string[];
  onChange: (tags: string[]) => void;
  /** The recipe being edited, once it exists: its household's Tags are the ones offered. */
  recipeId?: string;
}

/**
 * The recipe's Tags as chips, and a field that searches the household's list as you type. A Tag
 * the list lacks is made only by its "Create 'x'" row; typing and saving never make one.
 */
export default function TagPicker({ value, onChange, recipeId }: TagPickerProps) {
  const t = useTranslations("recipes.editor");

  return (
    // A field holding chips is still a field: the same soft fill and border as the form's inputs.
    <div className="group bg-default flex min-h-[48px] flex-wrap items-center gap-2 rounded-2xl border border-(--field-border) px-3 py-2 shadow-none">
      <SortableTagChips
        removal={{
          label: (tag) => t("removeNamed", { name: tag }),
          onRemove: (tag) => onChange(value.filter((other) => other !== tag)),
        }}
        value={value}
        onChange={onChange}
      >
        <EntryComboBox
          className="min-w-[120px] flex-1"
          inputClassName="border-none bg-transparent px-0 shadow-none outline-none"
          kind="tag"
          label={t("addTag")}
          placeholder={value.length === 0 ? t("addTag") : ""}
          recipeId={recipeId}
          isSelected={(entry) => hasName(value, entry.name)}
          onBackspaceEmpty={() => onChange(value.slice(0, -1))}
          onSelect={(entry) => {
            if (!hasName(value, entry.name)) onChange([...value, entry.name]);
          }}
        />
      </SortableTagChips>
    </div>
  );
}
