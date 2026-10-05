import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getWorkTransportOrders,
  appendWorkLogistics,
  readWorkLogistics,
  uploadLogisticsPhoto,
} from "@/marketplace/services/workLogistics.data.functions";
import {
  logisticsActions,
  type LogisticsEvent,
  type LogisticsJournal,
  type LogisticsKind,
} from "@/marketplace/works/logistics";
import { CARD, ErrorNote, PRIMARY_BUTTON } from "../quotes/quoteUi";
import { useFineBinderyWorkspace } from "@/marketplace/i18n/FineBinderyWorkspaceContext";
import { logisticsCopy } from "@/marketplace/works/logisticsCopy";
import { isNoWorkshopError } from "@/marketplace/i18n/noWorkshopCopy";
import { NoWorkshopNotice } from "../NoWorkshopNotice";

export function LogisticsPanel({ workId }: { workId: string }) {
  const { locale } = useFineBinderyWorkspace();
  const t = logisticsCopy[locale];
  const read = useServerFn(readWorkLogistics),
    append = useServerFn(appendWorkLogistics),
    upload = useServerFn(uploadLogisticsPhoto);
  const loadOrders = useServerFn(getWorkTransportOrders);
  const orders = useQuery({
    queryKey: ["work-transport-orders", workId],
    queryFn: () => loadOrders({ data: { workId } }),
  });
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
        throw new Error(t.photoRequirements);
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
    <section className={CARD} aria-label={t.region}>
      <h2 className="font-serif text-xl">{t.title}</h2>
      <p className="my-3 text-sm text-muted-foreground">{t.introduction}</p>
      {query.isPending ? (
        <p role="status">{t.loading}</p>
      ) : query.isError && isNoWorkshopError(query.error) ? (
        <NoWorkshopNotice />
      ) : query.isError ? (
        <ErrorNote>
          {t.loadError}{" "}
          <button onClick={() => void query.refetch()} className="underline">
            {t.retry}
          </button>
        </ErrorNote>
      ) : (
        <LogisticsEditor
          workId={workId}
          journal={query.data}
          transportOrders={orders.data}
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
      {(mutation.isError || photo.isError) && <ErrorNote>{t.saveError}</ErrorNote>}
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
  transportOrders,
}: {
  workId: string;
  journal: LogisticsJournal;
  pending: boolean;
  save: (entry: Entry) => Promise<void>;
  upload: (eventId: string, file: File) => Promise<void>;
  uploading: boolean;
  transportOrders?: {
    ownClient: boolean;
    invoices: { id: string; invoice_number: string | null }[];
  };
}) {
  const { locale } = useFineBinderyWorkspace();
  const t = logisticsCopy[locale];
  const [invoiceId, setInvoiceId] = useState("");
  const [payer, setPayer] = useState<"customer" | "workshop">("customer");
  const [cost, setCost] = useState("");
  const [coverage, setCoverage] = useState("");
  const [selected, setSelected] = useState<LogisticsKind>("outbound");
  const [mode, setMode] = useState<"parcel" | "hand">("parcel");
  const [condition, setCondition] = useState<"consistent" | "difference">("consistent");
  const [carrier, setCarrier] = useState(""),
    [tracking, setTracking] = useState(""),
    [description, setDescription] = useState(""),
    [proof, setProof] = useState("");
  const [error, setError] = useState<"invalid" | "actionUnconfirmed" | "photoUnconfirmed" | null>(
    null,
  );
  const request = useRef<{ fingerprint: string; id: string } | null>(null);
  const actions = logisticsActions(journal.events);
  const kind = actions.includes(selected) ? selected : actions[0];
  const shipping = kind === "outbound" || kind === "return";
  const needsProof = kind === "completed" || kind === "carrier_delivered";
  const needsDescription =
    kind === "incident" || kind === "note" || (kind === "received" && condition === "difference");
  const field = "block w-full min-w-0 rounded-md border border-border bg-background p-3 text-base";
  async function submit() {
    setError(null);
    const details: LogisticsEvent["details"] = {};
    if (shipping) {
      details.mode = mode;
      if (transportOrders?.ownClient) {
        details.invoiceId = invoiceId;
        details.payer = payer;
        if (mode === "parcel") {
          details.transportCostCents = Math.round(Number(cost.replace(",", ".")) * 100);
          details.coverageEvidence = coverage.trim();
        }
      }
      if (mode === "parcel") {
        details.carrier = carrier.trim();
        details.tracking = tracking.trim();
      }
    }
    if (kind === "received") details.condition = condition;
    if (description.trim()) details.description = description.trim();
    if (needsProof) details.proof = proof.trim();
    if (
      (shipping &&
        transportOrders?.ownClient &&
        (!invoiceId || (mode === "parcel" && (!cost.trim() || !coverage.trim())))) ||
      (shipping && mode === "parcel" && (!carrier.trim() || !tracking.trim())) ||
      (needsProof && proof.trim().length < 8) ||
      (needsDescription && description.trim().length < 8)
    ) {
      setError("invalid");
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
      setError("actionUnconfirmed");
    }
  }
  return (
    <div className="min-w-0 space-y-5">
      <ol className="space-y-3" aria-label={t.history}>
        {journal.events.map((event) => (
          <li
            key={event.id}
            className="min-w-0 rounded border border-border p-3 text-sm [overflow-wrap:anywhere]"
          >
            <strong>{t.kinds[event.kind]}</strong>
            <time className="block text-muted-foreground" dateTime={event.created_at}>
              {new Date(event.created_at).toLocaleString(locale)}
            </time>
            {event.details.mode && <p>{event.details.mode === "parcel" ? t.parcel : t.hand}</p>}
            {event.details.carrier && (
              <p>
                {event.details.carrier} · {event.details.tracking}
              </p>
            )}
            {event.details.condition && (
              <p>{event.details.condition === "difference" ? t.difference : t.consistent}</p>
            )}
            {event.details.description && (
              <p className="whitespace-pre-wrap">{event.details.description}</p>
            )}
            {event.details.proof && (
              <p>
                {t.proof} : {event.details.proof}
              </p>
            )}
            {event.kind === "completed" && <p>{t.finalDeclaration}</p>}
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {event.photos.map((photo) =>
                photo.url ? (
                  <a href={photo.url} key={photo.id} target="_blank" rel="noreferrer">
                    <img
                      src={photo.url}
                      alt={`${t.privatePhoto} — ${t.kinds[event.kind]}`}
                      className="aspect-square w-full rounded object-cover"
                    />
                  </a>
                ) : (
                  <span key={photo.id}>{t.photoUnavailable}</span>
                ),
              )}
            </div>
            {["received", "incident"].includes(event.kind) && event.photos.length < 8 && (
              <label className="mt-3 block">
                {t.addPhoto}
                <input
                  className="peer sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) {
                      setError(null);
                      void upload(event.id, file).catch(() => setError("photoUnconfirmed"));
                    }
                  }}
                />
                <span className="mt-2 flex min-h-11 w-fit cursor-pointer items-center rounded border px-3 py-2 peer-focus-visible:outline peer-focus-visible:outline-2 peer-disabled:opacity-50">
                  {uploading ? t.uploading : t.choosePhoto}
                </span>
              </label>
            )}
          </li>
        ))}
      </ol>
      {!journal.events.length && <p>{t.empty}</p>}
      <fieldset disabled={pending} className="min-w-0 space-y-3">
        <legend className="font-medium">{t.addEvent}</legend>
        <label className="block">
          {t.action}
          <select
            className={field}
            value={kind}
            onChange={(e) => setSelected(e.target.value as LogisticsKind)}
          >
            {actions.map((action) => (
              <option key={action} value={action}>
                {t.kinds[action]}
              </option>
            ))}
          </select>
        </label>
        {shipping && transportOrders?.ownClient && (
          <div className="space-y-3 border p-4">
            <label className="block">
              Commande atelier
              <select
                className={field}
                value={invoiceId}
                onChange={(event) => setInvoiceId(event.target.value)}
              >
                <option value="">Choisir la facture de commande</option>
                {transportOrders.invoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoice_number}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              Payeur du transport
              <select
                className={field}
                value={payer}
                onChange={(event) => setPayer(event.target.value as "customer" | "workshop")}
              >
                <option value="customer">Client</option>
                <option value="workshop">Atelier</option>
              </select>
            </label>
            {mode === "parcel" && (
              <>
                <label className="block">
                  Coût de ce transport TTC (€)
                  <input
                    className={field}
                    type="number"
                    step="0.01"
                    min="0"
                    value={cost}
                    onChange={(event) => setCost(event.target.value)}
                  />
                </label>
                <label className="block">
                  Conditions de couverture vérifiées
                  <input
                    className={field}
                    value={coverage}
                    onChange={(event) => setCoverage(event.target.value)}
                    placeholder="Référence et limites du contrat transporteur"
                  />
                </label>
                <p className="text-sm">
                  Transport organisé par votre atelier, sans extension du forfait Oppe et sans achat
                  automatique.
                </p>
              </>
            )}
          </div>
        )}
        {shipping && (
          <>
            <label className="block">
              {t.mode}
              <select
                className={field}
                value={mode}
                onChange={(e) => setMode(e.target.value as "parcel" | "hand")}
              >
                <option value="parcel">{t.parcel}</option>
                <option value="hand">{t.hand}</option>
              </select>
            </label>
            {mode === "parcel" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  {t.carrier} *
                  <input
                    className={field}
                    maxLength={120}
                    value={carrier}
                    onChange={(e) => setCarrier(e.target.value)}
                  />
                </label>
                <label>
                  {t.tracking} *
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
            {t.condition}
            <select
              className={field}
              value={condition}
              onChange={(e) => setCondition(e.target.value as "consistent" | "difference")}
            >
              <option value="consistent">{t.expected}</option>
              <option value="difference">{t.differenceRequired}</option>
            </select>
          </label>
        )}
        <label className="block">
          {t.description} {needsDescription ? "*" : `(${t.optional})`}
          <textarea
            className={field}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {needsProof && (
          <label className="block">
            {t.proof} *
            <input
              className={field}
              maxLength={500}
              value={proof}
              onChange={(e) => setProof(e.target.value)}
            />
          </label>
        )}
        {kind === "completed" && <p className="text-sm">{t.completionHint}</p>}
        <button className={PRIMARY_BUTTON} type="button" onClick={() => void submit()}>
          {pending ? t.saving : t.save}
        </button>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t[error]}
        </p>
      )}
    </div>
  );
}
