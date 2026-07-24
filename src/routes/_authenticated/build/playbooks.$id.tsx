import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getBuildPlaybook,
  publishPlaybookVersion,
  updatePlaybookDraft,
} from "@/build/services/admin.data.functions";
import {
  playbookSchema,
  type PlaybookField,
  type PlaybookFieldType,
  type PlaybookSchema,
  type PlaybookSection,
  type PlaybookStep,
} from "@/build/schema/playbook";

export const Route = createFileRoute("/_authenticated/build/playbooks/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Playbook — Métré Build AI" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: PlaybookDetailPage,
});

const FIELD_TYPES: PlaybookFieldType[] = [
  "single_choice",
  "multi_choice",
  "text",
  "number",
  "measurement",
  "budget",
  "timeline",
  "address",
  "photo",
  "coordinates",
  "consent",
];

function newFieldOfType(type: PlaybookFieldType, key: string): PlaybookField {
  const base = { key, label: "New field", desirability: "optional" as const };
  switch (type) {
    case "single_choice":
      return { ...base, type, options: [{ value: "option_1", label: "Option 1" }] };
    case "multi_choice":
      return { ...base, type, options: [{ value: "option_1", label: "Option 1" }] };
    case "timeline":
      return { ...base, type, options: [{ value: "option_1", label: "Option 1" }] };
    case "text":
      return { ...base, type };
    case "number":
      return { ...base, type };
    case "measurement":
      return { ...base, type, unit: "ft" };
    case "budget":
      return { ...base, type, currency: "USD", mode: "ranges", ranges: [{ value: "range_1", label: "Range 1" }] };
    case "address":
      return { ...base, type, components: [{ key: "zip", label: "ZIP code" }] };
    case "photo":
      return {
        ...base,
        type,
        maxFiles: 6,
        maxFileSizeMb: 8,
        acceptMimeTypes: ["image/jpeg", "image/png"],
        storage: "filename_only",
      };
    case "coordinates":
      return { ...base, type };
    case "consent":
      return { ...base, type, consentText: "I consent to sharing this request for review.", desirability: "required" };
  }
}

function optionsToText(field: PlaybookField): string {
  if (field.type === "single_choice" || field.type === "multi_choice" || field.type === "timeline") {
    return field.options.map((o) => `${o.value}|${o.label}`).join("\n");
  }
  if (field.type === "budget" && field.mode === "ranges") {
    return (field.ranges ?? []).map((r) => `${r.value}|${r.label}`).join("\n");
  }
  return "";
}

function parseOptionsText(text: string): { value: string; label: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [value, label] = line.split("|");
      return { value: (value ?? "").trim(), label: (label ?? value ?? "").trim() };
    })
    .filter((o) => o.value.length > 0);
}

