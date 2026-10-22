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
import { decideReview } from "@/marketplace/binders/application";
import { validateBinderApplication } from "@/marketplace/binders/applicationValidation";
import { MARELIURE_CONTACT_EMAIL } from "@/marketplace/legal/legalEntity";

/**
 * Public, sans authentification — c'est le seul point d'entrée d'un atelier
 * qui n'a encore aucun compte. Les refus détaillent uniquement la saisie :
 * aucune décision d'acceptation ou de rejet de l'atelier n'est révélée.
 */
export const submitBinderApplication = createServerFn({ method: "POST" })
  .validator(validateBinderApplication)
  .handler(async ({ data: validation }) => {
    if (!validation.ok) return validation;
    const { data } = validation;
    // Un bot remplit tout ce qu'il trouve, y compris un champ qu'une personne
    // ne voit jamais (masqué en CSS côté formulaire). Faux succès plutôt
    // qu'un rejet explicite : rien n'apprend au bot que ce champ le trahit.
    if (data.hpCompanyName) return { ok: true as const };

    const sb = await admin();
    const { error } = await sb.from("marketplace_binder_applications").insert({
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email.toLowerCase(),
      phone: data.phone || null,
      workshop_name: data.workshopName,
      legal_entity_type: data.legalEntityType ?? null,
      city: data.city || null,
      website_url: data.websiteUrl || null,
      skills: data.skills,
      years_experience: data.yearsExperience ?? null,
      average_annual_revenue_band: data.averageAnnualRevenueBand ?? null,
      message: data.message || null,
    });
    if (error) fail(500, "Votre candidature n’a pas pu être enregistrée. Réessayez dans un instant.");

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

    return { ok: true as const };
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
  .validator((data: unknown) =>
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
