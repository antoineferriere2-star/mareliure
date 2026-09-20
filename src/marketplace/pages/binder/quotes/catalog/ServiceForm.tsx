/**
 * Le mini-formulaire d'une prestation : nom, unité, prix, favori. Deux usages — « Ajouter à mes
 * prestations » (depuis le référentiel) et « Prestation personnalisée » (aucune référence). Le relieur
 * reste propriétaire de tout : le nom proposé est modifiable, l'unité s'ouvre sur « Autre », et le
 * PRIX PART VIDE — jamais prérempli depuis une source publique.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { addMyReferenceService } from "@/marketplace/services/binderReferenceCatalog.data.functions";
import { saveMyService } from "@/marketplace/services/binderQuotes.data.functions";
import { UNIT_NONE, UNIT_OTHER, initialUnitChoice, unitOptions, validateServiceForm, type ServiceFormValues } from "@/marketplace/reference/serviceForm";
import { commonPracticeHint } from "@/marketplace/reference/units";
import type { PricingMode } from "@/marketplace/reference/types";
import { ErrorNote, FIELD, Field, PRIMARY_BUTTON, SECONDARY_BUTTON } from "../quoteUi";
import { CATALOG_KEY } from "../quoteQueryKeys";
import type { Service } from "./catalogTypes";

export type ServiceFormTarget =
  | {
      kind: "reference";
      version: string;
      key: string;
      suggestedName: string;
      unitCandidates: readonly string[];
      pricingModes: readonly PricingMode[];
    }
  | { kind: "custom" };

export function ServiceForm({
  target,
  onCancel,
  onSaved,
}: {
  target: ServiceFormTarget;
  onCancel: () => void;
  onSaved: (service: Service) => void;
}) {
  const queryClient = useQueryClient();
  const addReference = useServerFn(addMyReferenceService);
  const saveService = useServerFn(saveMyService);
  const isReference = target.kind === "reference";
  const candidates = isReference ? target.unitCandidates : [];
  const [values, setValues] = useState<ServiceFormValues>({
    name: isReference ? target.suggestedName : "",
    unitChoice: initialUnitChoice(candidates),
    customUnit: "",
    price: "", // JAMAIS prérempli
    favorite: false,
    description: "",
  });
  const [problems, setProblems] = useState<string[]>([]);
  const set = <K extends keyof ServiceFormValues>(key: K, value: ServiceFormValues[K]) => setValues((v) => ({ ...v, [key]: value }));
  const options = unitOptions(candidates);
  const hint = isReference ? commonPracticeHint(candidates, target.pricingModes) : null;
  const idBase = isReference ? `add-${target.key}` : "add-custom";

  const mutation = useMutation({
    mutationFn: async () => {
      const result = validateServiceForm(values);
      if (!result.ok) throw Object.assign(new Error("invalid"), { local: result.problems });
      if (isReference) {
        return addReference({
          data: {
            referenceVersion: target.version,
            referenceOperationKey: target.key,
            name: result.name,
            description: result.description,
            unit: result.unit,
            unitPriceCents: result.unitPriceCents,
            vatRateBps: null,
            categoryId: null,
            isFavorite: values.favorite,
          },
        });
      }
      return saveService({
        data: {
          id: null,
          categoryId: null,
          name: result.name,
          description: result.description,
          unitPriceCents: result.unitPriceCents,
          vatRateBps: null,
          unit: result.unit,
          isActive: true,
          isFavorite: values.favorite,
        },
      });
    },
    onSuccess: async (service) => {
      await queryClient.invalidateQueries({ queryKey: CATALOG_KEY });
      onSaved(service);
    },
    onError: (error) => {
      const local = (error as { local?: string[] }).local;
      setProblems(local?.length ? local : ["La prestation n'a pas pu être enregistrée. Réessayez."]);
    },
  });

  return (
    <form
      aria-label={isReference ? `Ajouter « ${target.suggestedName} » à mes prestations` : "Prestation personnalisée"}
      className="mt-3 space-y-3 rounded-md border border-border bg-background p-3"
      onSubmit={(event) => {
        event.preventDefault();
        setProblems([]);
        mutation.mutate();
      }}
    >
      <Field label="Nom dans mon catalogue" htmlFor={`${idBase}-name`}>
        <input id={`${idBase}-name`} className={FIELD} autoComplete="off" value={values.name} onChange={(e) => set("name", e.target.value)} />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Unité" htmlFor={`${idBase}-unit`} hint={hint ? `Pratiques courantes : ${hint}` : undefined}>
          <select id={`${idBase}-unit`} className={FIELD} value={values.unitChoice} onChange={(e) => set("unitChoice", e.target.value)}>
            {options.usual.length > 0 && (
              <optgroup label="Habituelles pour cette prestation">
                {options.usual.map((u) => (
                  <option key={u.key} value={u.value}>{u.label}</option>
                ))}
              </optgroup>
            )}
            <optgroup label={options.usual.length > 0 ? "Autres unités" : "Unités"}>
              {options.others.map((u) => (
                <option key={u.key} value={u.value}>{u.label}</option>
              ))}
            </optgroup>
            <option value={UNIT_OTHER}>Autre…</option>
            <option value={UNIT_NONE}>Aucune</option>
          </select>
          {values.unitChoice === UNIT_OTHER && (
            <input aria-label="Mon unité" className={`${FIELD} mt-2`} placeholder="ex. séance, m², heure" value={values.customUnit} onChange={(e) => set("customUnit", e.target.value)} />
          )}
        </Field>
        <Field label="Prix HT (€)" htmlFor={`${idBase}-price`} hint="Votre prix : rien n'est proposé.">
          <input id={`${idBase}-price`} inputMode="decimal" className={`${FIELD} text-right tabular-nums`} placeholder="ex. 45" value={values.price} onChange={(e) => set("price", e.target.value)} />
        </Field>
      </div>

      {!isReference && (
        <Field label="Description (facultatif)" htmlFor={`${idBase}-description`}>
          <textarea id={`${idBase}-description`} rows={2} className={`${FIELD} h-auto py-2`} value={values.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
      )}

      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={values.favorite} onChange={(e) => set("favorite", e.target.checked)} />
        Mettre en favori
      </label>

      {problems.length > 0 && <ErrorNote>{problems.join(" ")}</ErrorNote>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={`${PRIMARY_BUTTON} flex-1 sm:flex-none`} disabled={mutation.isPending}>
          {mutation.isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button type="button" className={SECONDARY_BUTTON} onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}
