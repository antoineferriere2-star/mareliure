// Editor for a single PlaybookField — label/key/type, per-type settings,
// options (via OptionsListEditor), and the two panels that used to be
// JSON-only: display condition (ConditionGroupEditor on displayWhen) and
// mapping into the Dossier Commercial (briefMapping).
import type { FieldOption, PlaybookField, PlaybookFieldType } from "@/build/schema/playbook";
import { ConditionGroupEditor } from "./ConditionGroupEditor";
import { OptionsListEditor } from "./OptionsListEditor";
import { BRIEF_SECTION_KEYS, BRIEF_SECTION_LABELS } from "./briefSectionLabels";
import type { FieldSummary } from "./fieldSummaries";
import { slugify, uniqueSlug } from "./slug";

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
  "inspiration_photo",
];

const makeOption = (value: string, label: string) => ({ value, label });

export function FieldEditor({
  field,
  fields,
  onChangeType,
  onPatch,
  onRemove,
}: {
  field: PlaybookField;
  fields: FieldSummary[];
  onChangeType: (type: PlaybookFieldType) => void;
  onPatch: (patch: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  const otherKeys = fields.filter((f) => f.key !== field.key).map((f) => f.key);
  const conditionFields = fields.filter((f) => f.key !== field.key);
  const hasBriefMapping = field.briefMapping !== undefined;

  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <input
          value={field.label}
          onChange={(e) => {
            const nextLabel = e.target.value;
            const wasAutoKey = field.key === slugify(field.label);
            onPatch({
              label: nextLabel,
              ...(wasAutoKey ? { key: uniqueSlug(nextLabel, otherKeys) } : {}),
            });
          }}
          placeholder="Label"
          className="rounded-md border border-input bg-background px-2 py-1 text-xs sm:col-span-2"
        />
        <input
          value={field.key}
          onChange={(e) => onPatch({ key: e.target.value })}
          placeholder="key"
          className="rounded-md border border-input bg-background px-2 py-1 text-xs font-mono"
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
          <option value="required">Required</option>
          <option value="recommended">Recommended</option>
          <option value="optional">Optional</option>
        </select>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={field.allowNotSure ?? false}
            onChange={(e) => onPatch({ allowNotSure: e.target.checked })}
          />
          Allow "Not sure"
        </label>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
        >
          Remove field
        </button>
      </div>

      <input
        value={field.helpText ?? ""}
        onChange={(e) => onPatch({ helpText: e.target.value })}
        placeholder="Help text"
        className="mt-2 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
      />

      {(field.type === "single_choice" || field.type === "multi_choice") && (
        <div className="mt-2">
          <label className="text-xs text-muted-foreground">Options</label>
          <div className="mt-1">
            <OptionsListEditor<FieldOption>
              options={field.options}
              onChange={(next) => onPatch({ options: next })}
              makeOption={makeOption}
              renderExtra={(option, onPatchOption) => (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <input
                    value={option.reassurance ?? ""}
                    onChange={(e) => onPatchOption({ reassurance: e.target.value })}
                    placeholder="Reassurance text (optional)"
                    className="rounded-md border border-input bg-background px-2 py-1"
                  />
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={option.isNotSure ?? false}
                      onChange={(e) => onPatchOption({ isNotSure: e.target.checked })}
                    />
                    Is the "Not sure" answer
                  </label>
                </div>
              )}
            />
          </div>
        </div>
      )}

      {field.type === "timeline" && (
        <div className="mt-2">
          <label className="text-xs text-muted-foreground">Options</label>
          <div className="mt-1">
            <OptionsListEditor<(typeof field)["options"][number]>
              options={field.options}
              onChange={(next) => onPatch({ options: next })}
              makeOption={makeOption}
              renderExtra={(option, onPatchOption) => (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <select
                    value={option.urgency ?? ""}
                    onChange={(e) =>
                      onPatchOption({ urgency: (e.target.value || undefined) as "high" | "normal" | undefined })
                    }
                    className="rounded-md border border-input bg-background px-2 py-1"
                  >
                    <option value="">Urgency: none</option>
                    <option value="normal">Urgency: normal</option>
                    <option value="high">Urgency: high</option>
                  </select>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={option.isNotSure ?? false}
                      onChange={(e) => onPatchOption({ isNotSure: e.target.checked })}
                    />
                    Is the "Not sure" answer
                  </label>
                </div>
              )}
            />
          </div>
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
        <div className="mt-2 space-y-2">
          <select
            value={field.mode}
            onChange={(e) => onPatch({ mode: e.target.value })}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          >
            <option value="ranges">Ranges</option>
            <option value="numeric">Free amount</option>
          </select>
          {field.mode === "ranges" ? (
            <OptionsListEditor
              options={field.ranges ?? []}
              onChange={(next) => onPatch({ ranges: next })}
              makeOption={makeOption}
            />
          ) : (
            <input
              value={field.currency}
              onChange={(e) => onPatch({ currency: e.target.value })}
              placeholder="Currency"
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
            placeholder="Max number of photos"
            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
          <input
            type="number"
            value={field.maxFileSizeMb}
            onChange={(e) => onPatch({ maxFileSizeMb: Number(e.target.value) })}
            placeholder="Max size (MB)"
            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
          <input
            defaultValue={field.acceptMimeTypes.join(",")}
            onBlur={(e) =>
              onPatch({ acceptMimeTypes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
            }
            placeholder="image/jpeg,image/png"
            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
        </div>
      )}

      {field.type === "inspiration_photo" && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input
            type="number"
            value={field.maxFileSizeMb}
            onChange={(e) => onPatch({ maxFileSizeMb: Number(e.target.value) })}
            placeholder="Max size (MB)"
            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
          <input
            defaultValue={field.acceptMimeTypes.join(",")}
            onBlur={(e) =>
              onPatch({ acceptMimeTypes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
            }
            placeholder="image/jpeg,image/png,image/webp"
            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
          <p className="text-xs text-muted-foreground sm:col-span-2">
            The visitor uploads an image; the AI proposes assumptions (style, materials, shape, elements) that the
            visitor confirms or corrects. Always presented as an assumption, never as a certainty.
          </p>
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

      <details className="mt-3 rounded-md border border-border bg-muted/20 p-2">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
          Display condition
        </summary>
        <div className="mt-2">
          <ConditionGroupEditor
            group={field.displayWhen}
            onChange={(next) => onPatch({ displayWhen: next })}
            fields={conditionFields}
            emptyHint="This field is always shown (no condition)."
          />
        </div>
      </details>

      {field.type !== "inspiration_photo" && (
      <details className="mt-2 rounded-md border border-border bg-muted/20 p-2">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
          Mapping to the Commercial Dossier
        </summary>
        <div className="mt-2 space-y-2">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={hasBriefMapping}
              onChange={(e) =>
                onPatch({
                  briefMapping: e.target.checked
                    ? { section: "confirmedInformation", label: field.label, format: "raw" }
                    : undefined,
                })
              }
            />
            Include this field's answer in the Commercial Dossier
          </label>
          {field.briefMapping && (
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                value={field.briefMapping.section}
                onChange={(e) => onPatch({ briefMapping: { ...field.briefMapping, section: e.target.value } })}
                className="rounded-md border border-input bg-background px-2 py-1 text-xs"
              >
                {BRIEF_SECTION_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {BRIEF_SECTION_LABELS[key]}
                  </option>
                ))}
              </select>
              <input
                value={field.briefMapping.label}
                onChange={(e) => onPatch({ briefMapping: { ...field.briefMapping, label: e.target.value } })}
                placeholder="Label in the Dossier"
                className="rounded-md border border-input bg-background px-2 py-1 text-xs"
              />
              <input
                value={field.briefMapping.category ?? ""}
                onChange={(e) =>
                  onPatch({ briefMapping: { ...field.briefMapping, category: e.target.value || undefined } })
                }
                placeholder="Category (optional)"
                className="rounded-md border border-input bg-background px-2 py-1 text-xs"
              />
              <select
                value={field.briefMapping.format}
                onChange={(e) => onPatch({ briefMapping: { ...field.briefMapping, format: e.target.value } })}
                className="rounded-md border border-input bg-background px-2 py-1 text-xs"
              >
                <option value="raw">Raw value</option>
                <option value="join_comma">Comma-separated list</option>
                {"options" in field && <option value="option_label">Label of the selected option</option>}
              </select>
              <label className="flex items-center gap-2 text-xs sm:col-span-2">
                <input
                  type="checkbox"
                  checked={field.briefMapping.includeIfEmpty ?? false}
                  onChange={(e) =>
                    onPatch({ briefMapping: { ...field.briefMapping, includeIfEmpty: e.target.checked } })
                  }
                />
                Include even if the answer is empty
              </label>
            </div>
          )}
        </div>
      </details>
      )}
    </div>
  );
}
