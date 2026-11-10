import TodaysMeals from "@/components/dashboard/today/todays-meals";
import LibrarySkeleton from "@/features/library/components/skeleton/library-skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-8">
      <TodaysMeals />
      <LibrarySkeleton />
    </div>
  );
}
