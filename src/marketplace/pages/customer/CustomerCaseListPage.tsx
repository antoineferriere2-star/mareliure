/**
 * "Mes livres" / "My books" — la liste des projets d'un client.
 *
 * Elle répond, pour chaque livre, à trois questions sans qu'on ouvre le
 * dossier : de quoi s'agit-il, où en est-il, et est-ce que j'ai quelque chose
 * à faire. Un projet qui attend le client passe en premier. Pas d'identifiant
 * interne, pas de statut technique : ce que le client lit vient de
 * `customerPresentation.ts`, le même vocabulaire que sur le détail.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen } from "lucide-react";
import {
  claimMarketplaceCase,
  listMyCustomerCases,
} from "@/marketplace/services/marketplace.data.functions";
import {
  customerCopy,
  customerLocaleForBrand,
  customerNextStep,
  customerStatus,
  formatCustomerDate,
  sortForCustomer,
  type CustomerCaseFacts,
  type CustomerCopy,
  type CustomerLocale,
} from "@/marketplace/customer/customerPresentation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEuros } from "@/marketplace/pricing/money";
import type { MarketplaceBrand } from "@/marketplace/brand/brandConfig";
import { PortalEmpty, PortalError, PortalListSkeleton, StatusBadge } from "./CustomerPortalUi";

export interface CustomerListRow {
  id: string;
  status: string;
  createdAt: string;
  title: string;
  projectType: string | null;
  thumbnailUrl: string | null;
  currency: string;
  amountCents: number | null;
  amountIncludesTax: boolean;
  hasPrice: boolean;
  proposalAccepted: boolean;
  proposalAcceptable: boolean;
  paymentEligible: boolean;
  paid: boolean;
  unreadCount: number;
  actionRequired: boolean;
}

function factsOf(row: CustomerListRow): CustomerCaseFacts {
  return {
    status: row.status,
    hasPrice: row.hasPrice,
    proposalAccepted: row.proposalAccepted,
    proposalAcceptable: row.proposalAcceptable,
    paymentEligible: row.paymentEligible,
    paid: row.paid,
    actionRequired: row.actionRequired,
  };
}

function Thumbnail({ url, alt }: { url: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <span
        aria-hidden="true"
        className="flex h-16 w-16 shrink-0 sm:h-20 sm:w-20 items-center justify-center rounded-lg border border-[#3b2a1d]/15 bg-[#f3ece0] text-[#a98c55]"
      >
        <BookOpen className="h-6 w-6 sm:h-7 sm:w-7" />
      </span>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-16 w-16 shrink-0 sm:h-20 sm:w-20 rounded-lg border border-[#3b2a1d]/15 object-cover"
    />
  );
}

function ProjectCard({
  row,
  locale,
  copy,
}: {
  row: CustomerListRow;
  locale: CustomerLocale;
  copy: CustomerCopy;
}) {
  const facts = factsOf(row);
  const status = customerStatus(facts, locale);
  const next = customerNextStep(facts, locale);
  const created = formatCustomerDate(row.createdAt, locale);
  const meta = [row.projectType, created ? copy.createdOn(created) : null].filter(Boolean).join(" · ");
  const urgent = row.actionRequired || row.paymentEligible || row.proposalAcceptable;

  return (
    <Link
      to="/mes-livres/$caseId"
      params={{ caseId: row.id }}
      className={`flex h-full gap-3 rounded-2xl border bg-[#fdfaf3] p-4 transition sm:gap-4 sm:p-5 hover:border-[#3b2a1d]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b2a1d]/60 focus-visible:ring-offset-2 ${
        urgent ? "border-[#8a2e1f]/40" : "border-[#3b2a1d]/15"
      }`}
    >
      <Thumbnail url={row.thumbnailUrl} alt="" />
      <div className="min-w-0 flex-1">
        <h2 className="font-serif text-lg leading-snug text-[#241a12] break-words">{row.title}</h2>
        {meta && <p className="mt-1 text-xs text-[#6b5847]">{meta}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={status} />
          {row.unreadCount > 0 && (
            <span className="rounded-full bg-[#3b2a1d] px-2 py-0.5 text-xs font-semibold text-[#fdfaf3]">
              {copy.newMessages(row.unreadCount)}
            </span>
          )}
          {urgent && (
            <span className="text-xs font-semibold uppercase tracking-wide text-[#8a2e1f]">
              {copy.actionRequired}
            </span>
          )}
        </div>
        <p className="mt-3 text-sm leading-6 text-[#4b3a2c]">{next.text}</p>
        {row.amountCents !== null && (
          <p className="mt-2 font-medium text-[#241a12]">
            {formatEuros(row.amountCents, locale)}
            {row.amountIncludesTax && (
              <span className="ml-1 text-xs font-normal text-[#6b5847]">
                {locale === "en-US" ? "incl. tax" : "TTC"}
              </span>
            )}
          </p>
        )}
      </div>
    </Link>
  );
}

/**
 * Attacher un projet présenté avant la création du compte.
 *
 * Le lien de suivi reçu par e-mail est la preuve de propriété ; le
 * rapprochement par adresse vérifiée, côté serveur, couvre le cas courant.
 * Replié : ce n'est pas ce que la plupart des clients viennent faire ici.
 * Aucun message du serveur n'est affiché — une phrase claire, ou rien.
 */
