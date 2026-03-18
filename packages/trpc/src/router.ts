import { adminRouter } from "./routers/admin";
import { archive } from "./routers/archive";
import { caldavRouter, caldavSubscriptions } from "./routers/caldav";
import { calendarRouter } from "./routers/calendar";
import { configRouter } from "./routers/config";
import { favoritesRouter } from "./routers/favorites";
import { groceriesRouter } from "./routers/groceries";
import { householdsAppRouter } from "./routers/households";
import { permissionsRouter } from "./routers/permissions";
import { ratingsRouter } from "./routers/ratings";
import { recipesRouter } from "./routers/recipes";
import { siteAuthTokensRouter } from "./routers/site-auth-tokens";
import { storesRouter } from "./routers/stores";
import { userRouter } from "./routers/user";
import { router } from "./trpc";

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
  ratings: ratingsRouter,
  stores: storesRouter,
  siteAuthTokens: siteAuthTokensRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;
