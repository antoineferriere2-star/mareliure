/**
 * « Avant votre premier devis » : les DEUX informations sans lesquelles un devis
 * ne peut pas être émis — le nom de l'atelier et le régime de TVA. Elles se
 * renseignent ici, dans le constructeur, sans changer de page : le relieur n'est
 * jamais renvoyé vers un écran d'administration pour chiffrer un livre.
 *
 * Ma Reliure ne choisit pas le régime à la place de l'atelier (aucune valeur par
 * défaut) ; la mention de franchise n'est qu'une suggestion modifiable.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { saveMyBillingProfile } from "@/marketplace/services/binderQuotes.data.functions";
import { FRANCHISE_MENTION_SUGGESTION, type BillingProfile } from "@/marketplace/quotes/quoteBuild";
import { CARD, ErrorNote, FIELD, Field, PRIMARY_BUTTON } from "./quoteUi";
import { PROFILE_QUERY_KEY, profileToInput } from "./quoteQueryKeys";

export function ProfileQuickSetup({ profile, missing }: { profile: BillingProfile; missing: string[] }) {
  const save = useServerFn(saveMyBillingProfile);
  const queryClient = useQueryClient();
  const [name, setName] = useState(profile.workshopName ?? profile.legalName ?? "");
  const [regime, setRegime] = useState<"FRANCHISE" | "VAT_LIABLE" | "EXEMPT" | null>(profile.vatRegime);
  const [mention, setMention] = useState(profile.vatMention ?? "");

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          ...profileToInput(profile),
          workshopName: name.trim() || null,
          vatRegime: regime,
          vatMention: regime === "FRANCHISE" ? mention.trim() || FRANCHISE_MENTION_SUGGESTION : profile.vatMention,
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY }),
  });

  const valid = name.trim().length > 0 && regime !== null;

  return (
    <section aria-labelledby="quick-setup-title" className={`${CARD} border-amber-300 bg-amber-50/60`}>
      <h2 id="quick-setup-title" className="font-serif text-lg">
        Avant votre premier devis
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Deux informations, une seule fois{missing.length > 0 ? ` (à renseigner : ${missing.join(", ")})` : ""}. Le reste
        de votre identité se complète plus tard, dans{" "}
        <Link to="/atelier/tarifs" className="underline">
          Devis et tarifs
        </Link>
        .
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Nom de l'atelier" htmlFor="setup-name">
          <input id="setup-name" className={FIELD} value={name} onChange={(e) => setName(e.target.value)} autoComplete="organization" />
        </Field>
        <fieldset>
          <legend className="mb-1 block text-xs font-medium text-muted-foreground">Régime de TVA</legend>
          <div className="grid gap-2">
            {(
              [
                ["VAT_LIABLE", "Je facture la TVA"],
                ["FRANCHISE", "Franchise en base de TVA (aucune TVA facturée)"],
                ["EXEMPT", "Exonération ou autre régime sans TVA"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm">
                <input type="radio" name="vat-regime" checked={regime === value} onChange={() => setRegime(value)} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      {regime === "FRANCHISE" && (
        <div className="mt-4">
          <Field label="Mention imprimée sur vos documents" htmlFor="setup-mention" hint="Suggestion de départ : modifiez-la ou faites-la valider par votre comptable.">
            <input
              id="setup-mention"
              className={FIELD}
              value={mention}
              placeholder={FRANCHISE_MENTION_SUGGESTION}
              onChange={(e) => setMention(e.target.value)}
            />
          </Field>
        </div>
      )}
      {mutation.isError && <div className="mt-3"><ErrorNote>Impossible d'enregistrer. Réessayez.</ErrorNote></div>}
      <div className="mt-4">
        <button type="button" className={PRIMARY_BUTTON} disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? "Enregistrement…" : "Enregistrer et continuer"}
        </button>
      </div>
    </section>
  );
}
