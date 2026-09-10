/**
 * "Mes livres" — the customer's own cases, matched to their account by the
 * e-mail they gave the intake. A card leads with the book, not with a status
 * code (§48).
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  claimMarketplaceCase,
  listMyCustomerCases,
} from "@/marketplace/services/marketplace.data.functions";
import { CASE_STATUS_LABELS, isCaseStatus } from "@/marketplace/cases/state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEuros } from "@/marketplace/pricing/money";

/** What the customer should do next, or what is being done for them. */
function nextStep(status: string): string {
  switch (status) {
    case "under_review":
    case "pricing":
      return "Ma Reliure prépare le prix de votre projet.";
    case "matching":
    case "awaiting_binder_response":
      return "Nous vérifions la disponibilité des ateliers adaptés.";
    case "binder_accepted":
      return "Un atelier est disponible pour votre projet.";
    case "binder_selected":
      return "Votre atelier est confirmé.";
    default:
      return isCaseStatus(status) ? CASE_STATUS_LABELS[status] : status;
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
function ClaimProject() {
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
          ? "Ce projet était déjà rattaché à votre compte."
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
        Rattacher un projet
      </Label>
      <p className="mt-1 text-sm text-[#6b5847]">
        Collez le lien de suivi reçu par e-mail après avoir présenté votre livre.
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
          {attach.isPending ? "Rattachement…" : "Rattacher"}
        </Button>
      </div>
      {message && <p className="mt-3 text-sm text-[#4b3a2c]">{message}</p>}
    </form>
  );
}

export function CustomerCaseListPage() {
  const fetchCases = useServerFn(listMyCustomerCases);
  const { data, isPending, error } = useQuery({
    queryKey: ["marketplace", "customer", "cases"] as const,
    queryFn: () => fetchCases(),
  });

  if (isPending) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;

  const cases = data ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-2xl">Mes livres</h1>
      </header>

      <ClaimProject />

      {cases.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun projet rattaché à ce compte pour l'instant.
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
                <p className="font-serif text-xl text-[#241a12]">{row.title}</p>
                <p className="mt-1 text-xs text-[#8a7663]">{row.reference}</p>
                <p className="mt-4 text-sm text-[#4b3a2c]">{nextStep(row.status)}</p>
                {row.customerPriceCents && (
                  <p className="mt-2 font-medium text-[#241a12]">
                    {row.customerPriceTtcCents
                      ? `${formatEuros(row.customerPriceTtcCents)} TTC`
                      : formatEuros(row.customerPriceCents)}
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
