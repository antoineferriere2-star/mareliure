/**
 * « Ajouter une prestation » : la recherche dans le référentiel Ma Reliure, des résultats compacts, et la
 * prestation personnalisée. Jamais 195 lignes : rien ne s'affiche avant que le relieur cherche (sauf, pour un
 * atelier vide, dix suggestions facultatives — des noms, jamais un prix).
 *
 * Le référentiel est chargé À LA DEMANDE (import dynamique) : il ne pèse rien tant que cet écran n'est pas ouvert.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { loadReference, CURRENT_REFERENCE_VERSION } from "@/marketplace/reference";
import { referencePath, suggestedName } from "@/marketplace/reference/presentation";
import { buildSearchIndex, searchReference } from "@/marketplace/reference/search";
import { STARTER_SUGGESTION_KEYS } from "@/marketplace/reference/starterSuggestions";
import type { ReferenceManifest, ReferenceOperation } from "@/marketplace/reference/types";
import { CARD, ErrorNote, FIELD, SECONDARY_BUTTON } from "../quoteUi";
import { REFERENCE_KEY, type Service } from "./catalogTypes";
import { ServiceForm, type ServiceFormTarget } from "./ServiceForm";

const PAGE = 8;

const referenceTarget = (operation: ReferenceOperation, manifest: ReferenceManifest): ServiceFormTarget => ({
  kind: "reference",
  version: manifest.version,
  key: operation.key,
  suggestedName: suggestedName(operation),
  unitCandidates: operation.unitCandidates,
  pricingModes: operation.pricingModes,
});

export function AddServicePanel({
  services,
  firstTime,
  notice,
  onAdded,
}: {
  services: Service[];
  /** Un atelier sans aucune prestation : « Ajouter mes premières prestations » + suggestions. */
  firstTime: boolean;
  notice: string | null;
  onAdded: (service: Service) => void;
}) {
  const reference = useQuery({
    queryKey: [...REFERENCE_KEY, CURRENT_REFERENCE_VERSION],
    queryFn: () => loadReference(CURRENT_REFERENCE_VERSION),
    staleTime: Infinity,
  });
  const index = useMemo(() => (reference.data ? buildSearchIndex(reference.data.operations, reference.data.manifest.domains) : null), [reference.data]);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null); // clé d'opération ouverte, ou "custom"

  const hits = index && query.trim() ? searchReference(index, query) : [];
  const alreadyIn = (key: string) => services.filter((s) => s.referenceOperationKey === key).length;
  const searching = query.trim().length > 0;
  const suggestions =
    firstTime && !searching && reference.data
      ? STARTER_SUGGESTION_KEYS.map((key) => reference.data!.operations.find((o) => o.key === key)).filter((o): o is ReferenceOperation => Boolean(o))
      : [];

  const close = () => setOpen(null);
  const saved = (service: Service) => {
    close();
    setQuery("");
    setShown(PAGE);
    onAdded(service);
  };

  const row = (operation: ReferenceOperation) => {
    const manifest = reference.data!.manifest;
    const count = alreadyIn(operation.key);
    return (
      <li key={operation.key} className="rounded-md border border-border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium">{suggestedName(operation)}</p>
            <p className="text-xs text-muted-foreground">{referencePath(operation, manifest)}</p>
            {operation.customerName && <p className="text-xs text-muted-foreground">Nom technique : {operation.canonicalName}</p>}
            {count > 0 && <p className="text-xs text-emerald-700">Déjà dans mes prestations{count > 1 ? ` (${count})` : ""}</p>}
          </div>
          <button
            type="button"
            className={SECONDARY_BUTTON}
            aria-expanded={open === operation.key}
            aria-label={`Ajouter « ${suggestedName(operation)} » à mes prestations`}
            onClick={() => setOpen(open === operation.key ? null : operation.key)}
          >
            Ajouter à mes prestations
          </button>
        </div>
        {open === operation.key && <ServiceForm target={referenceTarget(operation, manifest)} onCancel={close} onSaved={saved} />}
      </li>
    );
  };

  return (
    <section id="add-service" aria-labelledby="add-service-title" className={`${CARD} space-y-4`}>
      <div>
        <h3 id="add-service-title" className="font-serif text-lg">{firstTime ? "Ajouter mes premières prestations" : "Ajouter une prestation"}</h3>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {firstTime
            ? "Vous pouvez commencer avec zéro prestation : ajoutez-en quand vous en avez besoin. Le référentiel Ma Reliure décrit le métier ; vos noms, vos unités et vos prix restent les vôtres, et rien n'est prérempli."
            : "Cherchez dans le référentiel Ma Reliure, ou créez la vôtre. Vos noms, vos unités et vos prix restent les vôtres : aucun prix n'est proposé."}
        </p>
      </div>

      {notice && (
        <p role="status" className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {notice}
        </p>
      )}

      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          aria-label="Chercher dans le référentiel Ma Reliure"
          placeholder="Chercher : nerf, coiffe, titre, boîte…"
          className={`${FIELD} pl-9`}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setShown(PAGE);
            close();
          }}
        />
      </div>

      {reference.isPending && <p role="status" className="text-sm text-muted-foreground">Chargement du référentiel…</p>}
      {reference.isError && <ErrorNote>Le référentiel n'a pas pu être chargé. Rechargez la page ; vous pouvez déjà créer une prestation personnalisée.</ErrorNote>}

      {suggestions.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Suggestions (facultatives)</h4>
          <ul className="grid gap-2 sm:grid-cols-2">{suggestions.map(row)}</ul>
        </div>
      )}

      {searching && reference.data && (
        <div aria-live="polite">
          {hits.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune opération du référentiel ne correspond à « {query.trim()} ». Vous pouvez créer une prestation personnalisée.</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-muted-foreground">{hits.length} résultat{hits.length > 1 ? "s" : ""} dans le référentiel Ma Reliure</p>
              <ul className="space-y-2">{hits.slice(0, shown).map((hit) => row(hit.operation))}</ul>
              {hits.length > shown && (
                <button type="button" className={`${SECONDARY_BUTTON} mt-2`} onClick={() => setShown((n) => n + PAGE)}>
                  Voir {Math.min(PAGE, hits.length - shown)} résultat{hits.length - shown > 1 ? "s" : ""} de plus
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div className="border-t border-dashed border-border pt-4">
        <button type="button" className={SECONDARY_BUTTON} aria-expanded={open === "custom"} onClick={() => setOpen(open === "custom" ? null : "custom")}>
          Créer une prestation personnalisée
        </button>
        {open === "custom" && <ServiceForm target={{ kind: "custom" }} onCancel={close} onSaved={saved} />}
      </div>
    </section>
  );
}
