import { router } from "./trpc";
import { groceriesRouter } from "./routers/groceries";
import { calendarRouter } from "./routers/calendar";
import { recipesRouter } from "./routers/recipes";
import { permissionsRouter } from "./routers/permissions";
import { adminRouter } from "./routers/admin";
import { householdsAppRouter } from "./routers/households";
import { userRouter } from "./routers/user";
import { caldavRouter, caldavSubscriptions } from "./routers/caldav";
import { configRouter } from "./routers/config";
import { archive } from "./routers/archive";
import { favoritesRouter } from "./routers/favorites";

export const appRouter = router({
  groceries: groceriesRouter,
  calendar: calendarRouter,
  recipes: recipesRouter,
  permissions: permissionsRouter,
  admin: adminRouter,
  households: householdsAppRouter,
  user: userRouter,
  caldav: caldavRouter,
  caldavSubscriptions: caldavSubscriptions,
  config: configRouter,
  archive,
  favorites: favoritesRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;
