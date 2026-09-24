import { router } from "../../trpc";
import { ratingsProcedures } from "./ratings";
import { ratingsSubscriptions } from "./subscriptions";

export const ratingsRouter = router({
  ...ratingsProcedures._def.procedures,
  ...ratingsSubscriptions._def.procedures,
});
