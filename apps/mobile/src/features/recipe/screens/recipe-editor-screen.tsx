import type { ComponentRef } from "react";
import type { TextInput } from "react-native";
import React, { useRef, useState } from "react";
import { Alert, Keyboard, Text, View } from "react-native";
import { DragScrollView } from "@/components/drag-list/drag-list";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { FocusedFieldContext, useFocusedFieldInView } from "@/hooks/use-focused-field-in-view";
import { useText } from "@/lib/i18n/use-text";
import { recipeRoute } from "@/lib/tab-routes";
import { useRouter } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { Skeleton } from "heroui-native";
import { useIntl } from "react-intl";

import type { LineMoves, RecipeEditorMode } from "@norish/shared-react/recipes";
import type { FullRecipeDTO } from "@norish/shared/contracts";
import { useIngredientsSubscription } from "@norish/shared-react/config";
import {
  useRecipeEditorForm,
  useRecipeId,
  useRecipeMutationErrorToast,
  useRecipesMutations,
  useUnsavedNavigationGuard,
} from "@norish/shared-react/recipes";

import {
  NutritionCard,
  ServingsAndTimeCard,
  TagsAndCategoriesCard,
} from "../components/editor/detail-cards";
import { EditorFrame } from "../components/editor/editor-frame";
import { EditorField, EditorInput, TitleWithHint } from "../components/editor/editor-parts";
import { IngredientRows } from "../components/editor/ingredient-rows";
import { MediaStrip } from "../components/editor/media-strip";
import { ProvenanceCard, SourceCard } from "../components/editor/provenance-cards";
import { StepRows } from "../components/editor/step-rows";
import { RecipeNotFound } from "../components/recipe-not-found";
import { SectionCard } from "../components/tint";
import { useEditorUploads } from "../hooks/use-editor-uploads";

/** Below the last field and above the keyboard, kept clear when a field is brought into view. */
const FIELD_CLEARANCE = 12;
/** Between the native header and the first card. */
const CONTENT_TOP_CLEARANCE = 8;
/** Below the last card, past the home indicator. */
const CONTENT_BOTTOM_CLEARANCE = 48;

type EditorProps = { mode: RecipeEditorMode; initialData?: FullRecipeDTO };

/** The recipe editor, for Write it yourself and Edit: cards in the page's order, Save or Create in
 * the native header. Without a recipe to edit it is a skeleton, or `notFound` once the recipe is gone. */
export function RecipeEditorScreen({
  mode,
  initialData,
  notFound = false,
}: EditorProps & { notFound?: boolean }) {
  // The recipe as it opened: the form's base, so an edit made meanwhile elsewhere conflicts rather
  // than being overwritten, until a stale answer rebases the form on the fresh recipe.
  const [opened] = useState(initialData);
  const { recipeId } = useRecipeId(mode, opened?.id);

  if (notFound) {
    return (
      <EditorFrame mode={mode}>
        <RecipeNotFound />
      </EditorFrame>
    );
  }

  // The id is minted on the first client render; the editor needs it for photo uploads.
  return recipeId ? (
    <Editor initialData={opened} mode={mode} recipeId={recipeId} />
  ) : (
    <EditorFrame mode={mode} testID="recipe-editor-skeleton">
      <View className="gap-4 px-5 pt-4">
        <Skeleton className="h-[104px] w-[104px] rounded-[20px]" />
        <Skeleton className="h-36 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </View>
    </EditorFrame>
  );
}

