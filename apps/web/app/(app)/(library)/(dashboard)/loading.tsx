import TodaysMeals from "@/components/dashboard/today/todays-meals";
import { LibraryScreen } from "@/features/library/library-screen";

export default function Loading() {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-8">
      <TodaysMeals />
      <LibraryScreen skeleton />
    </div>
  );
}
