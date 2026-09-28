import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  appendWorkLogistics,
  readWorkLogistics,
  uploadLogisticsPhoto,
} from "@/marketplace/services/workLogistics.data.functions";
import {
  logisticsActions,
  logisticsLabels,
  type LogisticsEvent,
  type LogisticsJournal,
  type LogisticsKind,
} from "@/marketplace/works/logistics";
import { CARD, ErrorNote, PRIMARY_BUTTON } from "../quotes/quoteUi";

export function LogisticsPanel({ workId }: { workId: string }) {
  const read = useServerFn(readWorkLogistics),
    append = useServerFn(appendWorkLogistics),
    upload = useServerFn(uploadLogisticsPhoto);
  const cache = useQueryClient();
  const key = ["work-logistics", workId];
  const query = useQuery({
    queryKey: key,
    queryFn: () => read({ data: { workId } }),
    refetchInterval: 45000,
  });
  const mutation = useMutation({
    mutationFn: async (data: Entry) => append({ data }),
    onSettled: () => cache.invalidateQueries({ queryKey: key }),
  });
  const photo = useMutation({
    mutationFn: async ({ eventId, file }: { eventId: string; file: File }) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5242880)
        throw new Error("Photo JPEG, PNG ou WebP de 5 Mo maximum requise.");
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      return upload({ data: { workId, eventId, base64 } });
    },
    onSettled: () => cache.invalidateQueries({ queryKey: key }),
  });
  return (
    <section className={CARD} aria-label="Logistique de l’ouvrage">
      <h2 className="font-serif text-xl">Trajet et réception de l’ouvrage</h2>
      <p className="my-3 text-sm text-muted-foreground">
        Suivi manuel déclaré par l’atelier. Aucun achat de transport ni paiement. « Livré » selon le
        transporteur ne vaut pas réception physique à l’atelier.
      </p>
      {query.isPending ? (
        <p role="status">Chargement du suivi…</p>
      ) : query.isError ? (
        <ErrorNote>
          Impossible de charger le suivi.{" "}
          <button onClick={() => void query.refetch()} className="underline">
            Réessayer
          </button>
        </ErrorNote>
      ) : (
        <LogisticsEditor
          workId={workId}
          journal={query.data}
          pending={mutation.isPending}
          save={async (data) => {
            await mutation.mutateAsync(data);
          }}
          upload={async (eventId, file) => {
            await photo.mutateAsync({ eventId, file });
          }}
          uploading={photo.isPending}
        />
      )}
      {(mutation.isError || photo.isError) && (
        <ErrorNote>
          Enregistrement non confirmé. Rechargez le suivi avant de réessayer. Vérifiez le constat,
          la preuve et les photos (JPEG/PNG/WebP, 5 Mo maximum).
        </ErrorNote>
      )}
    </section>
  );
}

