/**
 * Candidature atelier partenaire (§7) — un formulaire public, une lecture
 * admin. Voir binders/application.ts pour ce qui rend une candidature
 * distincte d'un profil d'atelier.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin, assertAdmin } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { logOperationalError } from "@/build/services/operationalLog.server";
import { LEGAL_ENTITY_TYPES, REVENUE_BANDS, decideReview } from "@/marketplace/binders/application";
import { MARELIURE_CONTACT_EMAIL } from "@/marketplace/legal/legalEntity";

const applicationInput = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(30).optional(),
  workshopName: z.string().trim().min(1).max(200),
  legalEntityType: z.enum(LEGAL_ENTITY_TYPES),
  city: z.string().trim().max(100).optional(),
  yearsExperience: z.number().int().min(0).max(100).optional(),
  averageAnnualRevenueBand: z.enum(REVENUE_BANDS).optional(),
  message: z.string().trim().max(2000).optional(),
});

/**
 * Public, sans authentification — c'est le seul point d'entrée d'un atelier
 * qui n'a encore aucun compte. Ne révèle rien en retour au-delà du succès :
 * une candidature n'est ni acceptée ni refusée dans l'instant.
 */
export const submitBinderApplication = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => applicationInput.parse(data))
  .handler(async ({ data }) => {
    const sb = await admin();
    const { error } = await sb.from("marketplace_binder_applications").insert({
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email.toLowerCase(),
      phone: data.phone || null,
      workshop_name: data.workshopName,
      legal_entity_type: data.legalEntityType,
      city: data.city || null,
      years_experience: data.yearsExperience ?? null,
      average_annual_revenue_band: data.averageAnnualRevenueBand ?? null,
      message: data.message || null,
    });
    if (error) fail(500, error.message);

    // Best-effort : une candidature reçue mais non notifiée reste lisible
    // depuis l'admin — jamais bloquante pour la personne qui vient de
    // postuler, même discipline que les autres notifications du produit.
    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      await sendTemplateEmail("case-activity", MARELIURE_CONTACT_EMAIL, {
        templateData: {
          heading: "Nouvelle candidature atelier",
          intro: `${data.firstName} ${data.lastName} (${data.workshopName}) souhaite rejoindre le réseau Ma Reliure.`,
          ctaLabel: "Voir les candidatures",
          ctaUrl: "https://mareliure.fr/marketplace/binders",
        },
      });
    } catch (err) {
      logOperationalError("binder-application.notify-admin-failed", err, {});
    }

    return { ok: true };
  });

export const listBinderApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data, error } = await sb
      .from("marketplace_binder_applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) fail(500, error.message);
    return data ?? [];
  });

export const markBinderApplicationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        applicationId: z.string().uuid(),
        status: z.enum(["reviewed", "accepted", "rejected"]),
        note: z.string().trim().max(1000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const sb = await admin();
    const { data: application } = await sb
      .from("marketplace_binder_applications")
      .select("status")
      .eq("id", data.applicationId)
      .maybeSingle();
    if (!application) fail(404, "Candidature introuvable.");
    const decision = decideReview(application!);
    if (!decision.allowed) fail(409, decision.reason!);

    const { error } = await sb
      .from("marketplace_binder_applications")
      .update({
        status: data.status,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        review_note: data.note || null,
      })
      .eq("id", data.applicationId)
      .eq("status", "new");
    if (error) fail(500, error.message);
    return { ok: true };
  });
