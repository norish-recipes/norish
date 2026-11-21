import TodaysMeals from "@/components/dashboard/today/todays-meals";
import { LibraryScreen } from "@/features/library/library-screen";

// The Live route and the offline bootstrap draw this: Today's meals above the Library.
export default function Home() {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-8">
      <TodaysMeals />
      <LibraryScreen />
    </div>
  );
}
