/**
 * Demander une décision au client — pour l'atelier et pour Ma Reliure.
 *
 * Le formulaire suit la forme de la question : des options illustrées pour une
 * couleur ou un papier, des lignes à dorer pour un titrage. Il ne demande
 * jamais de montant : un choix qui changerait le prix est un imprévu.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { requestProjectDecision } from "@/marketplace/services/projectThread.functions";
import {
  DECISION_TYPE_LABELS,
  DECISION_TYPES,
  GILDING_POSITIONS,
  MAX_DECISION_OPTIONS,
  validateDecisionRequest,
  type DecisionType,
} from "@/marketplace/project/decisions";
import { PROJECT_FILES_PER_ITEM } from "@/marketplace/project/thread";
import { PROJECT_FILE_ACCEPT, useProjectUpload } from "./useProjectUpload";

const PLACEHOLDERS: Partial<Record<DecisionType, string>> = {
  COLOR: "Quelle couleur de cuir préférez-vous ?",
  PAPER: "Quel papier souhaitez-vous pour les gardes ?",
  GILDING_TEXT: "Pouvez-vous confirmer le texte à dorer ?",
  MATERIAL: "Quelle matière préférez-vous ?",
};

interface OptionDraft {
  label: string;
  description: string;
  files: File[];
}

const fieldClass =
  "mt-1 block w-full rounded-[2px] border border-mr-rule-strong bg-white px-3 py-2 text-[0.9375rem] text-mr-ink";

export function DecisionRequestForm({
  caseId,
  onCreated,
}: {
  caseId: string;
  onCreated: () => Promise<unknown>;
}) {
  const request = useServerFn(requestProjectDecision);
  const upload = useProjectUpload(caseId);
  const [type, setType] = useState<DecisionType>("COLOR");
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState<OptionDraft[]>([
    { label: "", description: "", files: [] },
    { label: "", description: "", files: [] },
  ]);
  const [lines, setLines] = useState([
    { position: "Titre", text: "" },
    { position: "Auteur", text: "" },
  ]);
  const [allowFreeText, setAllowFreeText] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const gilding = type === "GILDING_TEXT";

  const draft = {
    decisionType: type,
    question,
    description: description.trim() || null,
    options: gilding
      ? []
      : options.map((option) => ({
          label: option.label,
          description: option.description.trim() || null,
        })),
    gildingText: gilding
      ? { lines: lines.map((line) => ({ position: line.position, text: line.text.trim() })) }
      : null,
    allowFreeText,
  };
  const errors = validateDecisionRequest(draft);

  const submit = useMutation({
    mutationFn: async () => {
      const uploaded: string[][] = [];
      for (const option of gilding ? [] : options) uploaded.push(await upload(option.files));
      return request({
        data: {
          caseId,
          ...draft,
          options: gilding
            ? []
            : draft.options.map((option, index) => ({ ...option, files: uploaded[index] ?? [] })),
          supersedesDecisionId: null,
        },
      });
    },
    onMutate: () => setProblem(null),
    onSuccess: async () => {
      setQuestion("");
      setDescription("");
      setOptions([
        { label: "", description: "", files: [] },
        { label: "", description: "", files: [] },
      ]);
      setLines([
        { position: "Titre", text: "" },
        { position: "Auteur", text: "" },
      ]);
      await onCreated();
    },
    onError: (error: Error) => setProblem(error.message),
  });

  return (
    <form
      className="space-y-4 border border-mr-rule bg-white p-4 sm:p-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (errors.length === 0) submit.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
        <label className="mr-small text-mr-ink">
          Type de décision
          <select
            className={fieldClass}
            value={type}
            onChange={(event) => setType(event.target.value as DecisionType)}
          >
            {DECISION_TYPES.map((value) => (
              <option key={value} value={value}>
                {DECISION_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="mr-small text-mr-ink">
          Question posée au client
          <input
            className={fieldClass}
            maxLength={300}
            value={question}
            placeholder={PLACEHOLDERS[type] ?? "Que souhaitez-vous ?"}
            onChange={(event) => setQuestion(event.target.value)}
          />
        </label>
      </div>
      <label className="mr-small block text-mr-ink">
        Précision (facultative)
        <textarea
          className={fieldClass}
          rows={2}
          maxLength={2000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>

      {gilding ? (
        <fieldset className="space-y-2">
          <legend className="mr-small font-semibold text-mr-ink">
            Texte à dorer, ligne par ligne
          </legend>
          {lines.map((line, index) => (
            <div key={index} className="grid grid-cols-[8rem_1fr_auto] gap-2">
              <select
                aria-label={`Emplacement de la ligne ${index + 1}`}
                className={fieldClass}
                value={line.position}
                onChange={(event) =>
                  setLines(
                    lines.map((item, position) =>
                      position === index ? { ...item, position: event.target.value } : item,
                    ),
                  )
                }
              >
                {GILDING_POSITIONS.map((position) => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
              </select>
              <input
                aria-label={`Texte de la ligne ${index + 1}`}
                className={`${fieldClass} font-serif tracking-[0.05em]`}
                maxLength={120}
                value={line.text}
                placeholder="LES MISÉRABLES"
                onChange={(event) =>
                  setLines(
                    lines.map((item, position) =>
                      position === index ? { ...item, text: event.target.value } : item,
                    ),
                  )
                }
              />
              <button
                type="button"
                className="mr-small px-2 text-mr-muted"
                aria-label="Retirer la ligne"
                disabled={lines.length === 1}
                onClick={() => setLines(lines.filter((_, position) => position !== index))}
              >
                ×
              </button>
            </div>
          ))}
          {lines.length < 8 && (
            <button
              type="button"
              className="mr-link mr-small"
              onClick={() => setLines([...lines, { position: "Tomaison", text: "" }])}
            >
              Ajouter une ligne
            </button>
          )}
          <p className="mr-meta">
            Le client verra ce texte tel quel, avec une demande de vérification de l'orthographe, et
            pourra signaler une correction.
          </p>
        </fieldset>
      ) : (
        <fieldset className="space-y-3">
          <legend className="mr-small font-semibold text-mr-ink">Options proposées</legend>
          {options.map((option, index) => (
            <div
              key={index}
              className="grid gap-2 border-t border-mr-rule pt-3 sm:grid-cols-[1fr_1fr_auto]"
            >
              <input
                aria-label={`Option ${index + 1}`}
                className={fieldClass}
                maxLength={80}
                placeholder={index === 0 ? "Bordeaux" : index === 1 ? "Cognac" : "Autre option"}
                value={option.label}
                onChange={(event) =>
                  setOptions(
                    options.map((item, position) =>
                      position === index ? { ...item, label: event.target.value } : item,
                    ),
                  )
                }
              />
              <input
                aria-label={`Précision de l'option ${index + 1}`}
                className={fieldClass}
                maxLength={300}
                placeholder="Précision (facultative)"
                value={option.description}
                onChange={(event) =>
                  setOptions(
                    options.map((item, position) =>
                      position === index ? { ...item, description: event.target.value } : item,
                    ),
                  )
                }
              />
              <div className="flex items-center gap-2">
                <label className="mr-small cursor-pointer border border-mr-rule px-2 py-2 text-mr-ink hover:border-mr-ink">
                  <input
                    type="file"
                    className="sr-only"
                    accept={PROJECT_FILE_ACCEPT}
                    multiple
                    onChange={(event) => {
                      const chosen = [...(event.target.files ?? [])];
                      setOptions(
                        options.map((item, position) =>
                          position === index
                            ? {
                                ...item,
                                files: [...item.files, ...chosen].slice(0, PROJECT_FILES_PER_ITEM),
                              }
                            : item,
                        ),
                      );
                      event.target.value = "";
                    }}
                  />
                  Photo{option.files.length > 0 ? ` (${option.files.length})` : ""}
                </label>
                <button
                  type="button"
                  className="mr-small px-2 text-mr-muted"
                  aria-label="Retirer l'option"
                  disabled={options.length === 1}
                  onClick={() => setOptions(options.filter((_, position) => position !== index))}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          {options.length < MAX_DECISION_OPTIONS && (
            <button
              type="button"
              className="mr-link mr-small"
              onClick={() => setOptions([...options, { label: "", description: "", files: [] }])}
            >
              Ajouter une option
            </button>
          )}
          <label className="mr-small flex items-center gap-2 text-mr-ink">
            <input
              type="checkbox"
              checked={allowFreeText}
              onChange={(event) => setAllowFreeText(event.target.checked)}
            />
            Le client peut répondre autre chose
          </label>
        </fieldset>
      )}

      {question.trim() !== "" && errors.length > 0 && (
        <p className="mr-small text-mr-bordeaux">{errors[0]}</p>
      )}
      {problem && (
        <p role="alert" className="mr-small text-mr-bordeaux">
          {problem}
        </p>
      )}
      <button
        type="submit"
        disabled={errors.length > 0 || submit.isPending}
        className="mr-tap rounded-[2px] bg-mr-ink px-5 py-2.5 text-[0.9375rem] font-semibold text-mr-paper hover:bg-mr-walnut disabled:opacity-40"
      >
        {submit.isPending ? "Envoi…" : "Demander la décision au client"}
      </button>
    </form>
  );
}
