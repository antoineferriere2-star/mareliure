// Editor for briefConfig — everything that used to require raw JSON to
// configure how a submitted ProjectBrief gets generated: the project
// summary, calculated fields, playbook-authored derived lines, always-on
// caveats, and the suggested next action. See src/build/engine/brief.ts for
// the exact interpretation semantics this UI must stay faithful to.
import type {
  AlwaysIncludeLine,
  BriefConfig,
  CalculatedFieldMapping,
  DerivedLineRule,
  SuggestedNextActionRule,
} from "@/build/schema/playbook";
import { ConditionGroupEditor } from "./ConditionGroupEditor";
import { FieldPicker } from "./FieldPicker";
import { BRIEF_SECTION_KEYS, BRIEF_SECTION_LABELS } from "./briefSectionLabels";
import type { FieldSummary } from "./fieldSummaries";
import { slugify, uniqueSlug } from "./slug";

const inputCls = "rounded-md border border-input bg-background px-2 py-1 text-xs";
const selectCls = inputCls;

function TokenHint() {
  return (
    <p className="text-[11px] text-muted-foreground">
      Utilisez {"{{cléDuChamp}}"} pour insérer une réponse, ou {"{{cléDuChamp|lower}}"} pour l'insérer en minuscules.
    </p>
  );
}