function Editor({ mode, initialData, recipeId }: EditorProps & { recipeId: string }) {
  const intl = useIntl();
  const router = useRouter();
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const categoryLabel = useCategoryLabel();
  const { createRecipe, updateRecipe } = useRecipesMutations(useRecipeMutationErrorToast());
  const editor = useRecipeEditorForm({ mode, initialData, locale: intl.locale });
  const uploads = useEditorUploads(recipeId);
  const { form, set } = editor;
  const [lineMoves, setLineMoves] = useState<LineMoves | null>(null);
  // A photo still uploading, or an entry being created, is not in the form yet, and a second
  // tap would save twice.
  const busy = editor.isSaving || uploads.isUploading || editor.isCreatingEntry;
  const text = useText();
  const error = (field: "name" | "ingredients" | "steps" | "servings") => {
    const key = editor.errors[field];

    return key ? text(`recipes.validation.${key}`) : undefined;
  };

  // The ingredient rows draw each food's icon.
  useIngredientsSubscription();

  const guard = useUnsavedNavigationGuard({
    hasUnsavedChanges: editor.hasUnsavedChanges,
    ask: (leave) =>
      Alert.alert(text("recipes.editor.discardTitle"), text("recipes.editor.discardMessage"), [
        { text: text("recipes.editor.keepEditing"), style: "cancel" },
        { text: text("recipes.editor.discard"), style: "destructive", onPress: leave },
      ]),
  });

  // The close button and the back swipe both remove the screen, so both ask here.
  usePreventRemove(editor.hasUnsavedChanges, ({ repeat }) => guard.requestLeave(repeat));

  const { scrollRef, onScroll, onFieldFocus, onContentSizeChange } =
    useFocusedFieldInView(FIELD_CLEARANCE);

  const save = () => {
    if (busy) return;
    const payload = editor.submit();

    if (!payload) {
      // Focusing the name scrolls back up to where its error ring shows.
      if (!form.name.trim()) nameRef.current?.focus();

      return;
    }
    // The editor stays open until the save is stored or queued, so a refusal shows here.
    const after = (leave: () => void) => ({
      onSaved: () => {
        guard.allowNavigation();
        leave();
      },
      onFailed: (failure: unknown) => editor.failSave(failure),
    });

    // Nothing typed while the save is in flight would reach it.
    Keyboard.dismiss();
    if (mode === "create") {
      createRecipe(
        { ...payload, id: recipeId },
        after(() => router.dismissTo(recipeRoute(recipeId)))
      );
    } else if (initialData) {
      updateRecipe(
        initialData.id,
        { ...payload, version: editor.version ?? initialData.version },
        after(() => router.back())
      );
    }
  };

  return (
    <EditorFrame mode={mode} saving={busy} testID="recipe-editor" onSave={save}>
      <DragScrollView
        ref={scrollRef}
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          paddingTop: CONTENT_TOP_CLEARANCE,
          paddingBottom: CONTENT_BOTTOM_CLEARANCE,
        }}
        contentInsetAdjustmentBehavior="never"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        testID="recipe-editor-scroll"
        onContentSizeChange={onContentSizeChange}
        onScroll={onScroll}
      >
        <FocusedFieldContext value={onFieldFocus}>
          <View className="gap-4 px-5" pointerEvents={editor.isSaving ? "none" : "auto"}>
            {editor.errors.submit ? (
              <View className="bg-danger-soft rounded-2xl px-4 py-3">
                <Text className="text-danger text-[15px]">{editor.errors.submit}</Text>
              </View>
            ) : null}
            <MediaStrip
              media={form.media}
              uploads={uploads}
              onChange={(media) => set("media", media)}
            />
            <SectionCard>
              <EditorField first error={error("name")} label={text("recipes.editor.recipeName")}>
                <EditorInput
                  ref={nameRef}
                  accessibilityLabel={text("recipes.editor.recipeName")}
                  placeholder={text("recipes.form.recipeNamePlaceholder")}
                  testID="editor-name"
                  value={form.name}
                  onChangeText={(name) => set("name", name)}
                />
              </EditorField>
              <EditorField label={text("recipes.form.description")}>
                <EditorInput
                  multiline
                  accessibilityLabel={text("recipes.form.description")}
                  placeholder={text("recipes.form.descriptionPlaceholder")}
                  testID="editor-description"
                  value={form.description}
                  onChangeText={(description) => set("description", description)}
                />
              </EditorField>
            </SectionCard>
            <SectionCard
              right={
                <TitleWithHint
                  hint={text("recipes.editor.notesHint")}
                  title={text("recipes.form.notes")}
                />
              }
            >
              <EditorInput
                multiline
                accessibilityLabel={text("recipes.form.notes")}
                placeholder={text("recipes.form.notesPlaceholder")}
                testID="editor-notes"
                value={form.notes}
                onChangeText={(notes) => set("notes", notes)}
              />
            </SectionCard>
            <SectionCard
              right={
                <TitleWithHint
                  hint={text("recipes.editor.ingredientsHint")}
                  title={text("recipes.form.ingredients")}
                />
              }
            >
              <IngredientRows
                key={editor.version}
                ingredients={form.ingredients}
                systemUsed={form.systemUsed}
                onChange={(ingredients) => set("ingredients", ingredients)}
                onLinesMoved={(moves) => {
                  editor.moveLines(moves);
                  setLineMoves(moves);
                }}
              />
              {error("ingredients") ? (
                <Text className="text-danger pt-2 text-[13px] font-medium">
                  {error("ingredients")}
                </Text>
              ) : null}
            </SectionCard>
            <SectionCard
              right={
                <TitleWithHint
                  hint={text("recipes.editor.stepsHint")}
                  title={text("recipes.editor.steps")}
                />
              }
            >
              <StepRows
                key={editor.version}
                ingredients={form.ingredients}
                lineMoves={lineMoves}
                steps={form.steps}
                systemUsed={form.systemUsed}
                uploads={uploads}
                onChange={(steps) => set("steps", steps)}
              />
              {error("steps") ? (
                <Text className="text-danger pt-2 text-[13px] font-medium">{error("steps")}</Text>
              ) : null}
            </SectionCard>
            <TagsAndCategoriesCard
              categoryLabel={categoryLabel}
              categoryOptions={editor.categoryOptions}
              form={form}
              recipeId={editor.listRecipeId}
              set={set}
              onAddCategory={editor.addCategory}
              onToggleCategory={editor.toggleCategory}
            />
            <ServingsAndTimeCard error={error("servings")} form={form} set={set} />
            <NutritionCard form={form} set={set} />
            <ProvenanceCard
              carriedCuisines={initialData?.cuisines}
              recipeId={editor.listRecipeId}
              value={form.provenance}
              onChange={(provenance) => set("provenance", provenance)}
            />
            <SourceCard
              systemUsed={form.systemUsed}
              url={form.url}
              onSystemChange={editor.changeSystem}
              onUrlChange={(url) => set("url", url)}
            />
          </View>
        </FocusedFieldContext>
      </DragScrollView>
    </EditorFrame>
  );
}
