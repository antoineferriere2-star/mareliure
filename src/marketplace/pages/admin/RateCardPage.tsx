/**
 * L'écran de la session tarifaire : un relieur en face de soi, sa grille à
 * remplir en vingt minutes.
 *
 * Tout est plié à cette contrainte de temps. Les travaux sont groupés par
 * famille et repliés : on ouvre « Reliure cuir », on saisit quatre lignes, on
 * referme. Trois montants par ligne — minimum, courant, maximum — parce que
 * c'est ainsi qu'un artisan parle : « entre 320 et 420, disons 370 ». Rien
 * n'est obligatoire : une grille à moitié remplie est une grille utile, et
 * demander la perfection ferait abandonner la session.
 *
 * La case « tarif entendu du relieur » est la seule chose qui compte
 * vraiment : elle fait passer la ligne en `REAL_VERIFIED`, donc la rend
 * comptable dans une médiane. Elle n'est jamais cochée d'avance.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getBinderRateCard,
  removeBinderRate,
  saveBinderRate,
} from "@/marketplace/services/pricing.data.functions";
import {
  COMPLEXITY_CLASS_LABELS,
  SIZE_CLASS_LABELS,
  WORK_FAMILIES,
  WORK_ITEMS,
  type ComplexityClass,
  type SizeClass,
} from "@/marketplace/pricing/catalog";
import { RATE_SOURCE_LABELS, type RateSource } from "@/marketplace/pricing/provenance";
import { formatEuros } from "@/marketplace/pricing/money";
import type { BinderRate } from "@/marketplace/pricing/rateCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function toCents(euros: string): number | null {
  const value = Number.parseFloat(euros.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
}

interface Draft {
  minimum: string;
  typical: string;
  maximum: string;
  hours: string;
}

const EMPTY: Draft = { minimum: "", typical: "", maximum: "", hours: "" };

function WorkRow({
  workItemKey,
  label,
  hint,
  existing,
  sizeClass,
  complexityClass,
  source,
  binderId,
  onSaved,
}: {
  workItemKey: string;
  label: string;
  hint?: string;
  existing: BinderRate | undefined;
  sizeClass: SizeClass;
  complexityClass: ComplexityClass;
  source: RateSource;
  binderId: string;
  onSaved: () => Promise<unknown>;
}) {
  const save = useServerFn(saveBinderRate);
  const remove = useServerFn(removeBinderRate);
  const [draft, setDraft] = useState<Draft>(
    existing
      ? {
          minimum: String(existing.minimumPayoutCents / 100),
          typical: String(existing.typicalPayoutCents / 100),
          maximum: String(existing.maximumPayoutCents / 100),
          hours: existing.estimatedHours ? String(existing.estimatedHours) : "",
        }
      : EMPTY,
  );
  const [verified, setVerified] = useState(existing?.provenance === "REAL_VERIFIED");
  const [problem, setProblem] = useState<string | null>(null);

  const minimum = toCents(draft.minimum);
  const typical = toCents(draft.typical);
  const maximum = toCents(draft.maximum);
  // Le courant suffit : on complète avec lui-même plutôt que d'exiger trois
  // saisies là où l'artisan n'a qu'un chiffre en tête.
  const ready = typical !== null;

  const saving = useMutation({
    mutationFn: () =>
      save({
        data: {
          binderId,
          workItemKey,
          minimumPayoutCents: minimum ?? typical!,
          typicalPayoutCents: typical!,
          maximumPayoutCents: maximum ?? typical!,
          estimatedHours: Number.parseFloat(draft.hours.replace(",", ".")) || null,
          sizeClass,
          complexityClass,
          notes: null,
          source,
          verified,
        },
      }),
    onSuccess: async () => {
      setProblem(null);
      await onSaved();
    },
    onError: (err: Error) => setProblem(err.message),
  });

  const removal = useMutation({
    mutationFn: () => remove({ data: { rateId: existing!.id } }),
    onSuccess: async () => {
      setDraft(EMPTY);
      setVerified(false);
      await onSaved();
    },
  });

  const field = (key: keyof Draft, placeholder: string) => (
    <Input
      className="h-9"
      inputMode="decimal"
      placeholder={placeholder}
      value={draft[key]}
      onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
    />
  );

  return (
    <tr className="border-b border-border/60">
      <td className="py-2 pr-3 align-middle">
        <span className="text-sm">{label}</span>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </td>
      <td className="w-24 py-2 pr-2">{field("minimum", "min")}</td>
      <td className="w-24 py-2 pr-2">{field("typical", "courant")}</td>
      <td className="w-24 py-2 pr-2">{field("maximum", "max")}</td>
      <td className="w-20 py-2 pr-2">{field("hours", "h")}</td>
      <td className="w-28 py-2 pr-2 text-center">
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={verified}
            onChange={(event) => setVerified(event.target.checked)}
          />
          entendu
        </label>
      </td>
      <td className="w-32 py-2 text-right">
        <Button
          size="sm"
          variant={existing ? "outline" : "default"}
          disabled={!ready || saving.isPending}
          onClick={() => saving.mutate()}
        >
          {existing ? "Mettre à jour" : "Enregistrer"}
        </Button>
        {existing && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-1 text-muted-foreground"
            disabled={removal.isPending}
            onClick={() => removal.mutate()}
          >
            ×
          </Button>
        )}
        {problem && <p className="mt-1 text-xs text-destructive">{problem}</p>}
      </td>
    </tr>
  );
}

export function RateCardPage({ binderId }: { binderId: string }) {
  const fetchCard = useServerFn(getBinderRateCard);
  const queryClient = useQueryClient();
  const queryKey = ["marketplace", "rates", binderId] as const;
  const { data, isPending, error } = useQuery({
    queryKey,
    queryFn: () => fetchCard({ data: { binderId } }),
  });

  const [sizeClass, setSizeClass] = useState<SizeClass>("standard");
  const [complexityClass, setComplexityClass] = useState<ComplexityClass>("standard");
  const [source, setSource] = useState<RateSource>("binder_interview");
  const [openFamily, setOpenFamily] = useState<string | null>(WORK_FAMILIES[0].key);

  const byKey = useMemo(() => {
    const map = new Map<string, BinderRate>();
    for (const rate of data?.rates ?? []) {
      if (rate.sizeClass === sizeClass && rate.complexityClass === complexityClass)
        map.set(rate.workItemKey, rate);
    }
    return map;
  }, [data, sizeClass, complexityClass]);

  if (isPending) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const filled = (data.rates ?? []).length;
  const verifiedCount = (data.rates ?? []).filter((r) => r.provenance === "REAL_VERIFIED").length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-2xl">
          {data.binder.workshop_name ?? data.binder.display_name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.binder.city ? `${data.binder.city} · ` : ""}
          {filled} ligne(s) saisie(s), dont {verifiedCount} entendue(s) du relieur.
        </p>
      </header>

      {/* Format et complexité s'appliquent à toute la saisie : on remplit une
          grille « format courant » d'un bout à l'autre, puis on repasse en
          grand format si l'atelier distingue les deux. Demander la classe
          ligne par ligne doublerait le temps de la session. */}
      <section className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4">
        <div>
          <Label htmlFor="size-class">Format</Label>
          <select
            id="size-class"
            className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={sizeClass}
            onChange={(event) => setSizeClass(event.target.value as SizeClass)}
          >
            {Object.entries(SIZE_CLASS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="complexity-class">Complexité</Label>
          <select
            id="complexity-class"
            className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={complexityClass}
            onChange={(event) => setComplexityClass(event.target.value as ComplexityClass)}
          >
            {Object.entries(COMPLEXITY_CLASS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="rate-source">Origine</Label>
          <select
            id="rate-source"
            className="mt-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={source}
            onChange={(event) => setSource(event.target.value as RateSource)}
          >
            {Object.entries(RATE_SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <p className="ml-auto max-w-sm text-xs leading-5 text-muted-foreground">
          Cochez <strong>entendu</strong> quand le montant vient du relieur lui-même. C’est ce qui
          le rend comptable dans une médiane.
        </p>
      </section>

      {WORK_FAMILIES.map((family) => {
        const items = WORK_ITEMS.filter((item) => item.family === family.key);
        const done = items.filter((item) => byKey.has(item.key)).length;
        const open = openFamily === family.key;
        return (
          <section key={family.key} className="rounded-lg border border-border bg-card">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left"
              onClick={() => setOpenFamily(open ? null : family.key)}
            >
              <span className="font-medium">{family.label}</span>
              <span className="text-xs text-muted-foreground">
                {done} / {items.length}
              </span>
            </button>
            {open && (
              <div className="overflow-x-auto border-t border-border px-4 pb-4">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 font-medium">Travail</th>
                      <th className="py-2 font-medium">Min €</th>
                      <th className="py-2 font-medium">Courant €</th>
                      <th className="py-2 font-medium">Max €</th>
                      <th className="py-2 font-medium">Heures</th>
                      <th className="py-2 text-center font-medium">Source</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <WorkRow
                        key={`${item.key}-${sizeClass}-${complexityClass}`}
                        workItemKey={item.key}
                        label={item.label}
                        hint={item.hint}
                        existing={byKey.get(item.key)}
                        sizeClass={sizeClass}
                        complexityClass={complexityClass}
                        source={source}
                        binderId={binderId}
                        onSaved={refresh}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      {filled > 0 && (
        <section className="rounded-lg border border-border bg-muted/40 p-4">
          <h2 className="text-sm font-medium">Grille enregistrée</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {(data.rates ?? []).map((rate) => (
              <li key={rate.id}>
                {rate.workItemKey} · {SIZE_CLASS_LABELS[rate.sizeClass]} ·{" "}
                {formatEuros(rate.typicalPayoutCents)}
                {rate.provenance === "REAL_VERIFIED" ? " · entendu" : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
