/**
 * Adaptateur Sendcloud API v3, d'après la documentation publique (sendcloud.dev, consultée le
 * 1er octobre 2026) : `POST /shipments/announce` (création synchrone, `external_reference_id`
 * unique — un doublon renvoie 409 avec l'envoi existant), `GET /shipments?external_reference_id=`,
 * `POST /shipments/{id}/cancel` (200 annulé, 202 en file, 409 refusé ; jamais garanti).
 *
 * Branché sur roundTripAutomation.server ; les clés, l'ouverture administrative et
 * l'approbation tarifaire du trajet restent requises avant tout achat.
 * Une étiquette ordinaire peut être facturée dès sa création : aucun appel réel sans accord.
 * Jamais testé contre l'API réelle (aucune clé disponible) ; tests sur réponses simulées.
 *
 * Méthodes « Retour » (constat du 14 octobre 2026 : `/shipments/announce` les refuse) : création
 * par `POST /returns/announce-synchronously` (réponse `return_id` + `parcel_id`), puis relecture du
 * colis par `GET /api/v2/parcels/{id}` (suivi, transporteur, étiquette). L'API des retours ne permet
 * pas de retrouver un retour par référence : après une réponse ambiguë, la reprise passe par
 * l'opérateur (« illisible »), jamais par un second achat. Les webhooks relisent le colis par son id.
 */
import type { CancelOutcome, CreateOutcome, LabelProvider, LabelRequest, PostalParty, ProviderLabel } from "./labelProvider";

const BASE = "https://panel.sendcloud.sc/api/v3";
const BASE_V2 = "https://panel.sendcloud.sc/api/v2";
type Fetch = typeof fetch;

/**
 * Méthode « Retour » d'après son code Sendcloud, où la fonctionnalité figure en clair
 * (`chronopost:2shopretour/return,dropoff`, `colissimo:home/fr,return`).
 */
export function isReturnOptionCode(code: string): boolean {
  return /[/,]return(?=[,/]|$)/.test(code.trim());
}

/** Format des retours (exemple officiel) : numéro de rue à part, téléphone international. */
const returnParty = (p: PostalParty) => {
  const street = p.addressLine1.trim().match(/^(\d+[a-zA-Z]?(?:\s?(?:bis|ter))?)[\s,]+(.+)$/i);
  const phone = p.phone?.replace(/[\s.-]/g, "");
  const intl = phone && p.countryCode === "FR" ? phone.replace(/^0(?=\d{9}$)/, "+33") : phone;
  return {
    name: p.name, address_line_1: street ? street[2] : p.addressLine1, ...(street ? { house_number: street[1] } : {}),
    ...(p.addressLine2 ? { address_line_2: p.addressLine2 } : {}),
    postal_code: p.postalCode, city: p.city, country_code: p.countryCode,
    ...(p.email ? { email: p.email } : {}), ...(intl ? { phone_number: intl } : {}),
  };
};

export function returnAnnounceBody(request: LabelRequest) {
  const [length, width, height] = request.parcel.dimensionsMm;
  return {
    from_address: returnParty(request.from),
    to_address: returnParty(request.to),
    ship_with: { type: "shipping_option_code", shipping_option_code: request.shippingOptionCode },
    weight: { value: request.parcel.weightGrams, unit: "g" },
    dimensions: { length, width, height, unit: "mm" },
    collo_count: 1,
    send_tracking_emails: false,
    external_reference: request.reference,
    order_number: request.reference,
  };
}

