/**
 * A verified account may open its own workshop workspace. This never approves
 * that workshop for marketplace leads: approval stays an admin decision.
 *
 * marketplace_binders.user_id is unique and makes concurrent submissions for
 * the same account idempotent. The membership write can be retried if it fails
 * after the binder insert; no second workshop is created.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Supa = SupabaseClient<Database>;

export type SelfRegistrationInput = {
  displayName: string;
  workshopName: string;
  city?: string;
};

export async function createPendingBinderWorkspace(
  sb: Supa,
  userId: string,
  input: SelfRegistrationInput,
): Promise<{ binderId: string; status: string }> {
  const { data: active, error: activeError } = await sb.from("marketplace_binder_members")
    .select("binder_id").eq("user_id", userId).eq("account_status", "active")
    .order("created_at").limit(1).maybeSingle();
  if (activeError) throw activeError;
  if (active) {
    const { data: binder, error } = await sb.from("marketplace_binders")
      .select("status").eq("id", active.binder_id).single();
    if (error) throw error;
    return { binderId: active.binder_id, status: binder.status };
  }

  const findOwned = () => sb.from("marketplace_binders")
    .select("id, status").eq("user_id", userId).maybeSingle();
  const { data: ownedBinder, error: lookupError } = await findOwned();
  if (lookupError) throw lookupError;
  let binder = ownedBinder;
  if (!binder) {
    const inserted = await sb.from("marketplace_binders")
      .insert({
        user_id: userId,
        display_name: input.displayName,
        workshop_name: input.workshopName,
        city: input.city || null,
        status: "pending_review",
      })
      .select("id, status").single();
    if (inserted.error?.code === "23505") {
      // A second request won the user_id uniqueness race.
      const retry = await findOwned();
      if (retry.error) throw retry.error;
      binder = retry.data;
    } else {
      if (inserted.error) throw inserted.error;
      binder = inserted.data;
    }
  }
  if (!binder) throw new Error("Impossible de retrouver cet atelier.");
  if (binder.status !== "pending_review" && binder.status !== "draft") {
    throw new Error("Un atelier existe déjà pour ce compte. Contactez Ma Reliure.");
  }

  const { data: existing, error: memberLookupError } = await sb
    .from("marketplace_binder_members")
    .select("account_status")
    .eq("binder_id", binder.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (memberLookupError) throw memberLookupError;
  if (existing && existing.account_status !== "active") {
    throw new Error("Cet accès atelier a été désactivé. Contactez Ma Reliure.");
  }
  if (!existing) {
    const { error } = await sb.from("marketplace_binder_members").upsert({
      binder_id: binder.id,
      user_id: userId,
      role: "OWNER",
      account_status: "active",
    }, { onConflict: "binder_id,user_id", ignoreDuplicates: true });
    if (error) throw error;
  }
  const { data: confirmed, error: confirmationError } = await sb.from("marketplace_binder_members")
    .select("account_status").eq("binder_id", binder.id).eq("user_id", userId).single();
  if (confirmationError) throw confirmationError;
  if (confirmed.account_status !== "active") {
    throw new Error("Cet accès atelier n'est pas actif. Contactez Ma Reliure.");
  }
  return { binderId: binder.id, status: binder.status };
}
