/**
 * Adaptateur Sendcloud API v3, d'après la documentation publique (sendcloud.dev, consultée le
 * 1er octobre 2026) : `POST /shipments/announce` (création synchrone, `external_reference_id`
 * unique — un doublon renvoie 409 avec l'envoi existant), `GET /shipments?external_reference_id=`,
 * `POST /shipments/{id}/cancel` (200 annulé, 202 en file, 409 refusé ; jamais garanti).
 *
 * NON ACTIVÉ : aucun point d'entrée ne l'appelle, et il refuse de s'instancier sans clés.
 * Une étiquette ordinaire peut être facturée dès sa création : aucun appel réel sans accord.
 * Jamais testé contre l'API réelle (aucune clé disponible) ; tests sur réponses simulées.
 */
import type { CancelOutcome, CreateOutcome, LabelProvider, LabelRequest, PostalParty, ProviderLabel } from "./labelProvider";

const BASE = "https://panel.sendcloud.sc/api/v3";
type Fetch = typeof fetch;

interface ShipmentJson {
  id?: string;
  carrier?: { code?: string } | null;
  label_file?: string | null;
  parcels?: { id?: number | string; tracking_number?: string | null; status?: { code?: string; message?: string } | null;
    documents?: { type?: string; link?: string }[] }[];
}

const party = (p: PostalParty) => ({
  name: p.name, address_line_1: p.addressLine1, ...(p.addressLine2 ? { address_line_2: p.addressLine2 } : {}),
  postal_code: p.postalCode, city: p.city, country_code: p.countryCode,
  ...(p.email ? { email: p.email } : {}), ...(p.phone ? { phone_number: p.phone } : {}),
});

export function announceBody(request: LabelRequest) {
  const [length, width, height] = request.parcel.dimensionsMm;
  return {
    external_reference_id: request.reference,
    from_address: party(request.from),
    to_address: party(request.to),
    ship_with: { type: "shipping_option_code", properties: { shipping_option_code: request.shippingOptionCode } },
    parcels: [{ weight: { value: String(request.parcel.weightGrams), unit: "g" },
      dimensions: { length: String(length), width: String(width), height: String(height), unit: "mm" } }],
  };
}

export function createSendcloudProvider(options: { publicKey: string; secretKey: string; fetchImpl?: Fetch; timeoutMs?: number }): LabelProvider {
  if (!options.publicKey || !options.secretKey) throw new Error("sendcloud_keys_missing");
  const fetchImpl = options.fetchImpl ?? fetch;
  const auth = `Basic ${btoa(`${options.publicKey}:${options.secretKey}`)}`;
  const call = async (path: string, init: RequestInit = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 20000);
    try {
      return await fetchImpl(`${BASE}${path}`, { ...init, signal: controller.signal,
        headers: { Authorization: auth, Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}) } });
    } finally { clearTimeout(timer); }
  };

  const toLabel = (shipment: ShipmentJson): ProviderLabel | null => {
    const parcel = shipment.parcels?.[0];
    if (!parcel?.id || !parcel.tracking_number || !shipment.carrier?.code) return null;
    const link = parcel.documents?.find((d) => d.type === "label")?.link;
    return {
      provider: "sendcloud", labelId: String(parcel.id), carrier: shipment.carrier.code, tracking: parcel.tracking_number,
      chargedTtcCents: null, // le montant facturé vient de la facture Sendcloud, pas de la création
      status: parcel.status?.code ? { code: parcel.status.code, message: parcel.status.message ?? "" } : null,
      pdf: async () => {
        if (shipment.label_file) return Uint8Array.from(atob(shipment.label_file), (c) => c.charCodeAt(0));
        if (!link || !link.startsWith("https://")) throw new Error("label_link_missing");
        const response = await fetchImpl(link, { headers: { Authorization: auth } });
        if (!response.ok) throw new Error(`label_download_${response.status}`);
        return new Uint8Array(await response.arrayBuffer());
      },
    };
  };

  const find = async (reference: string): Promise<ProviderLabel | null | "unknown"> => {
    try {
      const response = await call(`/shipments?external_reference_id=${encodeURIComponent(reference)}`);
      if (!response.ok) return "unknown";
      const body = (await response.json()) as { data?: ShipmentJson[] };
      const shipment = body.data?.[0];
      if (!shipment) return null;
      return toLabel(shipment) ?? "unknown";
    } catch { return "unknown"; }
  };

  return {
    name: "sendcloud",
    async create(request): Promise<CreateOutcome> {
      let response: Response;
      try {
        response = await call("/shipments/announce", { method: "POST", body: JSON.stringify(announceBody(request)) });
      } catch { return { kind: "ambiguous", code: "network_or_timeout" }; }
      if (response.ok || response.status === 409) {
        try {
          const label = toLabel(((await response.json()) as { data?: ShipmentJson }).data ?? {});
          return label ? { kind: "created", label } : { kind: "ambiguous", code: "incomplete_response" };
        } catch { return { kind: "ambiguous", code: "unreadable_response" }; }
      }
      if (response.status === 400 || response.status === 422) return { kind: "rejected", code: `http_${response.status}` };
      if (response.status === 401 || response.status === 403 || response.status === 429) return { kind: "not_created", code: `http_${response.status}` };
      return { kind: "ambiguous", code: `http_${response.status}` };
    },
    findByReference: find,
    async cancel(reference): Promise<CancelOutcome> {
      let shipmentId: string | undefined;
      try {
        const response = await call(`/shipments?external_reference_id=${encodeURIComponent(reference)}`);
        if (!response.ok) return { kind: "ambiguous", code: `lookup_${response.status}` };
        shipmentId = ((await response.json()) as { data?: ShipmentJson[] }).data?.[0]?.id;
      } catch { return { kind: "ambiguous", code: "lookup_failed" }; }
      if (!shipmentId) return { kind: "refused", code: "shipment_not_found" };
      try {
        const response = await call(`/shipments/${encodeURIComponent(shipmentId)}/cancel`, { method: "POST" });
        if (response.status === 200) return { kind: "cancelled", reference: shipmentId };
        if (response.status === 202) return { kind: "queued", reference: shipmentId };
        if (response.status === 404 || response.status === 409) return { kind: "refused", code: `http_${response.status}` };
        return { kind: "ambiguous", code: `http_${response.status}` };
      } catch { return { kind: "ambiguous", code: "network_or_timeout" }; }
    },
  };
}
