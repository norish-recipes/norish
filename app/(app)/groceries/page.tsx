import { GroceriesContextProvider } from "./context";
import { StoresContextProvider } from "./stores-context";
import { GroceriesPage as GroceriesPageContent } from "./components/groceries-page";

export default function GroceriesPage() {
  return (
    <StoresContextProvider>
      <GroceriesContextProvider>
        <GroceriesPageContent />
      </GroceriesContextProvider>
    </StoresContextProvider>
  );
}
