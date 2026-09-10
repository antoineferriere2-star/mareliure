/**
 * « Mes livres » — ce qui se passe maintenant, livre par livre.
 *
 * L'ordre répond à la seule question qui compte : « qu'est-ce que je dois
 * faire ? ». Une réponse attendue passe avant tout, écrite en clair — pas un
 * badge « notification ». Puis ce qui est en cours, ce qui est à l'étude, et
 * les livres terminés, qui forment peu à peu la bibliothèque du client.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  claimMarketplaceCase,
  listMyCustomerCases,
} from "@/marketplace/services/marketplace.data.functions";
import { formatEuros } from "@/marketplace/pricing/money";
import { formatWhen } from "../project/projectFormat";

type BookRow = Awaited<ReturnType<typeof listMyCustomerCases>>[number];

const GROUPS = [
  { key: "action", title: "À faire", intro: "Votre réponse permet à l'atelier de poursuivre." },
  { key: "in_progress", title: "En cours", intro: null },
  { key: "study", title: "En étude", intro: null },
  {
    key: "done",
    title: "Terminés",
    intro:
      "Votre bibliothèque Ma Reliure : chaque livre garde son dossier, ses photos et vos choix.",
  },
] as const;

export function MyBooksPage() {
  const fetchBooks = useServerFn(listMyCustomerCases);
  const { data, isPending, error } = useQuery({
    queryKey: ["marketplace", "customer", "cases"] as const,
    queryFn: () => fetchBooks(),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  if (isPending) return <p className="mr-small text-mr-muted">Chargement…</p>;
  if (error) return <p className="mr-small text-mr-bordeaux">{(error as Error).message}</p>;

  const books = data ?? [];
  const actions = books.filter((book) => book.group === "action").length;
  const unread = books.reduce((sum, book) => sum + book.unread, 0);

  return (
    <div className="space-y-12">
      <header className="border-b border-mr-rule pb-6">
        <h1 className="mr-title text-mr-ink">Mes livres</h1>
        {books.length > 0 && (
          <p className="mr-small mt-2 text-mr-graphite">
            {[
              `${books.length} livre${books.length > 1 ? "s" : ""}`,
              actions > 0
                ? `${actions} réponse${actions > 1 ? "s" : ""} attendue${actions > 1 ? "s" : ""}`
                : null,
              unread > 0
                ? `${unread} message${unread > 1 ? "s" : ""} non lu${unread > 1 ? "s" : ""}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </header>

      {books.length === 0 && (
        <p className="mr-body text-mr-graphite">
          Aucun livre rattaché à ce compte pour l'instant. Si vous avez présenté un livre avant de
          créer votre compte, rattachez-le ci-dessous avec le lien reçu par e-mail.
        </p>
      )}

      {GROUPS.map((group) => {
        const rows = books.filter((book) => book.group === group.key);
        if (rows.length === 0) return null;
        return (
          <section key={group.key} aria-labelledby={`group-${group.key}`}>
            <h2 id={`group-${group.key}`} className="mr-eyebrow text-mr-ink">
              {group.title}
            </h2>
            {group.intro && <p className="mr-small mt-1 text-mr-muted">{group.intro}</p>}
            <ul className="mt-4 divide-y divide-mr-rule border-y border-mr-rule">
              {rows.map((row) => (
                <BookCard key={row.id} row={row} />
              ))}
            </ul>
          </section>
        );
      })}

      <ClaimProject />
    </div>
  );
}

function BookCard({ row }: { row: BookRow }) {
  const price = row.customerPriceTtcCents ?? row.customerPriceCents;
  return (
    <li className="grid grid-cols-[5.5rem_1fr] gap-4 py-5 sm:grid-cols-[7rem_1fr] sm:gap-6">
      <Link
        to="/mes-livres/$caseId"
        params={{ caseId: row.id }}
        className="block"
        tabIndex={-1}
        aria-hidden="true"
      >
        {row.photoUrl ? (
          <img
            src={row.photoUrl}
            alt=""
            loading="lazy"
            className="aspect-[3/4] w-full rounded-[2px] border border-mr-rule object-cover"
          />
        ) : (
          <div className="aspect-[3/4] w-full rounded-[2px] border border-mr-rule bg-mr-paper-deep" />
        )}
      </Link>
      <div className="min-w-0">
        <p className="mr-meta">{row.reference}</p>
        <h3 className="mr-heading text-mr-ink">
          <Link
            to="/mes-livres/$caseId"
            params={{ caseId: row.id }}
            className="underline-offset-4 hover:underline"
          >
            {row.title}
          </Link>
        </h3>
        {row.work && <p className="mr-small mt-0.5 text-mr-graphite">{row.work}</p>}
        {row.binder && (
          <p className="mr-small text-mr-graphite">
            {row.binder.name}
            {row.binder.city ? ` · ${row.binder.city}` : ""}
          </p>
        )}

        <p className="mr-body mt-3 font-semibold text-mr-ink">{row.statusText.headline}</p>
        <p className="mr-small text-mr-graphite">{row.statusText.detail}</p>

        <p className="mr-meta mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {row.lastActivityAt && <span>Dernière nouvelle : {formatWhen(row.lastActivityAt)}</span>}
          {row.unread > 0 && (
            <span className="text-mr-bordeaux">
              ● {row.unread === 1 ? "1 message non lu" : `${row.unread} nouveaux messages`}
            </span>
          )}
          {price !== null && (
            <span>
              {formatEuros(price)}
              {row.customerPriceTtcCents !== null ? " TTC" : ""}
            </span>
          )}
        </p>

        {row.action ? (
          <div className="mt-4 border-l-2 border-mr-bordeaux bg-white px-4 py-3">
            <p className="mr-eyebrow text-mr-bordeaux">{row.action.title}</p>
            <p className="mr-small mt-1 text-mr-ink">{row.action.detail}</p>
            <Link
              to="/mes-livres/$caseId"
              params={{ caseId: row.id }}
              hash="decisions"
              className="mr-tap mt-3 inline-block rounded-[2px] bg-mr-ink px-5 py-2.5 text-[0.9375rem] font-semibold text-mr-paper hover:bg-mr-walnut"
            >
              {row.action.cta}
            </Link>
          </div>
        ) : (
          <Link
            to="/mes-livres/$caseId"
            params={{ caseId: row.id }}
            className="mr-link mr-small mt-3 inline-block"
          >
            Voir mon livre
          </Link>
        )}
      </div>
    </li>
  );
}

/**
 * Rattacher un livre présenté avant la création du compte. Le lien de suivi
 * reçu par e-mail est la preuve de propriété ; le rapprochement par e-mail
 * vérifié, côté serveur, couvre le cas courant.
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
          ? "Ce livre était déjà rattaché à votre compte."
          : "Livre rattaché à votre compte.",
      );
      await queryClient.invalidateQueries({ queryKey: ["marketplace", "customer", "cases"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  return (
    <details className="border-t border-mr-rule pt-6">
      <summary className="mr-small cursor-pointer text-mr-graphite">
        Rattacher un livre présenté avant la création de votre compte
      </summary>
      <form
        className="mt-4 max-w-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          setMessage(null);
          attach.mutate();
        }}
      >
        <label htmlFor="claim-link" className="mr-small block text-mr-ink">
          Lien de suivi reçu par e-mail
        </label>
        <div className="mt-2 flex flex-wrap gap-3">
          <input
            id="claim-link"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://…/project-summary/…"
            className="mr-small min-w-0 flex-1 rounded-[2px] border border-mr-rule-strong bg-white px-3 py-2.5"
          />
          <button
            type="submit"
            disabled={attach.isPending || link.trim() === ""}
            className="mr-tap rounded-[2px] border border-mr-ink px-5 py-2.5 text-[0.9375rem] font-semibold text-mr-ink disabled:opacity-40"
          >
            {attach.isPending ? "Rattachement…" : "Rattacher"}
          </button>
        </div>
        {message && <p className="mr-small mt-3 text-mr-ink">{message}</p>}
      </form>
    </details>
  );
}
