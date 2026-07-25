import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generatePlaybookFromAI } from "@/build/services/onboarding.data.functions";
import type { PlaybookMatch } from "@/build/onboarding/matchPlaybook";

export function PlaybookMatchStep({
  businessType,
  product,
  match,
  onBack,
  onContinue,
}: {
  businessType: string;
  product: string;
  match: PlaybookMatch | null;
  onBack: () => void;
  onContinue: () => void;
}) {
  const queryClient = useQueryClient();
  const generateFn = useServerFn(generatePlaybookFromAI);

  const generateMutation = useMutation({
    mutationFn: () => generateFn({ data: { businessType, product } }),
  });

  function recheckMatch() {
    queryClient.invalidateQueries({ queryKey: ["build-admin", "playbooks", "publishable"] });
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Playbook associé</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Métier : <span className="font-medium text-foreground">{businessType}</span> · Produit :{" "}
          <span className="font-medium text-foreground">{product}</span>
        </p>
      </div>

      {match ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Playbook proposé</p>
          <p className="mt-1 text-lg font-semibold text-emerald-950">{match.playbook.name}</p>
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">Aucun Playbook publié ne correspond encore à ce métier.</p>

          {generateMutation.data ? (
            <div className="rounded-md border border-emerald-300 bg-white p-3 text-sm">
              <p className="font-medium text-emerald-900">Brouillon généré : {generateMutation.data.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Relis-le, ajuste-le et publie-le dans l'éditeur, puis reviens ici pour continuer.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  to="/build/playbooks/$id"
                  params={{ id: generateMutation.data.id }}
                  target="_blank"
                  className="rounded-md border border-emerald-400 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                >
                  Ouvrir dans l'éditeur
                </Link>
                <button
                  type="button"
                  onClick={recheckMatch}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-xs hover:bg-accent"
                >
                  Revérifier la correspondance
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
            >
              {generateMutation.isPending ? "Génération en cours…" : "Générer un Playbook avec l'IA (brouillon)"}
            </button>
          )}

          {generateMutation.isError && (
            <p className="text-xs text-destructive">
              {generateMutation.error instanceof Error ? generateMutation.error.message : "La génération a échoué."}
            </p>
          )}

          <p className="text-xs text-amber-800">
            Ou publie toi-même un Playbook avec un <span className="font-mono">project_type</span> adapté (
            <Link to="/build/playbooks" className="underline">
              gérer les Playbooks
            </Link>
            ).
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
        >
          Retour
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={!match}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Continuer
        </button>
      </div>
    </div>
  );
}
