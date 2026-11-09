import { GroceriesRoot } from "@/features/groceries/groceries-root";

/** The list and the Pantry under the root they share; each page seeds and renders its own view. */
export default function GroceriesLayout({ children }: LayoutProps<"/groceries">) {
  return <GroceriesRoot>{children}</GroceriesRoot>;
}
