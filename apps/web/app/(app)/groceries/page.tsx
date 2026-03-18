import { GroceriesPage as GroceriesPageContent } from "./components/groceries-page";
import { GroceriesContextProvider } from "./context";
import { StoresContextProvider } from "./stores-context";

export default function GroceriesPage() {
  return (
    <StoresContextProvider>
      <GroceriesContextProvider>
        <GroceriesPageContent />
      </GroceriesContextProvider>
    </StoresContextProvider>
  );
}
