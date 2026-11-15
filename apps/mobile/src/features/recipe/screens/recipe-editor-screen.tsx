import type { ComponentRef } from "react";
import type { TextInput } from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DragScrollView } from "@/components/drag-list/drag-list";
import { GlassCloseButton, GlassSurface } from "@/components/glass";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { FocusedFieldContext, useFocusedFieldInView } from "@/hooks/use-focused-field-in-view";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { Skeleton, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { LineMoves } from "@norish/shared-react/recipes";
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
import { EditorField, EditorInput, TitleWithHint } from "../components/editor/editor-parts";
import { IngredientRows } from "../components/editor/ingredient-rows";
import { MediaStrip } from "../components/editor/media-strip";
import { ProvenanceCard, SourceCard } from "../components/editor/provenance-cards";
import { StepRows } from "../components/editor/step-rows";
import { FadeEdge } from "../components/fade-edge";
import { SectionCard } from "../components/tint";
import { PopupOpenContext } from "../hooks/popup-open-context";
import { useEditorUploads } from "../hooks/use-editor-uploads";

const PILL = 56;

type EditorProps = { mode: "create" | "edit"; initialData?: FullRecipeDTO };

function useKeyboardShown() {
  const [shown, setShown] = useState(Keyboard.isVisible());

  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", () => setShown(true));
    const hide = Keyboard.addListener("keyboardWillHide", () => setShown(false));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return shown;
}

/** The skeleton an edit shows while its recipe is read. */
export function RecipeEditorSkeleton() {
  return (
    <View className="bg-background flex-1 gap-4 px-5 pt-32" testID="recipe-editor-skeleton">
      <Skeleton className="h-[104px] w-[104px] rounded-[20px]" />
      <Skeleton className="h-36 w-full rounded-3xl" />
      <Skeleton className="h-64 w-full rounded-3xl" />
    </View>
  );
}

/**
 * The recipe editor, for Write it yourself and for Edit: cards in the page's order, Save or Create
 * in the pill. Leaving with changes asks first, from the close button and the back swipe alike.
 */
export function RecipeEditorScreen({ mode, initialData }: EditorProps) {
  // The recipe as it opened: a save carries its version, so an edit made meanwhile elsewhere
  // conflicts rather than being overwritten.
  const [opened] = useState(initialData);
  const { recipeId } = useRecipeId(mode, opened?.id);

  // The id is minted on the first client render; the editor needs it for photo uploads.
  return recipeId ? (
    <Editor initialData={opened} mode={mode} recipeId={recipeId} />
  ) : (
    <RecipeEditorSkeleton />
  );
}

function Editor({ mode, initialData, recipeId }: EditorProps & { recipeId: string }) {
  const intl = useIntl();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const categoryLabel = useCategoryLabel();
  const [background, accent, accentForeground] = useThemeColor([
    "background",
    "accent",
    "accent-foreground",
  ] as const);
  const { createRecipe, updateRecipe } = useRecipesMutations(useRecipeMutationErrorToast());
  const editor = useRecipeEditorForm({ mode, initialData, locale: intl.locale });
  const uploads = useEditorUploads(recipeId);
  const { form, set } = editor;
  const [lineMoves, setLineMoves] = useState<LineMoves | null>(null);
  // A photo still uploading is not in the form yet, and a second tap would save twice.
  const [saving, setSaving] = useState(false);
  const busy = saving || uploads.isUploading;
  const text = (id: string) => intl.formatMessage({ id });
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

  // Over the keyboard the pill needs no room for the home indicator.
  const pillGap = useKeyboardShown() ? 10 : Math.max(insets.bottom, 12) + 10;
  const { scrollRef, onScroll, onFieldFocus, onContentSizeChange } = useFocusedFieldInView(
    PILL + 10 + 12
  );
  // The `@` popup can sit under the pill when the content cannot scroll it clear: it gets the tap.
  const [popupOpen, setPopupOpen] = useState(false);

  const save = () => {
    if (busy) return;
    const payload = editor.submit();

    if (!payload) {
      // Focusing the name scrolls back up to where its error ring shows.
      if (!form.name.trim()) nameRef.current?.focus();

      return;
    }
    guard.allowNavigation();
    setSaving(true);
    try {
      if (mode === "create") {
        createRecipe({ ...payload, id: recipeId });
        router.dismissTo({ pathname: "/recipe/[id]", params: { id: recipeId } });
      } else if (initialData) {
        updateRecipe(initialData.id, { ...payload, version: initialData.version });
        router.back();
      }
    } catch (failure) {
      setSaving(false);
      guard.disallowNavigation();
      editor.failSubmit(failure instanceof Error ? failure.message : String(failure));
    }
  };

  return (
    <View className="bg-background flex-1" testID="recipe-editor">
      <DragScrollView
        ref={scrollRef}
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingTop: insets.top + 72, paddingBottom: PILL + 64 }}
        contentInsetAdjustmentBehavior="never"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        testID="recipe-editor-scroll"
        onContentSizeChange={onContentSizeChange}
        onScroll={onScroll}
      >
        <PopupOpenContext value={setPopupOpen}>
          <FocusedFieldContext value={onFieldFocus}>
            <View className="gap-4 px-5">
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
                set={set}
                onAddCategory={editor.addCategory}
                onToggleCategory={editor.toggleCategory}
              />
              <ServingsAndTimeCard error={error("servings")} form={form} set={set} />
              <NutritionCard form={form} set={set} />
              <ProvenanceCard
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
        </PopupOpenContext>
      </DragScrollView>
      <FadeEdge color={background} edge="top" height={insets.top + 70} solidFraction={0.55} />
      <View
        className="absolute right-4 left-4 flex-row items-center gap-3"
        style={{ top: insets.top + 6 }}
      >
        <GlassCloseButton testID="recipe-editor-close" onPress={() => router.back()} />
        <Text className="text-foreground flex-1 text-center text-[17px] font-semibold">
          {text(mode === "create" ? "recipes.editor.newTitle" : "recipes.editor.editTitle")}
        </Text>
        <View className="w-10" />
      </View>
      <FadeEdge color={background} edge="bottom" height={120} solidFraction={0.3} />
      {/* The pill rides the keyboard up, so Save stays in reach while typing. */}
      <KeyboardAvoidingView
        behavior="padding"
        className="absolute right-5 bottom-0 left-5"
        pointerEvents={popupOpen ? "none" : "box-none"}
      >
        {/* The avoiding view sets its own padding, so the gap is a view of its own. */}
        <View style={{ paddingBottom: pillGap }}>
          <Pressable
            accessibilityLabel={text(
              mode === "create" ? "common.actions.create" : "common.actions.save"
            )}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            className={`flex-row items-center justify-center gap-2 rounded-full ${busy ? "opacity-50" : ""}`}
            disabled={busy}
            style={{ height: PILL }}
            testID="recipe-editor-save"
            onPress={save}
          >
            <GlassSurface radius={PILL / 2} tint={accent} />
            <Ionicons color={accentForeground} name="checkmark" size={20} />
            <Text className="text-accent-foreground text-[17px] font-semibold">
              {text(mode === "create" ? "common.actions.create" : "common.actions.save")}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
