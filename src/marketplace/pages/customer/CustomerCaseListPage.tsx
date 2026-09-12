/**
 * "Mes livres" / "My Books" — the customer's own cases, matched to their
 * account by the e-mail they gave the intake. A card leads with the book,
 * not with a status code (§48).
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  claimMarketplaceCase,
  listMyCustomerCases,
} from "@/marketplace/services/marketplace.data.functions";
import { CASE_STATUS_LABELS, CASE_STATUS_LABELS_EN, isCaseStatus } from "@/marketplace/cases/state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEuros } from "@/marketplace/pricing/money";
import type { MarketplaceBrand } from "@/marketplace/brand/brandConfig";

/** What the customer should do next, or what is being done for them. */
function nextStep(status: string, brand: MarketplaceBrand | null): string {
  const en = brand === "FINE_BINDERY";
  switch (status) {
    case "under_review":
    case "pricing":
      return en
        ? "Fine Bindery is preparing your project's price."
        : "Ma Reliure prépare le prix de votre projet.";
    case "matching":
    case "awaiting_binder_response":
      return en
        ? "We are checking the availability of suitable workshops."
        : "Nous vérifions la disponibilité des ateliers adaptés.";
    case "binder_accepted":
      return en
        ? "A workshop is available for your project."
        : "Un atelier est disponible pour votre projet.";
    case "binder_selected":
      return en ? "Your workshop is confirmed." : "Votre atelier est confirmé.";
    default:
      if (!isCaseStatus(status)) return status;
      return en ? CASE_STATUS_LABELS_EN[status] : CASE_STATUS_LABELS[status];
  }
}

/**
 * Attaching a project submitted before this account existed.
 *
 * The intake is anonymous by design, so the link Métré e-mailed the visitor is
 * the proof of ownership. Pasting it here is the durable path; the verified
 * e-mail rapprochement that runs server-side on load covers the common case
 * where the account uses the same address.
 */
function ClaimProject({ brand }: { brand: MarketplaceBrand | null }) {
  const en = brand === "FINE_BINDERY";
  const claim = useServerFn(claimMarketplaceCase);
  const queryClient = useQueryClient();
  const [link, setLink] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const attach = useMutation({
    mutationFn: () => claim({ data: { link } }),
    onSuccess: async (result) => {
      setLink("");
      setMessage(
        result.alreadyOwned
          ? en
            ? "This project was already linked to your account."
            : "Ce projet était déjà rattaché à votre compte."
          : en
            ? "Project linked to your account."
            : "Projet rattaché à votre compte.",
      );
      await queryClient.invalidateQueries({ queryKey: ["marketplace", "customer", "cases"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  return (
    <form
      className="rounded-2xl border border-[#3b2a1d]/15 bg-[#fdfaf3] p-6"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage(null);
        attach.mutate();
      }}
    >
      <Label htmlFor="claim-link" className="font-serif text-lg text-[#241a12]">
        {en ? "Link a project" : "Rattacher un projet"}
      </Label>
      <p className="mt-1 text-sm text-[#6b5847]">
        {en
          ? "Paste the tracking link you received by email after presenting your book."
          : "Collez le lien de suivi reçu par e-mail après avoir présenté votre livre."}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Input
          id="claim-link"
          value={link}
          onChange={(event) => setLink(event.target.value)}
          placeholder="https://…/project-summary/…"
          className="min-w-0 flex-1"
        />
        <Button type="submit" disabled={attach.isPending || link.trim() === ""}>
          {attach.isPending ? (en ? "Linking…" : "Rattachement…") : en ? "Link" : "Rattacher"}
        </Button>
      </div>
      {message && <p className="mt-3 text-sm text-[#4b3a2c]">{message}</p>}
    </form>
  );
}

export function CustomerCaseListPage({ brand }: { brand: MarketplaceBrand | null }) {
  const en = brand === "FINE_BINDERY";
  const fetchCases = useServerFn(listMyCustomerCases);
  const { data, isPending, error } = useQuery({
    queryKey: ["marketplace", "customer", "cases"] as const,
    queryFn: () => fetchCases(),
  });

  if (isPending)
    return <p className="text-sm text-muted-foreground">{en ? "Loading…" : "Chargement…"}</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;

  const cases = data ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-2xl">{en ? "My Books" : "Mes livres"}</h1>
      </header>

      <ClaimProject brand={brand} />

      {cases.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {en ? "No project linked to this account yet." : "Aucun projet rattaché à ce compte pour l'instant."}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {cases.map((row) => (
            <li key={row.id}>
              <Link
                to="/mes-livres/$caseId"
                params={{ caseId: row.id }}
                className="block rounded-2xl border border-[#3b2a1d]/15 bg-[#fdfaf3] p-6 transition hover:border-[#3b2a1d]/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-serif text-xl text-[#241a12]">{row.title}</p>
                  {row.unreadCount > 0 && (
                    <span className="shrink-0 rounded-full bg-[#3b2a1d] px-2 py-0.5 text-xs font-semibold text-[#fdfaf3]">
                      {en
                        ? `${row.unreadCount} new`
                        : `${row.unreadCount} nouveau${row.unreadCount > 1 ? "x" : ""}`}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-[#8a7663]">{row.reference}</p>
                {row.actionRequired && (
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[#8a2e1f]">
                    {en ? "Action required" : "Action requise"}
                  </p>
                )}
                <p className="mt-4 text-sm text-[#4b3a2c]">{nextStep(row.status, brand)}</p>
                {row.customerPriceCents && (
                  <p className="mt-2 font-medium text-[#241a12]">
                    {formatEuros(row.customerPriceCents, en ? "en-US" : "fr-FR")}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
