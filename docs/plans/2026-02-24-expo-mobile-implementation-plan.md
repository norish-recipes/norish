# Expo Mobile (HeroUI Native) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an Expo Router app at `apps/mobile` that renders a basic HeroUI Native starter page using Norish shared theme tokens.

**Architecture:** Create a new workspace app (`@norish/mobile`) and wire it like a T3-style monorepo app: local Expo config + shared tooling exports. Keep theme ownership in `tooling/tailwind` by adding a native adapter export consumed by the mobile app CSS entry. Use Uniwind + HeroUI Native provider stack at root, then render a small starter screen with semantic token classes and theme toggle.

**Tech Stack:** Expo Router, React Native, Uniwind, HeroUI Native, Tailwind CSS v4, pnpm workspaces, Turbo.

---

### Task 1: Scaffold `apps/mobile` workspace app

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/index.ts`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/turbo.json`
- Create: `apps/mobile/.gitignore`

**Step 1: Write the failing test**

Create a workspace-level smoke check script failure by running a filtered command before the package exists:

```bash
pnpm --filter @norish/mobile run dev
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @norish/mobile run dev`
Expected: FAIL with "No projects matched the filters" or missing package error.

**Step 3: Write minimal implementation**

Create `apps/mobile/package.json` with minimum scripts and deps:

```json
{
  "name": "@norish/mobile",
  "private": true,
  "main": "index.ts",
  "scripts": {
    "dev": "expo start",
    "dev:android": "expo start --android",
    "dev:ios": "expo start --ios",
    "lint": "eslint --flag unstable_native_nodejs_ts_config",
    "typecheck": "tsc --noEmit"
  }
}
```

Also create minimal Expo/TS/Turbo files so the workspace is recognized.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @norish/mobile run dev --help`
Expected: PASS (Expo CLI help/start output appears instead of workspace-not-found).

**Step 5: Commit**

```bash
git add apps/mobile/package.json apps/mobile/app.json apps/mobile/index.ts apps/mobile/tsconfig.json apps/mobile/turbo.json apps/mobile/.gitignore
git commit -m "feat(mobile): scaffold expo workspace app"
```

### Task 2: Configure Uniwind + Expo Metro/PostCSS pipeline

**Files:**
- Create: `apps/mobile/metro.config.js`
- Create: `apps/mobile/postcss.config.mjs`
- Create: `apps/mobile/global.css`
- Create: `apps/mobile/uniwind-env.d.ts`

**Step 1: Write the failing test**

Attempt to boot Expo before CSS + metro integration exists:

```bash
pnpm --filter @norish/mobile run dev --offline
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @norish/mobile run dev --offline`
Expected: FAIL with missing CSS processor/transform or unresolved Uniwind setup warning.

**Step 3: Write minimal implementation**

Create CSS and config wiring:

```css
/* apps/mobile/global.css */
@import "tailwindcss";
@import "uniwind";
@import "heroui-native/styles";
@source "./node_modules/heroui-native/lib";
@import "@norish/tailwind-config/native-theme";
```

`postcss.config.mjs` should re-export shared config:

```js
export { default } from "@norish/tailwind-config/postcss-config";
```

`metro.config.js` should use Uniwind + Reanimated wrappers for Expo.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @norish/mobile run dev --offline`
Expected: PASS (Metro starts without Uniwind/heroui-native CSS integration errors).

**Step 5: Commit**

```bash
git add apps/mobile/metro.config.js apps/mobile/postcss.config.mjs apps/mobile/global.css apps/mobile/uniwind-env.d.ts
git commit -m "feat(mobile): add uniwind and css pipeline wiring"
```

### Task 3: Add shared native theme adapter in tooling

**Files:**
- Modify: `tooling/tailwind/package.json`
- Create: `tooling/tailwind/native-theme.css`

**Step 1: Write the failing test**

Check that adapter export is currently missing:

```bash
pnpm --filter @norish/mobile exec node -e "import('@norish/tailwind-config/native-theme').then(()=>console.log('ok')).catch((e)=>{console.error(e.message);process.exit(1);})"
```

**Step 2: Run test to verify it fails**

Run the command above.
Expected: FAIL with package subpath export error.

