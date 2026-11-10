import { LibraryScreen } from "@/components/dashboard/dashboard";
import TodaysMeals from "@/components/dashboard/today/todays-meals";

export default function Loading() {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-8">
      <TodaysMeals />
      <LibraryScreen skeleton />
    </div>
  );
}