function ClaimProject({ copy }: { copy: CustomerCopy }) {
  const claim = useServerFn(claimMarketplaceCase);
  const queryClient = useQueryClient();
  const [link, setLink] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const attach = useMutation({
    mutationFn: () => claim({ data: { link } }),
    onSuccess: async (result) => {
      setLink("");
      setMessage(result.alreadyOwned ? copy.claimAlready : copy.claimDone);
      await queryClient.invalidateQueries({ queryKey: ["marketplace", "customer", "cases"] });
    },
    onError: () => setMessage(copy.claimError),
  });

  return (
    <details className="group rounded-2xl border border-[#3b2a1d]/15 bg-[#fdfaf3] p-5">
      <summary className="-my-2 flex min-h-11 cursor-pointer items-center text-sm font-medium text-[#3b2a1d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b2a1d]/60">
        {copy.claimSummary}
      </summary>
      <form
        className="mt-4"
        onSubmit={(event) => {
          event.preventDefault();
          setMessage(null);
          attach.mutate();
        }}
      >
        <Label htmlFor="claim-link" className="font-serif text-base text-[#241a12]">
          {copy.claimTitle}
        </Label>
        <p className="mt-1 text-sm text-[#6b5847]">{copy.claimBody}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Input
            id="claim-link"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://…/project-summary/…"
            className="h-11 min-w-0 flex-1"
          />
          <Button type="submit" className="h-11" disabled={attach.isPending || link.trim() === ""}>
            {attach.isPending ? copy.claimBusy : copy.claimButton}
          </Button>
        </div>
        {message && (
          <p role="status" className="mt-3 text-sm text-[#4b3a2c]">
            {message}
          </p>
        )}
      </form>
    </details>
  );
}

export function CustomerCaseListPage({ brand }: { brand: MarketplaceBrand | null }) {
  const locale = customerLocaleForBrand(brand);
  const copy = customerCopy(locale);
  const fetchCases = useServerFn(listMyCustomerCases);
  const { data, isPending, error, refetch, isFetching } = useQuery({
    queryKey: ["marketplace", "customer", "cases"] as const,
    queryFn: () => fetchCases(),
  });

  if (isPending) return <PortalListSkeleton label={copy.loading} />;
  if (error)
    return (
      <PortalError
        message={copy.loadError}
        retryLabel={copy.retry}
        onRetry={() => void refetch()}
        busy={isFetching}
      />
    );

  const rows = sortForCustomer((data ?? []) as CustomerListRow[]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-3xl text-[#241a12]">{copy.listTitle}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#4b3a2c]">{copy.listIntro}</p>
      </header>

      {rows.length === 0 ? (
        <PortalEmpty copy={copy} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {rows.map((row) => (
            <li key={row.id}>
              <ProjectCard row={row} locale={locale} copy={copy} />
            </li>
          ))}
        </ul>
      )}

      <ClaimProject copy={copy} />
    </div>
  );
}
