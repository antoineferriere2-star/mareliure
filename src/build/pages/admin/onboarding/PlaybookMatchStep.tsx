import { Link } from "@tanstack/react-router";
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
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            Aucun Playbook publié ne correspond encore à ce métier. Publie d'abord un Playbook avec un{" "}
            <span className="font-mono">project_type</span> adapté (
            <Link to="/build/playbooks" className="underline">
              gérer les Playbooks
            </Link>
            ) avant de poursuivre cet onboarding.
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