function CalculatedFieldRow({
  calc,
  fields,
  otherKeys,
  onChange,
  onRemove,
}: {
  calc: CalculatedFieldMapping;
  fields: FieldSummary[];
  otherKeys: string[];
  onChange: (next: CalculatedFieldMapping) => void;
  onRemove: () => void;
}) {
  const compute = calc.compute;
  return (
    <div className="space-y-2 rounded-md border border-border bg-background p-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <input
          value={calc.label}
          onChange={(e) => {
            const nextLabel = e.target.value;
            const wasAutoKey = calc.key === slugify(calc.label);
            onChange({ ...calc, label: nextLabel, ...(wasAutoKey ? { key: uniqueSlug(nextLabel, otherKeys) } : {}) });
          }}
          placeholder="Libellé"
          className={`${inputCls} sm:col-span-2`}
        />
        <input
          value={calc.key}
          onChange={(e) => onChange({ ...calc, key: e.target.value })}
          placeholder="clé"
          className={`${inputCls} font-mono`}
        />
        <select
          value={calc.section}
          onChange={(e) => onChange({ ...calc, section: e.target.value as CalculatedFieldMapping["section"] })}
          className={selectCls}
        >
          {BRIEF_SECTION_KEYS.map((k) => (
            <option key={k} value={k}>
              {BRIEF_SECTION_LABELS[k]}
            </option>
          ))}
        </select>
      </div>

      <select
        value={compute.op}
        onChange={(e) => {
          const op = e.target.value;
          onChange({
            ...calc,
            compute:
              op === "multiply"
                ? { op: "multiply", inputs: [fields[0]?.key ?? "", fields[1]?.key ?? fields[0]?.key ?? ""] }
                : { op: "concat", inputs: [fields[0]?.key ?? ""], separator: " " },
          });
        }}
        className={selectCls}
      >
        <option value="multiply">Multiplier deux champs (ex : longueur × largeur)</option>
        <option value="concat">Concaténer plusieurs champs</option>
      </select>

      {compute.op === "multiply" ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <FieldPicker
            fields={fields}
            value={compute.inputs[0]}
            onChange={(key) => onChange({ ...calc, compute: { ...compute, inputs: [key, compute.inputs[1]] } })}
          />
          <FieldPicker
            fields={fields}
            value={compute.inputs[1]}
            onChange={(key) => onChange({ ...calc, compute: { ...compute, inputs: [compute.inputs[0], key] } })}
          />
          <input
            value={compute.unit ?? ""}
            onChange={(e) => onChange({ ...calc, compute: { ...compute, unit: e.target.value || undefined } })}
            placeholder="Unité (ex : sq ft)"
            className={inputCls}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="space-y-1">
            {compute.inputs.map((inputKey, i) => (
              <div key={i} className="flex items-center gap-2">
                <FieldPicker
                  fields={fields}
                  value={inputKey}
                  onChange={(key) =>
                    onChange({ ...calc, compute: { ...compute, inputs: compute.inputs.map((k, j) => (j === i ? key : k)) } })
                  }
                />
                <button
                  type="button"
                  onClick={() => onChange({ ...calc, compute: { ...compute, inputs: compute.inputs.filter((_, j) => j !== i) } })}
                  className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                >
                  Retirer
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...calc, compute: { ...compute, inputs: [...compute.inputs, fields[0]?.key ?? ""] } })}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
            >
              + Champ
            </button>
            <input
              value={compute.separator}
              onChange={(e) => onChange({ ...calc, compute: { ...compute, separator: e.target.value } })}
              placeholder="Séparateur"
              className={`w-24 ${inputCls}`}
            />
          </div>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="text-[11px] text-muted-foreground">Si la valeur ne peut pas être calculée, se replier sur :</label>
          <select
            value={calc.fallbackFieldKey ?? ""}
            onChange={(e) => onChange({ ...calc, fallbackFieldKey: e.target.value || undefined })}
            className={`mt-1 w-full ${selectCls}`}
          >
            <option value="">Aucun repli</option>
            {fields.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <input
          value={calc.category ?? ""}
          onChange={(e) => onChange({ ...calc, category: e.target.value || undefined })}
          placeholder="Catégorie (optionnel)"
          className={`self-end ${inputCls}`}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={calc.onMissingLabel ?? ""}
          onChange={(e) => onChange({ ...calc, onMissingLabel: e.target.value || undefined })}
          placeholder="Libellé si absent (optionnel)"
          className={inputCls}
        />
        <input
          value={calc.onMissingValue ?? ""}
          onChange={(e) => onChange({ ...calc, onMissingValue: e.target.value || undefined })}
          placeholder="Valeur si absent (optionnel)"
          className={inputCls}
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
      >
        Supprimer ce champ calculé
      </button>
    </div>
  );
}

export function BriefConfigEditor({
  briefConfig,
  onChange,
  fields,
}: {
  briefConfig: BriefConfig;
  onChange: (next: BriefConfig) => void;
  fields: FieldSummary[];
}) {
  function patch(p: Partial<BriefConfig>) {
    onChange({ ...briefConfig, ...p });
  }

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold">Général</h3>
        <TokenHint />
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <label className="block text-[11px] text-muted-foreground">Nom de mission (modèle, optionnel)</label>
            <input
              value={briefConfig.missionNameTemplate ?? ""}
              onChange={(e) => patch({ missionNameTemplate: e.target.value || undefined })}
              className={`mt-1 w-full ${inputCls}`}
            />
          </div>
          <div>
            <label className="block text-[11px] text-muted-foreground">Libellé de statut (optionnel)</label>
            <input
              value={briefConfig.statusLabel ?? ""}
              onChange={(e) => patch({ statusLabel: e.target.value || undefined })}
              className={`mt-1 w-full ${inputCls}`}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[11px] text-muted-foreground">
              Résumé par défaut si aucun fragment ne s'applique
            </label>
            <input
              value={briefConfig.emptySummaryFallback}
              onChange={(e) => patch({ emptySummaryFallback: e.target.value })}
              className={`mt-1 w-full ${inputCls}`}
            />
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Résumé du projet</h3>
          <button
            type="button"
            onClick={() => patch({ summaryFragments: [...briefConfig.summaryFragments, { template: "" }] })}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
          >
            + Fragment
          </button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Chaque fragment dont la condition est vraie est ajouté, dans l'ordre, pour former le résumé.
        </p>
        <div className="mt-2 space-y-2">
          {briefConfig.summaryFragments.map((frag, i) => (
            <div key={i} className="rounded-md border border-border bg-background p-2">
              <div className="flex items-center gap-2">
                <input
                  value={frag.template}
                  onChange={(e) =>
                    patch({
                      summaryFragments: briefConfig.summaryFragments.map((f, j) =>
                        j === i ? { ...f, template: e.target.value } : f,
                      ),
                    })
                  }
                  placeholder="ex : {{projectType}} pour un budget de {{budgetRange}}"
                  className={`flex-1 ${inputCls}`}
                />
                <button
                  type="button"
                  onClick={() => patch({ summaryFragments: briefConfig.summaryFragments.filter((_, j) => j !== i) })}
                  className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                >
                  Supprimer
                </button>
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] text-muted-foreground">Condition (optionnelle)</summary>
                <div className="mt-1">
                  <ConditionGroupEditor
                    group={frag.when}
                    onChange={(next) =>
                      patch({
                        summaryFragments: briefConfig.summaryFragments.map((f, j) => (j === i ? { ...f, when: next } : f)),
                      })
                    }
                    fields={fields}
                    emptyHint="Ce fragment est toujours inclus."
                  />
                </div>
              </details>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Champs calculés</h3>
          <button
            type="button"
            onClick={() => {
              const label = `Champ calculé ${briefConfig.calculatedFields.length + 1}`;
              const key = uniqueSlug(label, briefConfig.calculatedFields.map((c) => c.key));
              const next: CalculatedFieldMapping = {
                key,
                label,
                section: "assumptionsAndCalculated",
                compute: { op: "multiply", inputs: [fields[0]?.key ?? "", fields[1]?.key ?? fields[0]?.key ?? ""] },
              };
              patch({ calculatedFields: [...briefConfig.calculatedFields, next] });
            }}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
          >
            + Champ calculé
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {briefConfig.calculatedFields.map((calc, i) => (
            <CalculatedFieldRow
              key={i}
              calc={calc}
              fields={fields}
              otherKeys={briefConfig.calculatedFields.filter((_, j) => j !== i).map((c) => c.key)}
              onChange={(next) =>
                patch({ calculatedFields: briefConfig.calculatedFields.map((c, j) => (j === i ? next : c)) })
              }
              onRemove={() => patch({ calculatedFields: briefConfig.calculatedFields.filter((_, j) => j !== i) })}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Lignes dérivées</h3>
          <button
            type="button"
            onClick={() => {
              const next: DerivedLineRule = {
                id: crypto.randomUUID(),
                section: "constraints",
                when: { all: [] },
                label: "",
                value: "",
                source: "deterministic_rule",
              };
              patch({ derivedLines: [...briefConfig.derivedLines, next] });
            }}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
          >
            + Ligne
          </button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Une ligne ajoutée automatiquement au Dossier quand sa condition est vraie.
        </p>
        <div className="mt-2 space-y-2">
          {briefConfig.derivedLines.map((line, i) => (
            <div key={line.id} className="space-y-2 rounded-md border border-border bg-background p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  value={line.section}
                  onChange={(e) =>
                    patch({
                      derivedLines: briefConfig.derivedLines.map((l, j) =>
                        j === i ? { ...l, section: e.target.value as DerivedLineRule["section"] } : l,
                      ),
                    })
                  }
                  className={selectCls}
                >
                  {BRIEF_SECTION_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {BRIEF_SECTION_LABELS[k]}
                    </option>
                  ))}
                </select>
                <select
                  value={line.source}
                  onChange={(e) =>
                    patch({
                      derivedLines: briefConfig.derivedLines.map((l, j) =>
                        j === i ? { ...l, source: e.target.value as DerivedLineRule["source"] } : l,
                      ),
                    })
                  }
                  className={selectCls}
                >
                  <option value="deterministic_rule">Règle déterministe</option>
                  <option value="calculated_value">Valeur calculée</option>
                  <option value="visitor_answer">Réponse du visiteur</option>
                </select>
              </div>
              <input
                value={line.label}
                onChange={(e) =>
                  patch({ derivedLines: briefConfig.derivedLines.map((l, j) => (j === i ? { ...l, label: e.target.value } : l)) })
                }
                placeholder="Libellé"
                className={`w-full ${inputCls}`}
              />
              <input
                value={line.value}
                onChange={(e) =>
                  patch({ derivedLines: briefConfig.derivedLines.map((l, j) => (j === i ? { ...l, value: e.target.value } : l)) })
                }
                placeholder="Valeur (peut utiliser {{cléDuChamp}})"
                className={`w-full ${inputCls}`}
              />
              <div>
                <span className="text-[11px] font-medium text-muted-foreground">Cette ligne apparaît quand…</span>
                <div className="mt-1">
                  <ConditionGroupEditor
                    group={line.when}
                    onChange={(next) =>
                      patch({ derivedLines: briefConfig.derivedLines.map((l, j) => (j === i ? { ...l, when: next ?? {} } : l)) })
                    }
                    fields={fields}
                    emptyHint="Cette ligne apparaît toujours."
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => patch({ derivedLines: briefConfig.derivedLines.filter((_, j) => j !== i) })}
                className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
              >
                Supprimer
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Lignes toujours incluses</h3>
          <button
            type="button"
            onClick={() => {
              const next: AlwaysIncludeLine = { section: "missingInformation", label: "", value: "" };
              patch({ alwaysIncludeLines: [...briefConfig.alwaysIncludeLines, next] });
            }}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
          >
            + Ligne
          </button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Toujours ajoutées au Dossier, sans condition (ex : mises en garde systématiques).
        </p>
        <div className="mt-2 space-y-2">
          {briefConfig.alwaysIncludeLines.map((line, i) => (
            <div key={i} className="grid gap-2 rounded-md border border-border bg-background p-3 sm:grid-cols-4">
              <select
                value={line.section}
                onChange={(e) =>
                  patch({
                    alwaysIncludeLines: briefConfig.alwaysIncludeLines.map((l, j) =>
                      j === i ? { ...l, section: e.target.value as AlwaysIncludeLine["section"] } : l,
                    ),
                  })
                }
                className={selectCls}
              >
                {BRIEF_SECTION_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {BRIEF_SECTION_LABELS[k]}
                  </option>
                ))}
              </select>
              <input
                value={line.label}
                onChange={(e) =>
                  patch({
                    alwaysIncludeLines: briefConfig.alwaysIncludeLines.map((l, j) =>
                      j === i ? { ...l, label: e.target.value } : l,
                    ),
                  })
                }
                placeholder="Libellé"
                className={inputCls}
              />
              <input
                value={line.value}
                onChange={(e) =>
                  patch({
                    alwaysIncludeLines: briefConfig.alwaysIncludeLines.map((l, j) =>
                      j === i ? { ...l, value: e.target.value } : l,
                    ),
                  })
                }
                placeholder="Valeur"
                className={inputCls}
              />
              <div className="flex items-center gap-2">
                <input
                  value={line.category ?? ""}
                  onChange={(e) =>
                    patch({
                      alwaysIncludeLines: briefConfig.alwaysIncludeLines.map((l, j) =>
                        j === i ? { ...l, category: e.target.value || undefined } : l,
                      ),
                    })
                  }
                  placeholder="Catégorie (optionnel)"
                  className={`flex-1 ${inputCls}`}
                />
                <button
                  type="button"
                  onClick={() => patch({ alwaysIncludeLines: briefConfig.alwaysIncludeLines.filter((_, j) => j !== i) })}
                  className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Action suggérée</h3>
          <button
            type="button"
            onClick={() => {
              const next: SuggestedNextActionRule = { label: "Action suggérée", value: "" };
              patch({ suggestedNextActions: [...briefConfig.suggestedNextActions, next] });
            }}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
          >
            + Action
          </button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          La première action dont la condition est vraie est utilisée ; une entrée sans condition doit rester pour
          servir de valeur par défaut.
        </p>
        <div className="mt-2 space-y-2">
          {briefConfig.suggestedNextActions.map((action, i) => (
            <div key={i} className="space-y-2 rounded-md border border-border bg-background p-3">
              <input
                value={action.label}
                onChange={(e) =>
                  patch({
                    suggestedNextActions: briefConfig.suggestedNextActions.map((a, j) =>
                      j === i ? { ...a, label: e.target.value } : a,
                    ),
                  })
                }
                placeholder="Libellé"
                className={`w-full ${inputCls}`}
              />
              <input
                value={action.value}
                onChange={(e) =>
                  patch({
                    suggestedNextActions: briefConfig.suggestedNextActions.map((a, j) =>
                      j === i ? { ...a, value: e.target.value } : a,
                    ),
                  })
                }
                placeholder="Texte de l'action recommandée"
                className={`w-full ${inputCls}`}
              />
              <details>
                <summary className="cursor-pointer text-[11px] text-muted-foreground">Condition (optionnelle)</summary>
                <div className="mt-1">
                  <ConditionGroupEditor
                    group={action.when}
                    onChange={(next) =>
                      patch({
                        suggestedNextActions: briefConfig.suggestedNextActions.map((a, j) => (j === i ? { ...a, when: next } : a)),
                      })
                    }
                    fields={fields}
                    emptyHint="Aucune condition — sert de valeur par défaut."
                  />
                </div>
              </details>
              <button
                type="button"
                onClick={() => patch({ suggestedNextActions: briefConfig.suggestedNextActions.filter((_, j) => j !== i) })}
                className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
              >
                Supprimer
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