type Entry = {
  workId: string;
  id: string;
  version: number;
  kind: LogisticsKind;
  details: LogisticsEvent["details"];
};
export function LogisticsEditor({
  workId,
  journal,
  pending,
  save,
  upload,
  uploading,
}: {
  workId: string;
  journal: LogisticsJournal;
  pending: boolean;
  save: (entry: Entry) => Promise<void>;
  upload: (eventId: string, file: File) => Promise<void>;
  uploading: boolean;
}) {
  const [selected, setSelected] = useState<LogisticsKind>("outbound");
  const [mode, setMode] = useState<"parcel" | "hand">("parcel");
  const [condition, setCondition] = useState<"consistent" | "difference">("consistent");
  const [carrier, setCarrier] = useState(""),
    [tracking, setTracking] = useState(""),
    [description, setDescription] = useState(""),
    [proof, setProof] = useState("");
  const [error, setError] = useState("");
  const request = useRef<{ fingerprint: string; id: string } | null>(null);
  const actions = logisticsActions(journal.events);
  const kind = actions.includes(selected) ? selected : actions[0];
  const shipping = kind === "outbound" || kind === "return";
  const needsProof = kind === "completed" || kind === "carrier_delivered";
  const needsDescription =
    kind === "incident" || kind === "note" || (kind === "received" && condition === "difference");
  const field = "block w-full min-w-0 rounded-md border border-border bg-background p-3 text-base";
  async function submit() {
    setError("");
    const details: LogisticsEvent["details"] = {};
    if (shipping) {
      details.mode = mode;
      if (mode === "parcel") {
        details.carrier = carrier.trim();
        details.tracking = tracking.trim();
      }
    }
    if (kind === "received") details.condition = condition;
    if (description.trim()) details.description = description.trim();
    if (needsProof) details.proof = proof.trim();
    if (
      (shipping && mode === "parcel" && (!carrier.trim() || !tracking.trim())) ||
      (needsProof && proof.trim().length < 8) ||
      (needsDescription && description.trim().length < 8)
    ) {
      setError(
        "Renseignez les champs obligatoires (description et preuve : 8 caractères minimum).",
      );
      return;
    }
    const payload = { workId, version: journal.events.at(-1)?.sequence ?? 0, kind, details };
    const fingerprint = JSON.stringify(payload);
    if (request.current?.fingerprint !== fingerprint)
      request.current = { fingerprint, id: crypto.randomUUID() };
    try {
      await save({ ...payload, id: request.current.id });
      request.current = null;
      setDescription("");
      setProof("");
      setCarrier("");
      setTracking("");
    } catch {
      setError("Action non confirmée. Relisez l’historique avant de réessayer.");
    }
  }
  return (
    <div className="min-w-0 space-y-5">
      <ol className="space-y-3" aria-label="Historique logistique">
        {journal.events.map((event) => (
          <li
            key={event.id}
            className="min-w-0 rounded border border-border p-3 text-sm [overflow-wrap:anywhere]"
          >
            <strong>{logisticsLabels[event.kind]}</strong>
            <time className="block text-muted-foreground" dateTime={event.created_at}>
              {new Date(event.created_at).toLocaleString("fr-FR")}
            </time>
            {event.details.mode && (
              <p>{event.details.mode === "parcel" ? "Colis suivi" : "Remise en main propre"}</p>
            )}
            {event.details.carrier && (
              <p>
                {event.details.carrier} · {event.details.tracking}
              </p>
            )}
            {event.details.condition && (
              <p>
                {event.details.condition === "difference"
                  ? "Écart constaté à la réception"
                  : "État conforme au constat attendu"}
              </p>
            )}
            {event.details.description && (
              <p className="whitespace-pre-wrap">{event.details.description}</p>
            )}
            {event.details.proof && <p>Référence de preuve : {event.details.proof}</p>}
            {event.kind === "completed" && (
              <p>Déclaration de l’atelier ; ce n’est pas une confirmation donnée par le client.</p>
            )}
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {event.photos.map((photo) =>
                photo.url ? (
                  <a href={photo.url} key={photo.id} target="_blank" rel="noreferrer">
                    <img
                      src={photo.url}
                      alt={`Photo privée — ${logisticsLabels[event.kind]}`}
                      className="aspect-square w-full rounded object-cover"
                    />
                  </a>
                ) : (
                  <span key={photo.id}>Photo temporairement indisponible</span>
                ),
              )}
            </div>
            {["received", "incident"].includes(event.kind) && event.photos.length < 8 && (
              <label className="mt-3 block">
                Ajouter une photo privée (5 Mo max., 8 par constat)
                <input
                  className="block w-full min-w-0 py-2"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file)
                      void upload(event.id, file).catch(() =>
                        setError(
                          "Photo non confirmée. Vérifiez l’historique avant un nouvel envoi.",
                        ),
                      );
                  }}
                />
              </label>
            )}
          </li>
        ))}
      </ol>
      {!journal.events.length && <p>Aucun trajet enregistré.</p>}
      <fieldset disabled={pending} className="min-w-0 space-y-3">
        <legend className="font-medium">Ajouter un événement — l’historique est conservé</legend>
        <label className="block">
          Action
          <select
            className={field}
            value={kind}
            onChange={(e) => setSelected(e.target.value as LogisticsKind)}
          >
            {actions.map((action) => (
              <option key={action} value={action}>
                {logisticsLabels[action]}
              </option>
            ))}
          </select>
        </label>
        {shipping && (
          <>
            <label className="block">
              Mode
              <select
                className={field}
                value={mode}
                onChange={(e) => setMode(e.target.value as "parcel" | "hand")}
              >
                <option value="parcel">Colis suivi</option>
                <option value="hand">Remise en main propre</option>
              </select>
            </label>
            {mode === "parcel" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  Transporteur *
                  <input
                    className={field}
                    maxLength={120}
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                  />
                </label>
                <label>
                  Numéro de suivi *
                  <input
                    className={field}
                    maxLength={200}
                    value={tracking}
                    onChange={(e) => setTracking(e.target.value)}
                  />
                </label>
              </div>
            )}
          </>
        )}
        {kind === "received" && (
          <label className="block">
            État à la réception
            <select
              className={field}
              value={condition}
              onChange={(e) => setCondition(e.target.value as "consistent" | "difference")}
            >
              <option value="consistent">Conforme au constat attendu</option>
              <option value="difference">Écart constaté — description obligatoire</option>
            </select>
          </label>
        )}
        <label className="block">
          Description {needsDescription ? "*" : "(facultative)"}
          <textarea
            className={field}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {needsProof && (
          <label className="block">
            Référence de preuve *
            <input
              className={field}
              maxLength={500}
              value={proof}
              onChange={(e) => setProof(e.target.value)}
            />
          </label>
        )}
        {kind === "completed" && (
          <p className="text-sm">
            Vous déclarez la remise au client avec votre référence de preuve. Le client ne confirme
            rien sur cet écran.
          </p>
        )}
        <button className={PRIMARY_BUTTON} type="button" onClick={() => void submit()}>
          {pending ? "Enregistrement…" : "Enregistrer la déclaration"}
        </button>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
