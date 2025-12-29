import { GroceriesContextProvider } from "./context";
import { StoresContextProvider } from "./stores-context";
import { GroceriesPageMobile } from "./components/groceries-page-mobile";
import { GroceriesPageDesktop } from "./components/groceries-page-desktop";

export default function GroceriesPage() {
  return (
    <StoresContextProvider>
      <GroceriesContextProvider>
        <div className="flex min-h-0 w-full flex-1 flex-col md:hidden">
          <GroceriesPageMobile />
        </div>

        <div className="hidden min-h-0 w-full flex-1 flex-col md:flex">
          <GroceriesPageDesktop />
        </div>
      </GroceriesContextProvider>
    </StoresContextProvider>
  );
}
