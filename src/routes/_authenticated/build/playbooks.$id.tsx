import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  duplicateBuildPlaybook,
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
import { getPlaybookPublishIssues } from "@/build/engine/validation";
import { ConditionGroupEditor } from "@/build/pages/admin/playbookEditor/ConditionGroupEditor";
import { FieldEditor } from "@/build/pages/admin/playbookEditor/FieldEditor";
import {
  ValidationRulesEditor,
  type StepSummary,
} from "@/build/pages/admin/playbookEditor/ValidationRulesEditor";
import { BriefConfigEditor } from "@/build/pages/admin/playbookEditor/BriefConfigEditor";
import { collectFieldSummaries } from "@/build/pages/admin/playbookEditor/fieldSummaries";

export const Route = createFileRoute("/_authenticated/build/playbooks/$id")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Playbook — Métré Build AI" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: PlaybookDetailPage,
});

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
      return {
        ...base,
        type,
        currency: "USD",
        mode: "ranges",
        ranges: [{ value: "range_1", label: "Range 1" }],
      };
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
      return {
        ...base,
        type,
        consentText: "I consent to sharing this request for review.",
        desirability: "required",
      };
    case "inspiration_photo":
      return {
        ...base,
        type,
        maxFileSizeMb: 8,
        acceptMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      };
  }
}