**Step 3: Write minimal implementation**

Add export in `tooling/tailwind/package.json`:

```json
{
  "exports": {
    "./native-theme": "./native-theme.css"
  }
}
```

Create adapter CSS that imports/reuses Norish tokens and defines missing HeroUI Native semantic vars only.

```css
/* tooling/tailwind/native-theme.css */
@import "./theme.css";

@layer theme {
  @variant light {
    --surface: var(--content1);
    --surface-foreground: var(--content1-foreground);
  }
  @variant dark {
    --surface: var(--content1);
    --surface-foreground: var(--content1-foreground);
  }
}
```

**Step 4: Run test to verify it passes**

Run the same import command again.
Expected: PASS with `ok` output.

**Step 5: Commit**

```bash
git add tooling/tailwind/package.json tooling/tailwind/native-theme.css
git commit -m "feat(theme): expose native theme adapter for mobile"
```

### Task 4: Set up app root providers and router layout

**Files:**
- Create: `apps/mobile/app/_layout.tsx`

**Step 1: Write the failing test**

Add a minimal provider test first:

```tsx
// apps/mobile/__tests__/layout.test.tsx
import { render } from "@testing-library/react-native";
import RootLayout from "../app/_layout";

test("renders root layout", () => {
  const { toJSON } = render(<RootLayout />);
  expect(toJSON()).toBeTruthy();
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @norish/mobile run test -- layout.test.tsx`
Expected: FAIL because `_layout.tsx` does not exist.

**Step 3: Write minimal implementation**

Create root layout:

```tsx
import "../global.css";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { HeroUINativeProvider } from "heroui-native";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider>
        <Stack />
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @norish/mobile run test -- layout.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/mobile/app/_layout.tsx apps/mobile/__tests__/layout.test.tsx
git commit -m "feat(mobile): add root provider layout for heroui native"
```

### Task 5: Build starter page with HeroUI Native and theme toggle

**Files:**
- Create: `apps/mobile/app/index.tsx`
- Create: `apps/mobile/src/lib/theme-mode.ts`
- Create: `apps/mobile/src/lib/theme-mode.test.ts`

**Step 1: Write the failing test**

Create deterministic helper test first:

```ts
import { describe, expect, it } from "vitest";
import { nextTheme } from "./theme-mode";

describe("nextTheme", () => {
  it("cycles light -> dark -> light", () => {
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("light");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @norish/mobile exec vitest run apps/mobile/src/lib/theme-mode.test.ts`
Expected: FAIL because helper file does not exist.

**Step 3: Write minimal implementation**

Implement helper:

```ts
export function nextTheme(theme: "light" | "dark"): "light" | "dark" {
  return theme === "light" ? "dark" : "light";
}
```

Create starter page using HeroUI Native components and Uniwind theme switching.

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @norish/mobile exec vitest run apps/mobile/src/lib/theme-mode.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/mobile/app/index.tsx apps/mobile/src/lib/theme-mode.ts apps/mobile/src/lib/theme-mode.test.ts
git commit -m "feat(mobile): add heroui starter screen with theme toggle"
```

### Task 6: Final verification and workspace hygiene

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Step 1: Write the failing test**

Run full checks before dependency and script finalization:

```bash
pnpm --filter @norish/mobile run typecheck && pnpm --filter @norish/mobile run lint
```

**Step 2: Run test to verify it fails**

Run the command above.
Expected: FAIL until all dependencies/scripts/config are complete.

**Step 3: Write minimal implementation**

- Add required HeroUI Native + peer deps + Uniwind deps to `apps/mobile/package.json`.
- Add any needed root script aliases in `package.json` (for example `dev:mobile`).
- Run install to update lockfile.

**Step 4: Run test to verify it passes**

Run, in order:

```bash
pnpm install
pnpm --filter @norish/mobile run typecheck
pnpm --filter @norish/mobile run lint
pnpm --filter @norish/mobile run dev --offline
```

Expected: PASS for install/typecheck/lint and Expo starts without configuration errors.

**Step 5: Commit**

```bash
git add apps/mobile package.json pnpm-lock.yaml tooling/tailwind
git commit -m "feat(mobile): integrate expo heroui native app with shared norish theme"
```
