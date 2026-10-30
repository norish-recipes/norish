# 06 In-panel search pickers open above the input on phones

Status: ready-for-agent

Spec: Solution 9

## What

- One shared in-panel combobox popover (wrapping `PanelPortal` + `ComboBox.Popover`) that, on a phone, places the results above the input with a capped height. The parent picker (`components/ingredients/ingredient-picker.tsx`), the store-product field (`components/groceries/grocery-product-field.tsx`) and the nutrition correction's food search (`components/ingredients/nutrition-correction-panel.tsx`) use it.
- Root cause to respect: the popover opens nearly empty, so React Aria's flip never triggers, and the Panel's `repositionInputs={false}` leaves the input near the keyboard.

## Acceptance

- E2E on a phone viewport: typing in the parent picker and the store-product field shows results above the input, and a result can be tapped.
- Desktop placement unchanged.

## Comments

- 2026-10-23, implemented in 8fddcd904. `PanelComboBoxPopover` in `components/Panel/Panel.tsx`. "Phone" is the existing `useIsMobile` (below `md`); the cap is 240px, about five rows. E2E is `ai/pickers-on-phone.e2e.ts`. In a headless browser with no keyboard the parent picker already flips above, so the spec also checks the cap, which fails without the fix. The nutrition food search uses the wrapper but has no E2E. The E2E harness needed an unconnected `VALKEY_URL` (d5d920900).