function moveItem<T>(arr: T[], index: number, dir: -1 | 1): T[] {
  const target = index + dir;
  if (target < 0 || target >= arr.length) return arr;
  const next = [...arr];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

type Tab = "content" | "rules" | "brief" | "json";
const TAB_LABELS: Record<Tab, string> = {
  content: "Content",
  rules: "Consistency rules",
  brief: "Dossier Commercial",
  json: "Advanced JSON",
};

function PlaybookDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const fetchPlaybook = useServerFn(getBuildPlaybook);
  const updateDraftFn = useServerFn(updatePlaybookDraft);
  const publishFn = useServerFn(publishPlaybookVersion);
  const duplicateFn = useServerFn(duplicateBuildPlaybook);
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
  const [tab, setTab] = useState<Tab>("content");
  const [jsonText, setJsonText] = useState(() => JSON.stringify(draft, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<number | null>(null);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const fieldSummaries = useMemo(() => collectFieldSummaries(draft), [draft]);
  const stepSummaries: StepSummary[] = useMemo(
    () =>
      draft.sections.flatMap((s) =>
        s.steps.map((st) => ({ id: st.id, title: st.title, sectionTitle: s.title })),
      ),
    [draft],
  );
  const issues = useMemo(() => getPlaybookPublishIssues(draft), [draft]);

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
    onError: (err: unknown) =>
      setPublishError(err instanceof Error ? err.message : "Unable to publish"),
  });

  const duplicateMut = useMutation({
    mutationFn: () => duplicateFn({ data: { id } }),
    onSuccess: (copy) => {
      setDuplicateError(null);
      queryClient.invalidateQueries({ queryKey: ["build-admin", "playbooks"] });
      if (copy?.id) navigate({ to: "/build/playbooks/$id", params: { id: copy.id } });
    },
    onError: (err: unknown) =>
      setDuplicateError(err instanceof Error ? err.message : "Unable to duplicate"),
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
    updateDraftState((d) => ({
      ...d,
      sections: d.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)),
    }));
  }
  function moveSection(index: number, dir: -1 | 1) {
    updateDraftState((d) => ({ ...d, sections: moveItem(d.sections, index, dir) }));
  }
  function addStep(sectionId: string) {
    updateDraftState((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              steps: [...s.steps, { id: crypto.randomUUID(), title: "New step", fields: [] }],
            }
          : s,
      ),
    }));
  }
  function removeStep(sectionId: string, stepId: string) {
    updateDraftState((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id === sectionId ? { ...s, steps: s.steps.filter((st) => st.id !== stepId) } : s,
      ),
    }));
  }
  function updateStep(sectionId: string, stepId: string, patch: Partial<PlaybookStep>) {
    updateDraftState((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id === sectionId
          ? { ...s, steps: s.steps.map((st) => (st.id === stepId ? { ...st, ...patch } : st)) }
          : s,
      ),
    }));
  }
  function moveStep(sectionId: string, index: number, dir: -1 | 1) {
    updateDraftState((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id === sectionId ? { ...s, steps: moveItem(s.steps, index, dir) } : s,
      ),
    }));
  }
  function addField(sectionId: string, stepId: string) {
    const field = newFieldOfType("text", `field_${Math.random().toString(36).slice(2, 8)}`);
    updateDraftState((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              steps: s.steps.map((st) =>
                st.id === stepId ? { ...st, fields: [...st.fields, field] } : st,
              ),
            }
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
                st.id === stepId
                  ? { ...st, fields: st.fields.filter((f) => f.key !== fieldKey) }
                  : st,
              ),
            }
          : s,
      ),
    }));
  }
  function moveField(sectionId: string, stepId: string, index: number, dir: -1 | 1) {
    updateDraftState((d) => ({
      ...d,
      sections: d.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              steps: s.steps.map((st) =>
                st.id === stepId ? { ...st, fields: moveItem(st.fields, index, dir) } : st,
              ),
            }
          : s,
      ),
    }));
  }
  function updateField(
    sectionId: string,
    stepId: string,
    fieldKey: string,
    patch: Record<string, unknown>,
  ) {
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
  function changeFieldType(
    sectionId: string,
    stepId: string,
    fieldKey: string,
    type: PlaybookFieldType,
  ) {
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
                        f.key === fieldKey ? newFieldOfType(type, f.key) : f,
                      ),
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
          {playbook.published_version_id ? "Published" : "Unpublished draft"} ·{" "}
          {playbook.versions.length} version(s)
        </p>
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">General information</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground">
              Project type
            </label>
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
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>
        </div>
      </section>

      <section
        className={`rounded-lg border p-4 ${issues.length > 0 ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"}`}
      >
        <h2 className="text-sm font-semibold">Publication status</h2>
        {issues.length === 0 ? (
          <p className="mt-1 text-xs text-emerald-800">
            No issues detected — this Playbook is ready to be published.
          </p>
        ) : (
          <ul className="mt-1 list-disc pl-5 text-xs text-amber-800">
            {issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "border border-input bg-background hover:bg-accent"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === "content" && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Playbook structure</h2>
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
                    onClick={() => moveSection(sIdx, -1)}
                    disabled={sIdx === 0}
                    className="rounded-md border border-input bg-background px-1.5 py-1 text-xs disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(sIdx, 1)}
                    disabled={sIdx === draft.sections.length - 1}
                    className="rounded-md border border-input bg-background px-1.5 py-1 text-xs disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSection(section.id)}
                    className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                  >
                    Delete
                  </button>
                </div>

                <div className="mt-3 space-y-3 pl-3">
                  {section.steps.map((step, stIdx) => (
                    <div key={step.id} className="rounded-md border border-border bg-muted/30 p-3">
                      <div className="flex items-center gap-2">
                        <input
                          value={step.title}
                          onChange={(e) =>
                            updateStep(section.id, step.id, { title: e.target.value })
                          }
                          className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-sm"
                        />
                        <span className="text-xs text-muted-foreground">Step {stIdx + 1}</span>
                        <button
                          type="button"
                          onClick={() => moveStep(section.id, stIdx, -1)}
                          disabled={stIdx === 0}
                          className="rounded-md border border-input bg-background px-1.5 py-1 text-xs disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveStep(section.id, stIdx, 1)}
                          disabled={stIdx === section.steps.length - 1}
                          className="rounded-md border border-input bg-background px-1.5 py-1 text-xs disabled:opacity-30"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => removeStep(section.id, step.id)}
                          className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                        >
                          Delete
                        </button>
                      </div>
                      <textarea
                        value={step.why ?? ""}
                        onChange={(e) => updateStep(section.id, step.id, { why: e.target.value })}
                        placeholder="Why this step exists (helps the sales team)"
                        rows={1}
                        className="mt-2 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                      />

                      <details className="mt-2 rounded-md border border-border bg-background p-2">
                        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                          Step display condition
                        </summary>
                        <div className="mt-2">
                          <ConditionGroupEditor
                            group={step.displayWhen}
                            onChange={(next) =>
                              updateStep(section.id, step.id, { displayWhen: next })
                            }
                            fields={fieldSummaries.filter(
                              (f) => !step.fields.some((sf) => sf.key === f.key),
                            )}
                            emptyHint="This step is always shown (no condition)."
                          />
                        </div>
                      </details>

                      <div className="mt-3 space-y-2 pl-3">
                        {step.fields.map((field, fIdx) => (
                          <div key={field.key}>
                            <div className="flex justify-end gap-1 pb-1">
                              <button
                                type="button"
                                onClick={() => moveField(section.id, step.id, fIdx, -1)}
                                disabled={fIdx === 0}
                                className="rounded-md border border-input bg-background px-1.5 py-0.5 text-xs disabled:opacity-30"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                onClick={() => moveField(section.id, step.id, fIdx, 1)}
                                disabled={fIdx === step.fields.length - 1}
                                className="rounded-md border border-input bg-background px-1.5 py-0.5 text-xs disabled:opacity-30"
                              >
                                ↓
                              </button>
                            </div>
                            <FieldEditor
                              field={field}
                              fields={fieldSummaries}
                              onChangeType={(type) =>
                                changeFieldType(section.id, step.id, field.key, type)
                              }
                              onPatch={(patch) =>
                                updateField(section.id, step.id, field.key, patch)
                              }
                              onRemove={() => removeField(section.id, step.id, field.key)}
                            />
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addField(section.id, step.id)}
                          className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
                        >
                          + Field
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addStep(section.id)}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
                  >
                    + Step
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
          </div>
        </section>
      )}

      {tab === "rules" && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Consistency rules</h2>
          <div className="mt-3">
            <ValidationRulesEditor
              rules={draft.validationRules}
              onChange={(next) => updateDraftState((d) => ({ ...d, validationRules: next }))}
              fields={fieldSummaries}
              steps={stepSummaries}
            />
          </div>
        </section>
      )}

      {tab === "brief" && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Commercial Dossier</h2>
          <div className="mt-3">
            <BriefConfigEditor
              briefConfig={draft.briefConfig}
              onChange={(next) => updateDraftState((d) => ({ ...d, briefConfig: next }))}
              fields={fieldSummaries}
            />
          </div>
        </section>
      )}

      {tab === "json" && (
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Advanced JSON</h2>
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
              Apply JSON
            </button>
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saveMut.isPending ? "Saving..." : "Save draft"}
        </button>
        <button
          type="button"
          onClick={() => publishMut.mutate()}
          disabled={publishMut.isPending}
          className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
        >
          {publishMut.isPending ? "Publishing..." : "Publish version"}
        </button>
        <button
          type="button"
          onClick={() => duplicateMut.mutate()}
          disabled={duplicateMut.isPending}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
        >
          {duplicateMut.isPending ? "Duplicating..." : "Duplicate as draft"}
        </button>
        {saveError && <p className="text-xs text-destructive">{saveError}</p>}
        {publishError && <p className="text-xs text-destructive">{publishError}</p>}
        {duplicateError && <p className="text-xs text-destructive">{duplicateError}</p>}
        {publishSuccess !== null && (
          <p className="text-xs text-emerald-700">Version {publishSuccess} published.</p>
        )}
      </div>
    </div>
  );
}
