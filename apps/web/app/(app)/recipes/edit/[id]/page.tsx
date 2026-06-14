import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { auth } from "@norish/auth/auth";
import { canAccessResource } from "@norish/auth/permissions";
import { getRecipeFull, getRecipeOwnerId, isUserServerAdmin } from "@norish/db";
import { getHouseholdForUser } from "@norish/db/repositories/households";

import RecipeForm from "../components/recipe-form";

interface EditRecipePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditRecipePage({ params }: EditRecipePageProps) {
  const { id } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) return null; // This should never happen due to proxy

  const recipe = await getRecipeFull(id);

  if (!recipe) {
    notFound();
  }

  // Mirror the tRPC layer's assertRecipeAccess: orphaned recipes are editable,
  // everything else goes through the recipe permission policy.
  const ownerId = await getRecipeOwnerId(id);

  if (ownerId !== null) {
    const [household, isServerAdmin] = await Promise.all([
      getHouseholdForUser(session.user.id),
      isUserServerAdmin(session.user.id),
    ]);
    const householdUserIds = household?.users.map((member) => member.id) ?? null;
    const canEdit = await canAccessResource(
      "edit",
      session.user.id,
      ownerId,
      householdUserIds,
      isServerAdmin
    );

    if (!canEdit) {
      notFound();
    }
  }

  return <RecipeForm initialData={recipe} mode="edit" />;
}
