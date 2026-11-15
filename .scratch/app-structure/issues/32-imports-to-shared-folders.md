# 32: Recipe imports move to the shared folders

**What to build:** The recipe import UI, which the library header and the shell open, moves to `components/imports/`, and the import mutations get a hook of their own in `shared-react/recipes`. Nothing visible changes. See `.scratch/app-structure/spec.md`, "Auth and the import move".

**Blocked by:** 29

**Status:** done

- [x] `useImportMutations` in `shared-react/recipes` takes the five import mutations (`importRecipe`, `importRecipeWithAI`, `importRecipeFromImages`, `importRecipeFromPaste`, `importRecipeFromPasteWithAI`) out of `useRecipesMutations`, unchanged.
- [x] `components/imports/` takes the URL, paste and image modals, `clipboard-import-prompt` and `use-import-recipe`. Web's queued, error and "already exists" toasts for imports move with them; `hooks/use-recipes-mutations.ts` keeps the create, update and delete toasts the library and recipes use.
- [x] `lib/clipboard-url.ts` and `hooks/use-clipboard-image-paste.ts` stay where they are (the editor's gallery uses the latter).
- [x] Callers import from the new home: the avatar menu, the app shell, `features/library`'s create button and search field.
- [x] Moved tests (`use-import-recipe`, `import-recipe-modal`, `clipboard-import-prompt`) run against the new homes; `clipboard-import.e2e.ts` stays green.
- [x] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm format:check`, `pnpm deps:cycles`.

## Comments

- Web's queued/error toast became `useRecipeMutationErrorToast` in `hooks/use-recipes-mutations.ts`, which `use-import-recipe` reuses (same `recipes-mutations:<op>` context); only the already-exists toast and `recipes.import` moved into the import hook, so the two don't duplicate the handler.
- shared-react's index exports only `useImportMutations`; its handler types stay in the file, since nothing outside reads them. `useRecipesMutations` lost its second parameter.
- Tests: shared-react's import cases moved to `use-import-mutations.test.ts`; web's already-exists case moved from `__tests__/hooks/use-recipes-mutations.test.tsx` into `__tests__/components/imports/use-import-recipe.test.tsx`; shared component tests live under `__tests__/components/imports/`, as other shared areas' do.
- CONTRIBUTING's "imports and auth have yet to move on web" line is left for 33's docs pass.

### Review (Opus high, standards + spec) and dispositions

The spec review compared the moved mutations line by line with `1369d5160` and found no behaviour difference.

1. **fix**: nothing checks that `useImportRecipe` hands the queued and error toast to `useImportMutations`; the web tests of it were renamed from "import" to "create". One test of a failed and a queued import in `use-import-recipe.test.tsx`.
2. **fix**: duplication in `use-import-mutations.ts`: three identical `onMutate` bodies and the URL and image imports' `onSuccess` tail. Across the two files: the same error-handler type twice, and the same error tail (tell the handler, keep a queued write, else invalidate).
3. **fix**: dead exports: `ImportMutationsResult`, `ImportMutationErrorHandler`, `RecipeAlreadyExistsAdapter` (a callback, so `…Handler`), `RecipesMutationErrorHandler` in `recipes/index.ts`, web's `export type { RecipesMutationsResult }`. The `@heroui/react` mock in web's `use-recipes-mutations.test.tsx` stubs `Button` and `close` for a path that is gone. The comment at `use-import-mutations.ts:24` is three lines.
4. **reject**: the queued and error toasts staying in `hooks/use-recipes-mutations.ts` as `useRecipeMutationErrorToast`. One handler serves create, update, delete and the imports; moving it would copy it. Only the "already exists" toast is the imports' own, and it moved.
5. **fix in 33**: CONTRIBUTING.md and the Architecture page still say imports have yet to move; 33's docs pass has that checkbox.

Fix round (`dbf587047..9a901f4e5`): 1-3 fixed. `recipes/recipes-mutation-error.ts` holds the one handler type and error tail for the recipe writes and the imports (convert and ratings keep theirs: a different shape); `addPlaceholder`, `showImported` and `dropPlaceholder` in `use-import-mutations.ts`. Gates green on the final state; `clipboard-import.e2e.ts` 3/3.
