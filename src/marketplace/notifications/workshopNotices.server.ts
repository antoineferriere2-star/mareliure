import type { Supa } from "@/build/services/adminAuth.server";
import { workshopOrigin } from "@/marketplace/billing/workshopSubscription";
import { assertExpectedStripeAccount } from "@/marketplace/stripe/stripeClient.server";
import type { MarketplaceBrand } from "@/marketplace/brand/brandConfig";

/** The persisted notice stays visible even if delivery fails. Webhook retries resume the email. */
export async function notifyWorkshop(
  sb: Supa,
  notice: { id: string; binderId: string; heading: string; intro: string; brand?: MarketplaceBrand },
) {
  const brand = notice.brand ?? "MA_RELIURE";
  const brandName = brand === "FINE_BINDERY" ? "Fine Bindery" : "Ma Reliure";
  const inserted = await sb.from("marketplace_workshop_notices").upsert(
    {
      id: notice.id,
      binder_id: notice.binderId,
      heading: notice.heading,
      intro: notice.intro,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (inserted.error) throw inserted.error;
  const claimed = await sb.rpc("marketplace_claim_workshop_notice", { p_id: notice.id });
  if (claimed.error) throw claimed.error;
  if (!claimed.data) {
    const current = await sb
      .from("marketplace_workshop_notices")
      .select("sent_at,captured_at")
      .eq("id", notice.id)
      .single();
    if (current.error) throw current.error;
    if (current.data.sent_at || current.data.captured_at) return;
    throw new Error("workshop_notice_in_progress");
  }
  try {
    if (process.env.WORKSHOP_NOTICE_TEST_CAPTURE === "true") {
      // Fail closed outside the existing isolated recipe; never mark a capture as sent.
      if (
        !process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") ||
        process.env.STRIPE_EXPECTED_ACCOUNT_ID !== "acct_1UGISJKB3EBc6Slh" ||
        process.env.SUPABASE_URL !== "https://qwfhebtxeubfmvvdsqdt.supabase.co"
      )
        throw new Error("workshop_notice_capture_requires_isolated_test_environment");
      await assertExpectedStripeAccount();
      const [{ render }, React, { template }] = await Promise.all([
        import("@react-email/render"),
        import("react"),
        import("@/lib/email-templates/case-activity"),
      ]);
      const text = await render(
        React.createElement(template.component, {
          brandName,
          locale: "fr-FR",
          heading: notice.heading,
          intro: notice.intro,
          ctaLabel: "Ouvrir mon atelier",
          ctaUrl: `${workshopOrigin()}/atelier/abonnement`,
        }),
        { plainText: true },
      );
      const saved = await sb
        .from("marketplace_workshop_notices")
        .update({
          captured_at: new Date().toISOString(),
          captured_text: text,
          processing_until: null,
          claim_token: null,
        })
        .eq("id", notice.id)
        .eq("claim_token", claimed.data);
      if (saved.error) throw saved.error;
      return;
    }
    const binder = await sb
      .from("marketplace_binders")
      .select("user_id")
      .eq("id", notice.binderId)
      .single();
    if (binder.error) throw binder.error;
    if (!binder.data.user_id) throw new Error("workshop_owner_missing");
    const owner = await sb.auth.admin.getUserById(binder.data.user_id);
    if (owner.error || !owner.data.user?.email) throw new Error("workshop_owner_email_missing");
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const result = await sendTemplateEmail("case-activity", owner.data.user.email, {
      brand,
      idempotencyKey: `workshop-${notice.id}`,
      templateData: {
        brandName,
        locale: "fr-FR",
        heading: notice.heading,
        intro: notice.intro,
        ctaLabel: "Ouvrir mon atelier",
        ctaUrl: `${workshopOrigin()}/atelier/abonnement`,
      },
    });
    if (!result.sent) throw new Error("workshop_notice_not_delivered");
    const saved = await sb
      .from("marketplace_workshop_notices")
      .update({ sent_at: new Date().toISOString(), processing_until: null, claim_token: null })
      .eq("id", notice.id)
      .eq("claim_token", claimed.data);
    if (saved.error) throw saved.error;
  } catch (error) {
    await sb
      .from("marketplace_workshop_notices")
      .update({ processing_until: null, claim_token: null })
      .eq("id", notice.id)
      .eq("claim_token", claimed.data);
    throw error;
  }
}
