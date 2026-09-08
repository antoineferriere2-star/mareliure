/**
 * The dossier as a relieur reads it, plus the form to answer it.
 *
 * The Brief is the same `CaseBriefPanel` the admin sees; the difference is
 * upstream, in the disclosure the server granted — the customer's contact
 * details simply are not in the payload. Nothing here filters anything, which
 * is exactly why it cannot leak.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  declineBinderCase,
  getBinderCase,
  submitBinderQuote,
} from "@/marketplace/services/marketplace.data.functions";
import { CaseBriefPanel } from "@/marketplace/pages/CaseBriefPanel";
import { QUOTE_CAVEAT, validateQuote } from "@/marketplace/quotes/rules";
import { formatEuros } from "@/marketplace/orders/commission";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Euros in the form, integer cents on the wire. Never a float in the domain. */
function toCents(euros: string): number {
  return Math.round(Number.parseFloat(euros.replace(",", ".")) * 100);
}

export function BinderCasePage({ caseId }: { caseId: string }) {
  const fetchCase = useServerFn(getBinderCase);
  const sendQuote = useServerFn(submitBinderQuote);
  const decline = useServerFn(declineBinderCase);
  const queryClient = useQueryClient();
  const queryKey = ["marketplace", "binder", "case", caseId] as const;

  const { data, isPending, error } = useQuery({
    queryKey,
    queryFn: () => fetchCase({ data: { caseId } }),
  });

  const [description, setDescription] = useState("");
  const [technique, setTechnique] = useState("");
  const [materials, setMaterials] = useState("");
  const [amount, setAmount] = useState("");
  const [weeks, setWeeks] = useState("");
  const [caveats, setCaveats] = useState("");
  const [problems, setProblems] = useState<string[]>([]);

  const submit = useMutation({
    mutationFn: () =>
      sendQuote({
        data: {
          caseId,
          description,
          technique: technique || null,
          materials: materials || null,
          amountCents: toCents(amount),
          leadTimeWeeks: Number.parseInt(weeks, 10),
          caveats: caveats || null,
        },
      }),
    onSuccess: async () => {
      setProblems([]);
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ["marketplace", "binder", "cases"] });
    },
    onError: (err: Error) => setProblems([err.message]),
  });

  const refuse = useMutation({
    mutationFn: () => decline({ data: { caseId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.invalidateQueries({ queryKey: ["marketplace", "binder", "cases"] });
    },
  });

  if (isPending) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    // The same rules the server enforces, run here so the relieur is told
    // before the round trip rather than after it.
    const found = validateQuote({
      description,
      amountCents: Number.isNaN(toCents(amount)) ? 0 : toCents(amount),
      leadTimeWeeks: Number.parseInt(weeks, 10) || 0,
    });
    if (found.length > 0) {
      setProblems(found);
      return;
    }
    submit.mutate();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <CaseBriefPanel view={data.view} />

      <aside className="space-y-6">
        {data.myQuote ? (
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-serif text-lg">Votre proposition</h2>
            <p className="mt-2 text-2xl font-medium">
              {formatEuros(data.myQuote.amount_cents)}
              <span className="ml-2 text-base font-normal text-muted-foreground">
                · {data.myQuote.lead_time_weeks} semaines
              </span>
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {data.myQuote.description}
            </p>
            <p className="mt-4 text-xs text-muted-foreground">{QUOTE_CAVEAT}</p>
          </section>
        ) : data.canQuote.allowed ? (
          <form
            onSubmit={onSubmit}
            className="space-y-4 rounded-lg border border-border bg-card p-5"
          >
            <h2 className="font-serif text-lg">Proposer</h2>

            <div>
              <Label htmlFor="description">Description de l'intervention</Label>
              <Textarea
                id="description"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Demi-reliure en chèvre brun foncé, plats papier marbré, cinq nerfs et titrage or."
                className="mt-2"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="technique">Technique</Label>
                <Input
                  id="technique"
                  value={technique}
                  onChange={(e) => setTechnique(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="materials">Matériaux</Label>
                <Input
                  id="materials"
                  value={materials}
                  onChange={(e) => setMaterials(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="amount">Prix (€)</Label>
                <Input
                  id="amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="340"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="weeks">Délai (semaines)</Label>
                <Input
                  id="weeks"
                  inputMode="numeric"
                  value={weeks}
                  onChange={(e) => setWeeks(e.target.value)}
                  placeholder="7"
                  className="mt-2"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="caveats">Réserves</Label>
              <Textarea
                id="caveats"
                rows={2}
                value={caveats}
                onChange={(e) => setCaveats(e.target.value)}
                className="mt-2"
              />
              <p className="mt-2 text-xs text-muted-foreground">{QUOTE_CAVEAT}</p>
            </div>

            {problems.length > 0 && (
              <ul className="space-y-1 text-sm text-destructive">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}

            <div className="flex gap-3">
              <Button type="submit" disabled={submit.isPending}>
                {submit.isPending ? "Envoi…" : "Envoyer ma proposition"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={refuse.isPending}
                onClick={() => refuse.mutate()}
              >
                Décliner
              </Button>
            </div>
          </form>
        ) : (
          <section className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
            {data.canQuote.reason ?? "Ce dossier n'attend plus de proposition."}
          </section>
        )}
      </aside>
    </div>
  );
}
