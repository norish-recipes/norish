# Mobile HeroUI Theme Switcher And Showcase Card Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a basic 3-state theme switcher (system/light/dark) and a HeroUI Native showcase card (text + image) in the Expo mobile app while resolving current runtime version and theme-token issues.

**Architecture:** Keep state ownership in the app root layout and pass resolved theme into HeroUI Native provider. Keep the starter screen minimal and documentation-focused with semantic class names. Fix runtime instability by enforcing pnpm-managed dependencies and adding missing static token mappings required by Uniwind/HeroUI Native.

**Tech Stack:** Expo Router, React Native, HeroUI Native, Uniwind (Tailwind v4), pnpm workspace.

---

### Task 1: Stabilize Dependency Runtime Resolution

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `pnpm-lock.yaml`

**Step 1: Ensure Expo start script preserves LAN host requirement without npm indirection**

Edit `apps/mobile/package.json` `scripts.start` to:

```json
"start": "REACT_NATIVE_PACKAGER_HOSTNAME=192.168.2.13 expo start --host lan -c"
```

**Step 2: Pin Expo-compatible React versions in mobile app**

Set in `apps/mobile/package.json`:

```json
"react": "19.1.0",
"react-dom": "19.1.0"
```

**Step 3: Reinstall with pnpm to rebuild lockfile and links**

Run:

```bash
rm -rf apps/mobile/node_modules && pnpm install
```

Expected: no npm-managed tree in `apps/mobile/node_modules` with `react-native@0.82.x` / `react-native-worklets@0.7.x`.

**Step 4: Verify resolved runtime versions from mobile context**

Run:

```bash
node -p "require(require.resolve('react/package.json',{paths:['./apps/mobile']})).version"
node -p "require(require.resolve('react-dom/package.json',{paths:['./apps/mobile']})).version"
node -p "require(require.resolve('react-native/package.json',{paths:['./apps/mobile']})).version"
node -p "require(require.resolve('react-native-worklets/package.json',{paths:['./apps/mobile']})).version"
```

Expected: `19.1.0`, `19.1.0`, `0.81.5`, `0.5.1`.

**Step 5: Commit**

```bash
git add apps/mobile/package.json pnpm-lock.yaml
git commit -m "fix(mobile): align expo runtime dependency versions"
```

### Task 2: Resolve Remaining Uniwind/HeroUI Native Theme Token Warnings

**Files:**
- Modify: `tooling/tailwind/native-theme.css`
- Modify: `apps/mobile/global.css` (only if needed)

**Step 1: Add explicit static fallback for missing accent hover token**

In both light and dark blocks in `tooling/tailwind/native-theme.css`, add:

```css
--accent-hover: color-mix(in oklab, var(--accent) 90%, var(--accent-foreground) 10%);
--color-accent-hover: var(--accent-hover);
```

**Step 2: Keep imports minimal and non-recursive in mobile CSS entry**

Confirm `apps/mobile/global.css` only contains:

```css
@import "tailwindcss";
@import "uniwind";
@import "@norish/tailwind-config/native-theme";
@import "heroui-native/styles";
```

No `@source` directives.

**Step 3: Bundle once to verify token warning behavior**

Run:

```bash
pnpm --filter @norish/mobile exec expo export --platform ios --output-dir dist-export
```

Expected: successful bundle; no runtime crash from CSS recursion.

**Step 4: Commit**

```bash
git add tooling/tailwind/native-theme.css apps/mobile/global.css
git commit -m "fix(mobile): add static accent hover token mapping"
```

### Task 3: Add 3-State Theme Switcher (System/Light/Dark)

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`
- Modify: `apps/mobile/app/index.tsx`

**Step 1: Add theme mode type and state in root layout**

In `apps/mobile/app/_layout.tsx`, define:

```ts
type ThemeMode = "system" | "light" | "dark";
```

Use `useState<ThemeMode>("system")` and `useColorScheme()` (or `Appearance`) to derive effective theme.

**Step 2: Pass resolved theme into HeroUI provider and expose updater**

If `HeroUINativeProvider` supports theme prop/config, pass effective theme there. Create a simple context in `_layout.tsx` to expose `{themeMode, setThemeMode}` to `index.tsx`.

**Step 3: Render basic segmented controls on home screen**

In `apps/mobile/app/index.tsx`, add three small HeroUI buttons/chips:
- `System`
- `Light`
- `Dark`

Each sets mode in context.

**Step 4: Verify behavior manually**

Run:

```bash
pnpm --filter @norish/mobile run start
```

Expected: selecting each mode updates the app theme immediately.

**Step 5: Commit**

```bash
git add apps/mobile/app/_layout.tsx apps/mobile/app/index.tsx
git commit -m "feat(mobile): add system-light-dark theme switcher"
```

### Task 4: Add HeroUI Native Showcase Card (Text + Image)

**Files:**
- Modify: `apps/mobile/app/index.tsx`

**Step 1: Add a card block using HeroUI Native primitives**

Use `Card` compound sections (header/body/footer where available) with semantic class names:
- `bg-background`
- `text-foreground`
- `bg-primary`

**Step 2: Add image in card body for docs smoke test**

Use RN `Image` (or Expo `Image`) in card body with fixed dimensions and rounded corners.

Example source:

```ts
const demoImage = "https://images.unsplash.com/photo-1498837167922-ddd27525d352?q=80&w=1200&auto=format&fit=crop";
```

**Step 3: Keep copy concise and test-focused**

Card text should indicate this is a HeroUI Native integration smoke-test surface.

**Step 4: Commit**

```bash
git add apps/mobile/app/index.tsx
git commit -m "feat(mobile): add heroui showcase card with image"
```

### Task 5: Final Verification

**Files:**
- N/A (verification only)

**Step 1: Lint**

Run:

```bash
pnpm --filter @norish/mobile run lint
```

Expected: pass.

**Step 2: Typecheck**

Run:

```bash
pnpm --filter @norish/mobile run typecheck
```

Expected: pass.

**Step 3: Build/export smoke test**

Run:

```bash
pnpm --filter @norish/mobile exec expo export --platform ios --output-dir dist-export
```

Expected: successful bundle without default-export or stack-overflow errors.

**Step 4: Runtime startup smoke test**

Run:

```bash
pnpm --filter @norish/mobile run start
```

Expected: Metro starts; app launches; theme switcher and showcase card render.
