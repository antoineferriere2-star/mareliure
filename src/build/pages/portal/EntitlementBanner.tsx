// Tells a workspace owner where they stand before they hit a 402 from the
// server. The server guard (assertCanPublish) is the actual enforcement —
// this only makes the state legible, so an expired trial reads as an
// expected next step rather than a broken button.
import { Link } from "@tanstack/react-router";
import type { Entitlements } from "@/build/billing/entitlements";

interface BannerCopy {
  tone: "info" | "warning";
  title: string;
  body: string;
  cta: string | null;
}

/** Null for every state where nothing needs saying (subscribed, admin-managed, trial with room left). */
function bannerFor(entitlements: Entitlements): BannerCopy | null {
  switch (entitlements.state) {
    case "trialing": {
      const days = entitlements.trialDaysRemaining;
      // Stay quiet for most of the trial; speak up in the final stretch.
      if (days === null || days > 5) return null;
      return {
        tone: "info",
        title:
          days === 1 ? "1 day left in your free trial" : `${days} days left in your free trial`,
        body: "Choose a plan to keep publishing new Project Intakes once the trial ends.",
        cta: "See plans",
      };
    }
    case "trial_expired":
      return {
        tone: "warning",
        title: "Your free trial has ended",
        body: "Project Intakes already online keep collecting submissions. Choose a plan to publish a new one.",
        cta: "See plans",
      };
    case "subscription_ended":
      return {
        tone: "warning",
        title: "Your subscription is no longer active",
        body: "Project Intakes already online keep collecting submissions. Reactivate your plan to publish again.",
        cta: "Manage billing",
      };
    case "grace_past_due":
      return {
        tone: "warning",
        title: "We could not process your last payment",
        body: "Everything still works while your card is retried. Update your payment method to avoid interruption.",
        cta: "Manage billing",
      };
    case "workspace_disabled":
      return {
        tone: "warning",
        title: "This workspace is disabled",
        body: "Contact us to reactivate it.",
        cta: null,
      };
    case "subscribed":
    case "admin_managed":
      return null;
  }
}

const TONE_CLASS: Record<BannerCopy["tone"], string> = {
  info: "border-border bg-card text-muted-foreground",
  warning: "border-amber-500/40 bg-amber-500/5 text-foreground",
};

export function EntitlementBanner({ entitlements }: { entitlements: Entitlements }) {
  const copy = bannerFor(entitlements);
  if (!copy) return null;

  return (
    <div
      role={copy.tone === "warning" ? "alert" : undefined}
      className={`rounded-lg border px-4 py-3 text-sm ${TONE_CLASS[copy.tone]}`}
    >
      <p className="font-medium text-foreground">{copy.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{copy.body}</p>
      {copy.cta && (
        <Link
          to="/portal/billing"
          className="mt-2 inline-block text-sm font-medium text-primary underline underline-offset-4"
        >
          {copy.cta}
        </Link>
      )}
    </div>
  );
}
