# 32: Recipe imports move to the shared folders

**What to build:** The recipe import UI, which the library header and the shell open, moves to `components/imports/`, and the import mutations get a hook of their own in `shared-react/recipes`. Nothing visible changes. See `.scratch/app-structure/spec.md`, "Auth and the import move".

**Blocked by:** 29

**Status:** ready-for-agent

- [ ] `useImportMutations` in `shared-react/recipes` takes the five import mutations (`importRecipe`, `importRecipeWithAI`, `importRecipeFromImages`, `importRecipeFromPaste`, `importRecipeFromPasteWithAI`) out of `useRecipesMutations`, unchanged.
- [ ] `components/imports/` takes the URL, paste and image modals, `clipboard-import-prompt` and `use-import-recipe`. Web's queued, error and "already exists" toasts for imports move with them; `hooks/use-recipes-mutations.ts` keeps the create, update and delete toasts the library and recipes use.
- [ ] `lib/clipboard-url.ts` and `hooks/use-clipboard-image-paste.ts` stay where they are (the editor's gallery uses the latter).
- [ ] Callers import from the new home: the avatar menu, the app shell, `features/library`'s create button and search field.
- [ ] Moved tests (`use-import-recipe`, `import-recipe-modal`, `clipboard-import-prompt`) run against the new homes; `clipboard-import.e2e.ts` stays green.
- [ ] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm format:check`, `pnpm deps:cycles`.

## Comments