interface ParcelV2Json {
  id?: number | string; tracking_number?: string | null; carrier?: { code?: string } | null;
  status?: { id?: number | string; message?: string } | null;
  label?: { label_printer?: string | null; normal_printer?: string[] | null } | null;
}

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
      return await fetchImpl(path.startsWith("https://") ? path : `${BASE}${path}`, { ...init, signal: controller.signal,
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

  const parcelLabel = (parcel: ParcelV2Json): ProviderLabel | null => {
    if (!parcel.id || !parcel.tracking_number || !parcel.carrier?.code) return null;
    const link = parcel.label?.label_printer ?? parcel.label?.normal_printer?.[0] ?? null;
    return {
      provider: "sendcloud", labelId: String(parcel.id), carrier: parcel.carrier.code, tracking: parcel.tracking_number,
      chargedTtcCents: null,
      status: parcel.status?.id !== undefined ? { code: String(parcel.status.id), message: parcel.status.message ?? "" } : null,
      pdf: async () => {
        if (!link || !link.startsWith("https://")) throw new Error("label_link_missing");
        const response = await fetchImpl(link, { headers: { Authorization: auth } });
        if (!response.ok) throw new Error(`label_download_${response.status}`);
        return new Uint8Array(await response.arrayBuffer());
      },
    };
  };

  /** Colis par identifiant (API v2) : `null` seulement sur un 404 franc. */
  const readParcel = async (labelId: string): Promise<ProviderLabel | null | "unknown"> => {
    try {
      const response = await call(`${BASE_V2}/parcels/${encodeURIComponent(labelId)}`);
      if (response.status === 404) return null;
      if (!response.ok) return "unknown";
      return parcelLabel(((await response.json()) as { parcel?: ParcelV2Json }).parcel ?? {}) ?? "unknown";
    } catch { return "unknown"; }
  };

  const createReturn = async (request: LabelRequest): Promise<CreateOutcome> => {
    let response: Response;
    try {
      response = await call("/returns/announce-synchronously", { method: "POST", body: JSON.stringify(returnAnnounceBody(request)) });
    } catch { return { kind: "ambiguous", code: "network_or_timeout" }; }
    if (response.status === 400 || response.status === 422) return { kind: "rejected", code: `return_http_${response.status}` };
    if (response.status === 401 || response.status === 403 || response.status === 429) return { kind: "not_created", code: `return_http_${response.status}` };
    if (!response.ok) return { kind: "ambiguous", code: `return_http_${response.status}` };
    let parcelId: string;
    try {
      const body = (await response.json()) as { parcel_id?: number | string };
      if (body.parcel_id === undefined || body.parcel_id === null) return { kind: "ambiguous", code: "return_incomplete_response" };
      parcelId = String(body.parcel_id);
    } catch { return { kind: "ambiguous", code: "return_unreadable_response" }; }
    // Le retour existe : une lecture du colis qui échoue reste ambiguë, jamais un refus (pas de second achat).
    const label = await readParcel(parcelId);
    return label && label !== "unknown" ? { kind: "created", label } : { kind: "ambiguous", code: "return_parcel_unreadable" };
  };

  const find = async (reference: string, hint?: { shippingOptionCode?: string }): Promise<ProviderLabel | null | "unknown"> => {
    // Un retour ne se recherche pas par référence : ne jamais conclure à son absence.
    if (hint?.shippingOptionCode && isReturnOptionCode(hint.shippingOptionCode)) return "unknown";
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
      if (isReturnOptionCode(request.shippingOptionCode)) return createReturn(request);
      let response: Response;
      try {
        response = await call("/shipments/announce", { method: "POST", body: JSON.stringify(announceBody(request)) });
      } catch { return { kind: "ambiguous", code: "network_or_timeout" }; }
      if (response.ok || response.status === 409) {
        try {
          const shipment = ((await response.json()) as { data?: ShipmentJson }).data ?? {};
          // Envoi créé mais refusé par le transporteur (constaté le 15/10 : téléphone invalide) : sans
          // suivi ni étiquette, il n'est pas facturé. Un échec net, pas une attente sans fin.
          if (/ANNOUNCEMENT_FAILED/i.test(shipment.parcels?.[0]?.status?.code ?? "")) return { kind: "rejected", code: "announcement_failed" };
          const label = toLabel(shipment);
          return label ? { kind: "created", label } : { kind: "ambiguous", code: "incomplete_response" };
        } catch { return { kind: "ambiguous", code: "unreadable_response" }; }
      }
      if (response.status === 400 || response.status === 422) return { kind: "rejected", code: `http_${response.status}` };
      if (response.status === 401 || response.status === 403 || response.status === 429) return { kind: "not_created", code: `http_${response.status}` };
      return { kind: "ambiguous", code: `http_${response.status}` };
    },
    findByReference: find,
    findByLabelId: readParcel,
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

/** Méthode d'expédition réellement proposée par le compte, pour un trajet donné. */
export interface ShippingOptionView {
  code: string;
  name: string;
  carrier: string;
  firstMile: string | null;
  lastMile: string | null;
  returns: boolean;
  servicePointRequired: boolean;
  chargingType: string | null;
  /** Prix total du devis Sendcloud (centimes) et sa devise ; la TVA n'est pas précisée par l'API. */
  priceCents: number | null;
  currency: string | null;
}

interface OptionJson {
  code?: string; name?: string; carrier?: { code?: string; name?: string };
  functionalities?: { first_mile?: string | null; last_mile?: string | null; returns?: boolean };
  requirements?: { is_service_point_required?: boolean };
  charging_type?: string | null;
  quotes?: { price?: { total?: { value?: string | number; currency?: string } } }[];
}

/**
 * `POST /shipping-options` (API v3) : lecture seule, aucune étiquette créée. Seuls pays, codes
 * postaux, poids et dimensions partent chez Sendcloud — jamais un nom, une rue ou un téléphone.
 */
export async function fetchSendcloudShippingOptions(
  options: { publicKey: string; secretKey: string; fetchImpl?: Fetch; timeoutMs?: number },
  query: { fromCountry: string; fromPostalCode: string; toCountry: string; toPostalCode: string;
    weightGrams: number; dimensionsMm: [number, number, number];
    /** Méthodes « Retour » seulement : Sendcloud ne les renvoie que sur demande explicite. */
    returns?: boolean },
): Promise<ShippingOptionView[] | "unavailable"> {
  if (!options.publicKey || !options.secretKey) return "unavailable";
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 20000);
  try {
    const [length, width, height] = query.dimensionsMm;
    const response = await fetchImpl(`${BASE}/shipping-options`, {
      method: "POST", signal: controller.signal,
      headers: { Authorization: `Basic ${btoa(`${options.publicKey}:${options.secretKey}`)}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        from_address: { country_code: query.fromCountry, postal_code: query.fromPostalCode },
        to_address: { country_code: query.toCountry, postal_code: query.toPostalCode },
        calculate_quotes: true,
        parcels: [{ weight: { value: String(query.weightGrams), unit: "g" },
          dimensions: { length: String(length), width: String(width), height: String(height), unit: "mm" } }],
        ...(query.returns ? { functionalities: { returns: true } } : {}),
      }),
    });
    if (!response.ok) return "unavailable";
    const body = (await response.json()) as { data?: OptionJson[] };
    return (body.data ?? []).filter((o) => o.code).map((o) => {
      const total = o.quotes?.[0]?.price?.total;
      const value = total?.value === undefined || String(total.value).trim() === "" ? null : Number(total.value);
      return {
        code: o.code!, name: o.name ?? o.code!, carrier: o.carrier?.name ?? o.carrier?.code ?? "",
        firstMile: o.functionalities?.first_mile ?? null, lastMile: o.functionalities?.last_mile ?? null,
        returns: Boolean(o.functionalities?.returns), servicePointRequired: Boolean(o.requirements?.is_service_point_required),
        chargingType: o.charging_type ?? null,
        priceCents: value === null || !Number.isFinite(value) || value < 0 ? null : Math.round(value * 100), currency: total?.currency ?? null,
      };
    });
  } catch {
    return "unavailable";
  } finally {
    clearTimeout(timer);
  }
}