function PlaybookDetailPage() {
  const { id } = Route.useParams();
  const fetchPlaybook = useServerFn(getBuildPlaybook);
  const updateDraftFn = useServerFn(updatePlaybookDraft);
  const publishFn = useServerFn(publishPlaybookVersion);
  const queryClient = useQueryClient();
  const key = ["build-admin", "playbook", id] as const;

  const opts = queryOptions({ queryKey: key, queryFn: () => fetchPlaybook({ data: { id } }) });
  const { data: playbook } = useSuspenseQuery(opts);

  const [name, setName] = useState(playbook.name);
  const [description, setDescription] = useState(playbook.description ?? "");
  const [projectType, setProjectType] = useState(playbook.project_type ?? "");
  const [isActive, setIsActive] = useState(playbook.is_active);
  const [draft, setDraft] = useState<PlaybookSchema>(() => {
    const parsed = playbookSchema.safeParse(playbook.draft_schema);
    return parsed.success ? parsed.data : playbookSchema.parse({ schemaVersion: 1 });
  });
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(draft, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<number | null>(null);

  function updateDraftState(mutator: (d: PlaybookSchema) => PlaybookSchema) {
    setDraft((prev) => {
      const next = mutator(prev);
      setJsonText(JSON.stringify(next, null, 2));
      return next;
    });
  }

  function applyJson() {
    try {
      const parsed = playbookSchema.parse(JSON.parse(jsonText));
      setDraft(parsed);
      setJsonError(null);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "Invalid JSON");
    }
  }

  const saveMut = useMutation({
    mutationFn: () =>
      updateDraftFn({
        data: {
          id,
          name: name.trim(),
          description: description.trim() || null,
          project_type: projectType.trim() || null,
          is_active: isActive,
          draft_schema: draft,
        },
      }),
    onSuccess: () => {
      setSaveError(null);
      queryClient.invalidateQueries({ queryKey: ["build-admin", "playbooks"] });
    },
    onError: (err: unknown) => setSaveError(err instanceof Error ? err.message : "Unable to save"),
  });

  const publishMut = useMutation({
    mutationFn: () => publishFn({ data: { id } }),
    onSuccess: (result) => {
      setPublishError(null);
      setPublishSuccess(result.version.version_number);
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ["build-admin", "playbooks"] });
    },
    onError: (err: unknown) => setPublishError(err instanceof Error ? err.message : "Unable to publish"),
  });

  function addSection() {
    updateDraftState((d) => ({
      ...d,
      sections: [...d.sections, { id: crypto.randomUUID(), title: "New section", steps: [] }],
    }));
  }
  function removeSection(sectionId: string) {
    updateDraftState((d) => ({ ...d, sections: d.sections.filter((s) => s.id !== sectionId) }));
  }
  function updateSection(sectionId: string, patch: Partial<PlaybookSection>) {
    updateDraftState((d) => ({ ...d, sections: d.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)) }));
  }
  function addStep(sectionId: string) {
    updateDraftState((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id === sectionId ? { ...s, steps: [...s.steps, { id: crypto.randomUUID(), title: "New step", fields: [] }] } : s,
      ),
    }));
  }
  function removeStep(sectionId: string, stepId: string) {
    updateDraftState((d) => ({
      ...d,
      sections: d.sections.map((s) => (s.id === sectionId ? { ...s, steps: s.steps.filter((st) => st.id !== stepId) } : s)),
    }));
  }
  function updateStep(sectionId: string, stepId: string, patch: Partial<PlaybookStep>) {
    updateDraftState((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id === sectionId ? { ...s, steps: s.steps.map((st) => (st.id === stepId ? { ...st, ...patch } : st)) } : s,
      ),
    }));
  }
  function addField(sectionId: string, stepId: string) {
    const field = newFieldOfType("text", `field_${Math.random().toString(36).slice(2, 8)}`);
    updateDraftState((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id === sectionId
          ? { ...s, steps: s.steps.map((st) => (st.id === stepId ? { ...st, fields: [...st.fields, field] } : st)) }
          : s,
      ),
    }));
  }
  function removeField(sectionId: string, stepId: string, fieldKey: string) {
    updateDraftState((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              steps: s.steps.map((st) =>
                st.id === stepId ? { ...st, fields: st.fields.filter((f) => f.key !== fieldKey) } : st,
              ),
            }
          : s,
      ),
    }));
  }
  function updateField(sectionId: string, stepId: string, fieldKey: string, patch: Record<string, unknown>) {
    updateDraftState((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              steps: s.steps.map((st) =>
                st.id === stepId
                  ? {
                      ...st,
                      fields: st.fields.map((f) =>
                        f.key === fieldKey ? ({ ...f, ...patch } as PlaybookField) : f,
                      ),
                    }
                  : st,
              ),
            }
          : s,
      ),
    }));
  }
  function changeFieldType(sectionId: string, stepId: string, fieldKey: string, type: PlaybookFieldType) {
    updateDraftState((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              steps: s.steps.map((st) =>
                st.id === stepId
                  ? {
                      ...st,
                      fields: st.fields.map((f) => (f.key === fieldKey ? newFieldOfType(type, f.key) : f)),
                    }
                  : st,
              ),
            }
          : s,
      ),
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/build/playbooks" className="text-xs text-muted-foreground hover:underline">
          ← Playbooks
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">{playbook.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {playbook.published_version_id ? "Publié" : "Brouillon non publié"} · {playbook.versions.length} version(s)
        </p>
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Informations générales</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Nom</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Type de projet</label>
            <input
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Actif
          </label>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Structure du Playbook</h2>
          <button
            type="button"
            onClick={() => setJsonMode((v) => !v)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-xs hover:bg-accent"
          >
            {jsonMode ? "Éditeur structuré" : "Éditer en JSON"}
          </button>
        </div>

        {jsonMode ? (
          <div className="mt-3 space-y-2">
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={24}
              className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
            />
            {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
            <button
              type="button"
              onClick={applyJson}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-xs hover:bg-accent"
            >
              Appliquer le JSON
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            {draft.sections.map((section, sIdx) => (
              <div key={section.id} className="rounded-md border border-border p-3">
                <div className="flex items-center gap-2">
                  <input
                    value={section.title}
                    onChange={(e) => updateSection(section.id, { title: e.target.value })}
                    className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm font-medium"
                  />
                  <span className="text-xs text-muted-foreground">Section {sIdx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeSection(section.id)}
                    className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                  >
                    Supprimer
                  </button>
                </div>

                <div className="mt-3 space-y-3 pl-3">
                  {section.steps.map((step, stIdx) => (
                    <div key={step.id} className="rounded-md border border-border bg-muted/30 p-3">
                      <div className="flex items-center gap-2">
                        <input
                          value={step.title}
                          onChange={(e) => updateStep(section.id, step.id, { title: e.target.value })}
                          className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
                        />
                        <span className="text-xs text-muted-foreground">Étape {stIdx + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeStep(section.id, step.id)}
                          className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                        >
                          Supprimer
                        </button>
                      </div>
                      <textarea
                        value={step.why ?? ""}
                        onChange={(e) => updateStep(section.id, step.id, { why: e.target.value })}
                        placeholder="Pourquoi cette étape (aide au commercial)"
                        rows={1}
                        className="mt-2 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                      />

                      <div className="mt-3 space-y-2 pl-3">
                        {step.fields.map((field) => (
                          <FieldEditor
                            key={field.key}
                            field={field}
                            onChangeType={(type) => changeFieldType(section.id, step.id, field.key, type)}
                            onPatch={(patch) => updateField(section.id, step.id, field.key, patch)}
                            onRemove={() => removeField(section.id, step.id, field.key)}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => addField(section.id, step.id)}
                          className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
                        >
                          + Champ
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addStep(section.id)}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
                  >
                    + Étape
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addSection}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent"
            >
              + Section
            </button>
            <p className="text-xs text-muted-foreground">
              Logique conditionnelle, mapping vers le Dossier et règles de cohérence : utilisez « Éditer en JSON » pour l'instant.
            </p>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saveMut.isPending ? "Enregistrement…" : "Enregistrer le brouillon"}
        </button>
        <button
          type="button"
          onClick={() => publishMut.mutate()}
          disabled={publishMut.isPending}
          className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
        >
          {publishMut.isPending ? "Publication…" : "Publier une version"}
        </button>
        {saveError && <p className="text-xs text-destructive">{saveError}</p>}
        {publishError && <p className="text-xs text-destructive">{publishError}</p>}
        {publishSuccess !== null && <p className="text-xs text-emerald-700">Version {publishSuccess} publiée.</p>}
      </div>
    </div>
  );
}

function FieldEditor({
  field,
  onChangeType,
  onPatch,
  onRemove,
}: {
  field: PlaybookField;
  onChangeType: (type: PlaybookFieldType) => void;
  onPatch: (patch: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <input
          value={field.key}
          onChange={(e) => onPatch({ key: e.target.value })}
          placeholder="key"
          className="rounded-md border border-input bg-background px-2 py-1 text-xs font-mono"
        />
        <input
          value={field.label}
          onChange={(e) => onPatch({ label: e.target.value })}
          placeholder="Label"
          className="rounded-md border border-input bg-background px-2 py-1 text-xs sm:col-span-2"
        />
        <select
          value={field.type}
          onChange={(e) => onChangeType(e.target.value as PlaybookFieldType)}
          className="rounded-md border border-input bg-background px-2 py-1 text-xs"
        >
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <select
          value={field.desirability}
          onChange={(e) => onPatch({ desirability: e.target.value })}
          className="rounded-md border border-input bg-background px-2 py-1 text-xs"
        >
          <option value="required">Obligatoire</option>
          <option value="recommended">Recommandé</option>
          <option value="optional">Optionnel</option>
        </select>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={field.allowNotSure ?? false}
            onChange={(e) => onPatch({ allowNotSure: e.target.checked })}
          />
          "Pas sûr" autorisé
        </label>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
        >
          Supprimer le champ
        </button>
      </div>

      <input
        value={field.helpText ?? ""}
        onChange={(e) => onPatch({ helpText: e.target.value })}
        placeholder="Texte d'aide"
        className="mt-2 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
      />

      {(field.type === "single_choice" || field.type === "multi_choice" || field.type === "timeline") && (
        <div className="mt-2">
          <label className="text-xs text-muted-foreground">Options (une par ligne, "valeur|libellé")</label>
          <textarea
            defaultValue={optionsToText(field)}
            onBlur={(e) => onPatch({ options: parseOptionsText(e.target.value) })}
            rows={3}
            className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 font-mono text-xs"
          />
        </div>
      )}

      {field.type === "measurement" && (
        <select
          value={field.unit}
          onChange={(e) => onPatch({ unit: e.target.value })}
          className="mt-2 rounded-md border border-input bg-background px-2 py-1 text-xs"
        >
          {["ft", "in", "m", "cm", "sqft", "sqm"].map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      )}

      {field.type === "budget" && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <select
            value={field.mode}
            onChange={(e) => onPatch({ mode: e.target.value })}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          >
            <option value="ranges">Fourchettes</option>
            <option value="numeric">Montant libre</option>
          </select>
          {field.mode === "ranges" ? (
            <textarea
              defaultValue={optionsToText(field)}
              onBlur={(e) => onPatch({ ranges: parseOptionsText(e.target.value) })}
              rows={3}
              className="rounded-md border border-input bg-background px-2 py-1 font-mono text-xs sm:col-span-2"
            />
          ) : (
            <input
              value={field.currency}
              onChange={(e) => onPatch({ currency: e.target.value })}
              placeholder="Devise"
              className="rounded-md border border-input bg-background px-2 py-1 text-xs"
            />
          )}
        </div>
      )}

      {field.type === "photo" && (
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <input
            type="number"
            value={field.maxFiles}
            onChange={(e) => onPatch({ maxFiles: Number(e.target.value) })}
            placeholder="Nb max de photos"
            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
          <input
            type="number"
            value={field.maxFileSizeMb}
            onChange={(e) => onPatch({ maxFileSizeMb: Number(e.target.value) })}
            placeholder="Taille max (Mo)"
            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
          <input
            defaultValue={field.acceptMimeTypes.join(",")}
            onBlur={(e) => onPatch({ acceptMimeTypes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            placeholder="image/jpeg,image/png"
            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
        </div>
      )}

      {field.type === "consent" && (
        <textarea
          value={field.consentText}
          onChange={(e) => onPatch({ consentText: e.target.value })}
          rows={2}
          className="mt-2 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
        />
      )}
    </div>
  );
}
