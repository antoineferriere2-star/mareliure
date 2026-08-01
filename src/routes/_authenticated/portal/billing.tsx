import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listMyWorkspaces, getMyWorkspaceBilling } from "@/build/services/portal.data.functions";
import {
  createWorkspaceCheckoutSession,
  createWorkspaceBillingPortalSession,
} from "@/build/services/billing.data.functions";
import { PLAN_DEFAULTS, formatMonthlyUsdPrice, type PlanId } from "@/build/billing/plans";
import { PortalError, PortalPending } from "@/build/pages/portal/PortalStates";
import { EntitlementBanner } from "@/build/pages/portal/EntitlementBanner";

export const Route = createFileRoute("/_authenticated/portal/billing")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Billing — Client Portal" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  pendingComponent: PortalPending,
  errorComponent: PortalError,
  component: PortalBillingPage,
});

const SELF_SERVICE_PLANS: PlanId[] = ["launch", "growth", "pro", "business"];

function PortalBillingPage() {
  const fetchWorkspaces = useServerFn(listMyWorkspaces);
  const wsOpts = queryOptions({
    queryKey: ["portal", "workspaces"] as const,
    queryFn: () => fetchWorkspaces(),
  });
  const { data: workspaces } = useSuspenseQuery(wsOpts);
  const [workspaceId, setWorkspaceId] = useState<string>(workspaces[0]?.id ?? "");
  const currentWorkspace = workspaces.find((w) => w.id === workspaceId);
  const canManageBilling = currentWorkspace?.role === "owner";

  const checkoutResult =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("checkout")
      : null;

  const fetchBilling = useServerFn(getMyWorkspaceBilling);
  const {
    data: billing,
    isPending: billingPending,
    error: billingError,
  } = useQuery({
    queryKey: ["portal", "billing", workspaceId] as const,
    queryFn: () => fetchBilling({ data: { workspaceId } }),
    enabled: workspaceId.length > 0,
  });

  const checkout = useServerFn(createWorkspaceCheckoutSession);
  const checkoutMutation = useMutation({
    mutationFn: (plan: PlanId) =>
      checkout({ data: { workspaceId, plan, origin: window.location.origin } }),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });

  const portal = useServerFn(createWorkspaceBillingPortalSession);
  const portalMutation = useMutation({
    mutationFn: () => portal({ data: { workspaceId, origin: window.location.origin } }),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });

  const startPlanChange = (plan: PlanId) => {
    if (billing?.hasStripeBilling) {
      portalMutation.mutate();
      return;
    }
    checkoutMutation.mutate(plan);
  };

  if (workspaces.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">No workspace is linked to this account yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Billing</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose or change your plan. Payment is handled by Stripe.
          </p>
        </div>
        {workspaces.length > 1 && (
          <select
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        )}
      </header>

      {!canManageBilling && (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
          View only: only this workspace's owner can change plan or manage the subscription.
        </div>
      )}

      {checkoutResult === "success" && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">
          Payment confirmed. Your plan update may take a few seconds.
        </div>
      )}
      {checkoutResult === "cancel" && (
        <div className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">
          Payment canceled — no change was made.
        </div>
      )}

      {billingError && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {billingError instanceof Error ? billingError.message : "Unable to load your billing."}
        </p>
      )}
      {billingPending && !billingError && <PortalPending />}

      {billing && <EntitlementBanner entitlements={billing.entitlements} />}

      {billing && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-foreground">
            Current plan:{" "}
            <span className="font-semibold">
              {PLAN_DEFAULTS[billing.plan as PlanId]?.label ?? billing.plan}
            </span>
            {billing.subscriptionStatus && (
              <span className="ml-2 text-xs uppercase text-muted-foreground">
                ({billing.subscriptionStatus})
              </span>
            )}
          </p>
          {billing.hasStripeBilling && canManageBilling && (
            <button
              type="button"
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
              className="mt-3 rounded-md border border-input bg-background px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
            >
              {portalMutation.isPending ? "Opening…" : "Manage my subscription"}
            </button>
          )}
          {portalMutation.isError && (
            <p className="mt-2 text-xs text-destructive">
              {portalMutation.error instanceof Error
                ? portalMutation.error.message
                : "An error occurred."}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SELF_SERVICE_PLANS.map((plan) => {
          const defaults = PLAN_DEFAULTS[plan];
          const isCurrent = billing?.plan === plan;
          return (
            <div key={plan} className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold text-foreground">{defaults.label}</h2>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {formatMonthlyUsdPrice(defaults.monthlyUsdPrice)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {defaults.maxActiveMissions} Missions actives ·{" "}
                {defaults.monthlyBriefQuota?.toLocaleString("fr-FR")} Briefs/mois
              </p>
              <button
                type="button"
                onClick={() => startPlanChange(plan)}
                disabled={
                  isCurrent ||
                  !canManageBilling ||
                  checkoutMutation.isPending ||
                  portalMutation.isPending
                }
                className="mt-3 w-full rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {isCurrent
                  ? "Current plan"
                  : checkoutMutation.isPending || portalMutation.isPending
                    ? "Redirecting…"
                    : billing?.hasStripeBilling
                      ? "Change in portal"
                      : "Choose this plan"}
              </button>
            </div>
          );
        })}
      </div>
      {checkoutMutation.isError && (
        <p className="text-xs text-destructive">
          {checkoutMutation.error instanceof Error
            ? checkoutMutation.error.message
            : "An error occurred."}
        </p>
      )}
    </div>
  );
}
