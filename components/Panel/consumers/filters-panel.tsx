"use client";

import {
  MagnifyingGlassIcon,
  ArrowRightIcon,
  CheckIcon,
  ArrowPathIcon,
  HeartIcon,
} from "@heroicons/react/16/solid";
import { Input, Button, Chip } from "@heroui/react";
import { motion } from "framer-motion";
import { useState, useCallback, useEffect } from "react";

import { useRecipesFiltersContext } from "@/context/recipes-filters-context";
import { useTagsQuery } from "@/hooks/config";
import ChipSkeleton from "@/components/skeleton/chip-skeleton";
import Panel from "@/components/Panel/Panel";

type FiltersPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function FiltersPanelContent({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { filters, setFilters, clearFilters } = useRecipesFiltersContext();

  const [tagFilter, setTagFilter] = useState("");
  const [workingTags, setWorkingTags] = useState<string[]>(filters.searchTags);
  const [localFilterMode, setLocalFilterMode] = useState(filters.filterMode);
  const [localSortMode, setLocalSortMode] = useState(filters.sortMode);
  const [localInput, setLocalInput] = useState(filters.rawInput);
  const [localFavoritesOnly, setLocalFavoritesOnly] = useState(filters.showFavoritesOnly);

  const { tags: allTags, isLoading } = useTagsQuery();

  useEffect(() => {
    setWorkingTags(filters.searchTags);
    setLocalFilterMode(filters.filterMode);
    setLocalSortMode(filters.sortMode);
    setLocalInput(filters.rawInput);
    setLocalFavoritesOnly(filters.showFavoritesOnly);
  }, [filters]);

  const toggleTag = useCallback((tag: string) => {
    setWorkingTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }, []);

  const decideSortOrder = (type: "title" | "date") => {
    const asc = (type + "Asc") as typeof localSortMode;
    const desc = (type + "Desc") as typeof localSortMode;

    if (localSortMode === asc) {
      setLocalSortMode(desc);

      return;
    }
    if (localSortMode === desc) {
      setLocalSortMode("none");

      return;
    }

    setLocalSortMode(asc);
  };

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const apply = () => {
    setFilters({
      searchTags: [...workingTags],
      filterMode: localFilterMode,
      sortMode: localSortMode,
      rawInput: localInput,
      showFavoritesOnly: localFavoritesOnly,
    });

    close();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Search */}
      <section>
        <h3 className="text-default-500 mb-2 text-[11px] font-medium tracking-wide uppercase">
          Search
        </h3>
        <Input
          isClearable
          placeholder="Search recipes..."
          radius="full"
          startContent={<MagnifyingGlassIcon className="text-default-400 h-4 w-4" />}
          value={localInput}
          onChange={(e) => setLocalInput(e.target.value)}
          onClear={() => setLocalInput("")}
        />
      </section>

      {/* Sort */}
      <section>
        <h3 className="text-default-500 mb-2 text-[11px] font-medium tracking-wide uppercase">
          Sort
        </h3>
        <div className="flex gap-2">
          {["title", "date"].map((type) => {
            const isActive = localSortMode.startsWith(type) && localSortMode !== "none";
            const isAsc = localSortMode === `${type}Asc`;

            return (
              <Button
                key={type}
                className="h-9 px-3 text-xs"
                color={isActive ? "primary" : "default"}
                radius="full"
                size="sm"
                startContent={
                  <motion.span
                    animate={{
                      rotate: !isActive ? 0 : isAsc ? -90 : 90,
                    }}
                    className="inline-flex origin-center"
                    initial={false}
                    transition={{ type: "spring", stiffness: 340, damping: 26 }}
                  >
                    <ArrowRightIcon className="size-3.5" />
                  </motion.span>
                }
                variant={isActive ? "solid" : "flat"}
                onPress={() => decideSortOrder(type as "title" | "date")}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Button>
            );
          })}
        </div>
      </section>

      {/* Mode */}
      <section>
        <h3 className="text-default-500 mb-2 text-[11px] font-medium tracking-wide uppercase">
          Mode
        </h3>
        <div className="flex gap-2">
          {[
            { label: "All", value: "AND" },
            { label: "Any", value: "OR" },
          ].map(({ label, value }) => (
            <Button
              key={value}
              className="h-9 px-3 text-xs"
              color={localFilterMode === value ? "primary" : "default"}
              radius="full"
              size="sm"
              startContent={<CheckIcon className="size-3.5" />}
              variant={localFilterMode === value ? "solid" : "flat"}
              onPress={() => setLocalFilterMode(value as any)}
            >
              {label}
            </Button>
          ))}
        </div>
      </section>

      {/* Favorites */}
      <section>
        <h3 className="text-default-500 mb-2 text-[11px] font-medium tracking-wide uppercase">
          Favorites
        </h3>
        <div className="flex gap-2">
          <Button
            className="h-9 px-3 text-xs"
            color={localFavoritesOnly ? "danger" : "default"}
            radius="full"
            size="sm"
            startContent={<HeartIcon className="size-3.5" />}
            variant={localFavoritesOnly ? "solid" : "flat"}
            onPress={() => setLocalFavoritesOnly(!localFavoritesOnly)}
          >
            Favorites only
          </Button>
        </div>
      </section>

      {/* Tags */}
      <section>
        <h3 className="text-default-500 mb-3 text-xs font-medium tracking-wide uppercase">Tags</h3>

        <div className="relative mb-3">
          <Input
            isClearable
            classNames={{
              inputWrapper: "h-9",
              input: "text-sm",
            }}
            placeholder="Search tags"
            radius="full"
            startContent={<MagnifyingGlassIcon className="text-default-400 h-4 w-4" />}
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            onClear={() => setTagFilter("")}
          />
        </div>

        {isLoading ? (
          <ChipSkeleton />
        ) : (
          <div className="flex flex-wrap gap-1 overflow-y-auto pr-1">
            {allTags
              .filter((t) => t.toLowerCase().includes(tagFilter.toLowerCase()))
              .map((tag) => {
                const active = workingTags.includes(tag);

                return (
                  <Chip
                    key={tag}
                    className="h-7 cursor-pointer px-2 text-[11px]"
                    color={active ? "primary" : "default"}
                    radius="full"
                    variant={active ? "solid" : "flat"}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Chip>
                );
              })}
          </div>
        )}
      </section>

      {/* Footer */}
      <div className="border-default-200/50 mt-auto flex justify-end gap-3 border-t pt-3">
        <Button
          color="danger"
          radius="full"
          size="sm"
          startContent={<ArrowPathIcon className="size-4" />}
          variant="flat"
          onPress={() => {
            clearFilters();
            setWorkingTags([]);
            setLocalFilterMode("AND");
            setLocalSortMode("dateDesc");
            setLocalInput("");
            setLocalFavoritesOnly(false);
            close();
          }}
        >
          Reset
        </Button>
        <Button
          color="primary"
          radius="full"
          size="sm"
          startContent={<CheckIcon className="size-4" />}
          onPress={apply}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}

export default function FiltersPanel({ open, onOpenChange }: FiltersPanelProps) {
  return (
    <Panel open={open} title="Filters" onOpenChange={onOpenChange}>
      {open && <FiltersPanelContent onOpenChange={onOpenChange} />}
    </Panel>
  );
}
