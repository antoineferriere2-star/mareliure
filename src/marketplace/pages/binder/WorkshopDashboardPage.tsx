/**
 * « Mon atelier » : qu'est-ce que je dois faire aujourd'hui ?
 *
 * Dense, tabulaire, bureau d'abord. En tête, une ligne de comptes — projets en
 * cours, réponses du client, messages, livres à confirmer reçus —, puis ce qui
 * demande un geste, puis le reste. Une offre close ne garde que sa trace : le
 * serveur ne renvoie plus ni résumé ni photos.
 */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyBinderCases } from "@/marketplace/services/marketplace.data.functions";
import { offerStateLabel } from "@/marketplace/cases/state";
import { formatEuros } from "@/marketplace/pricing/money";
import { formatWhen } from "../project/projectFormat";

type WorkshopRow = Awaited<ReturnType<typeof listMyBinderCases>>[number];

const HANDS_ON = new Set(["Confirmer la réception du livre", "Commencer le travail"]);

export function WorkshopDashboardPage() {
  const fetchCases = useServerFn(listMyBinderCases);
  const { data, isPending, error } = useQuery({
    queryKey: ["marketplace", "binder", "cases"] as const,
    queryFn: () => fetchCases(),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  if (isPending) return <p className="mr-small text-mr-muted">Chargement…</p>;
  if (error) return <p className="mr-small text-mr-bordeaux">{(error as Error).message}</p>;

  const rows = data ?? [];
  const byGroup = (group: WorkshopRow["group"]) => rows.filter((row) => row.group === group);
  const active = rows.filter(
    (row) => row.group === "in_progress" || row.group === "waiting_customer",
  );
  const unread = rows.reduce((sum, row) => sum + row.unread, 0);
  const answers = rows.reduce((sum, row) => sum + row.answeredSinceRead, 0);
  const toReceive = rows.filter(
    (row) => row.nextAction === "Confirmer la réception du livre",
  ).length;
  const today = rows.filter(
    (row) =>
      row.state === "selected" &&
      (HANDS_ON.has(row.nextAction ?? "") || row.unread > 0 || row.answeredSinceRead > 0),
  );

  const counts = [
    `${active.length} projet${active.length > 1 ? "s" : ""} en cours`,
    byGroup("waiting_customer").length > 0
      ? `${byGroup("waiting_customer").length} en attente du client`
      : null,
    answers > 0 ? `${answers} réponse${answers > 1 ? "s" : ""} du client` : null,
    unread > 0 ? `${unread} nouveau${unread > 1 ? "x" : ""} message${unread > 1 ? "s" : ""}` : null,
    toReceive > 0
      ? `${toReceive} livre${toReceive > 1 ? "s" : ""} à confirmer reçu${toReceive > 1 ? "s" : ""}`
      : null,
    byGroup("proposals").length > 0
      ? `${byGroup("proposals").length} proposition${byGroup("proposals").length > 1 ? "s" : ""}`
      : null,
  ].filter(Boolean);

  return (
    <div className="space-y-10">
      <header className="border-b border-mr-rule pb-4">
        <h1 className="mr-title text-mr-ink">Mon atelier</h1>
        <p className="mr-small mt-1 text-mr-graphite">{counts.join(" · ")}</p>
      </header>

      {rows.length === 0 && (
        <p className="mr-body text-mr-graphite">
          Aucun projet pour le moment. Vous recevrez une proposition dès qu'un livre correspondra à
          votre atelier.
        </p>
      )}

      <Group
        title="À faire aujourd'hui"
        rows={today}
        variant="work"
        empty={rows.length > 0 ? "Rien d'urgent." : null}
      />
      <Group
        title="Propositions — à accepter ou refuser"
        rows={byGroup("proposals")}
        variant="proposal"
      />
      <Group title="En cours" rows={byGroup("in_progress")} variant="work" />
      <Group title="Attente client" rows={byGroup("waiting_customer")} variant="work" />
      <Group title="Terminés" rows={byGroup("done")} variant="work" />
      {byGroup("closed").length > 0 && (
        <details>
          <summary className="mr-eyebrow cursor-pointer text-mr-graphite">
            Offres closes ({byGroup("closed").length})
          </summary>
          <div className="mt-3">
            <WorkshopTable rows={byGroup("closed")} variant="closed" />
          </div>
        </details>
      )}
    </div>
  );
}

function Group({
  title,
  rows,
  variant,
  empty = null,
}: {
  title: string;
  rows: WorkshopRow[];
  variant: "work" | "proposal";
  empty?: string | null;
}) {
  if (rows.length === 0 && !empty) return null;
  return (
    <section>
      <h2 className="mr-eyebrow text-mr-ink">{title}</h2>
      <div className="mt-3">
        {rows.length === 0 ? (
          <p className="mr-small text-mr-muted">{empty}</p>
        ) : (
          <WorkshopTable rows={rows} variant={variant} />
        )}
      </div>
    </section>
  );
}

function WorkshopTable({
  rows,
  variant,
}: {
  rows: WorkshopRow[];
  variant: "work" | "proposal" | "closed";
}) {
  return (
    <div className="overflow-x-auto border-y border-mr-rule">
      <table className="w-full min-w-[760px] text-left text-[0.875rem]">
        <thead className="mr-meta">
          <tr>
            <th className="py-2 pr-3 font-normal">Projet</th>
            <th className="py-2 pr-3 font-normal">
              {variant === "proposal" ? "Projet proposé" : "Travail"}
            </th>
            <th className="py-2 pr-3 text-right font-normal">Rémunération</th>
            <th className="py-2 pr-3 font-normal">Où en est-on</th>
            <th className="py-2 font-normal">Échanges</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.caseId} className="border-t border-mr-rule align-top">
              <td className="py-2.5 pr-3">
                <span className="mr-meta block">{row.reference}</span>
                {variant === "closed" ? (
                  <span className="text-mr-graphite">{row.title}</span>
                ) : (
                  <Link
                    to="/atelier/cases/$caseId"
                    params={{ caseId: row.caseId }}
                    className="font-semibold text-mr-ink underline-offset-4 hover:underline"
                  >
                    {row.title}
                  </Link>
                )}
              </td>
              <td className="max-w-[22rem] py-2.5 pr-3 text-mr-graphite">
                {variant === "proposal" ? (
                  <>
                    <span className="line-clamp-2">{row.summary}</span>
                    <span className="mr-meta">{row.photoCount} photo(s)</span>
                  </>
                ) : (
                  row.work || "—"
                )}
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-mr-ink">
                {row.binderPayoutCents ? formatEuros(row.binderPayoutCents) : "—"}
              </td>
              <td className="py-2.5 pr-3 text-mr-ink">
                {row.state === "selected" ? row.nextAction : offerStateLabel(row.state)}
              </td>
              <td className="py-2.5 text-mr-graphite">
                {row.unread > 0 && (
                  <span className="block text-mr-bordeaux">
                    ● {row.unread} message{row.unread > 1 ? "s" : ""}
                  </span>
                )}
                {row.answeredSinceRead > 0 && (
                  <span className="block text-mr-ink">
                    {row.answeredSinceRead} réponse{row.answeredSinceRead > 1 ? "s" : ""} du client
                  </span>
                )}
                {row.openDecisions > 0 && (
                  <span className="block">
                    {row.openDecisions} question{row.openDecisions > 1 ? "s" : ""} en attente
                  </span>
                )}
                {row.lastActivityAt && (
                  <span className="mr-meta block">{formatWhen(row.lastActivityAt)}</span>
                )}
                {row.unread === 0 &&
                  row.answeredSinceRead === 0 &&
                  row.openDecisions === 0 &&
                  !row.lastActivityAt &&
                  "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
