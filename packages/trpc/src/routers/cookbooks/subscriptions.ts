import { createEnvelopeAwareSubscription } from "../../helpers";
import { router } from "../../trpc";
import { cookbookEmitter } from "./emitter";

const onCreated = createEnvelopeAwareSubscription(cookbookEmitter, "created", "cookbook created");
const onUpdated = createEnvelopeAwareSubscription(cookbookEmitter, "updated", "cookbook updated");
const onDeleted = createEnvelopeAwareSubscription(cookbookEmitter, "deleted", "cookbook deleted");
const onMembershipChanged = createEnvelopeAwareSubscription(
  cookbookEmitter,
  "membershipChanged",
  "cookbook membership changed"
);

export const cookbooksSubscriptions = router({
  onCreated,
  onUpdated,
  onDeleted,
  onMembershipChanged,
});
