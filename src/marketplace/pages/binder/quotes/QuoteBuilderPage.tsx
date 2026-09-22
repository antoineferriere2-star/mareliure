/**
 * Le constructeur de devis — le cœur du produit : je regarde le livre → je coche
 * ce que je dois faire → Ma Reliure calcule.
 *
 * Ordinateur : trois colonnes (client + ouvrage · prestations · résumé en direct).
 * Téléphone et tablette : une colonne, et une barre fixe en bas avec le total et
 * « Générer le devis » — le relieur a le livre dans une main.
 *
 * Rien ici ne décide d'un montant enregistré : l'écran affiche `computeQuote` en
 * direct, mais le serveur reçoit seulement la saisie (aucun total) et recalcule.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Search, X } from "lucide-react";
import {
  createMyQuote,
  getBillingProfile,
  getMyCatalog,
  getMyBasePriceServices,
  getMyClients,
  getMyQuote,
  getMyRecentServiceIds,
  saveMyService,
  updateMyQuote,
} from "@/marketplace/services/binderQuotes.data.functions";
import { profileReadiness, type BillingProfile } from "@/marketplace/quotes/quoteBuild";
import { lineTotalCents } from "@/marketplace/quotes/quoteCalc";
import { emptyBuilder, stateFromDocument, stateFromWork, toQuoteInput, totalsOf, type AdjustmentType, type BuilderState } from "@/marketplace/quotes/builderState";
import { getMyWork, getMyWorks, saveMyContact, saveMyWork } from "@/marketplace/services/binderWorks.data.functions";
import { resolvePricePalette, recentServices } from "@/marketplace/quotes/workbenchPalette";
import { buildSearchIndex, normalizeSearch, searchReference, searchServices } from "@/marketplace/reference/search";
import { loadReference, type ReferenceOperation } from "@/marketplace/reference";
import { PRICEABLE_SERVICE_MAPPINGS } from "@/marketplace/pricing/basePrices";
import type { WorkSummary } from "@/marketplace/works/workViews";
import { WORK_KEY, WORKS_KEY } from "@/marketplace/pages/binder/works/workKeys";
import { formatDimensions, freeLine, isPriceAdjusted, lineFromBasePrice, lineFromService, parseMillimetres, type CatalogService, type QuoteLine } from "@/marketplace/quotes/quoteLines";
import { euros, parseServerError } from "@/marketplace/quotes/quoteFormat";
import { Skeleton } from "@/components/ui/skeleton";
import { CARD, ErrorNote, FIELD, Field, MoneyInput, PRIMARY_BUTTON, QuantityInput, SECONDARY_BUTTON } from "./quoteUi";
import { ProfileQuickSetup } from "./ProfileQuickSetup";
import { CATALOG_KEY, CLIENTS_KEY, PROFILE_QUERY_KEY, QUOTES_KEY } from "./quoteQueryKeys";

let lineCounter = 0;
const nextKey = () => `line-${Date.now().toString(36)}-${++lineCounter}`;

export function QuoteBuilderPage({ quoteId, workId }: { quoteId?: string; workId?: string }) {
  const fetchProfile = useServerFn(getBillingProfile);
  const fetchCatalog = useServerFn(getMyCatalog);
  const fetchBasePrices = useServerFn(getMyBasePriceServices);
  const fetchClients = useServerFn(getMyClients);
  const fetchQuote = useServerFn(getMyQuote);
  const fetchWork = useServerFn(getMyWork);
  const fetchWorks = useServerFn(getMyWorks);
  const fetchRecent = useServerFn(getMyRecentServiceIds);
  // Un devis qui part d'un ouvrage : le contact et le livre arrivent déjà remplis.
  const fromWork = useQuery({
    queryKey: [...WORK_KEY, workId] as const,
    queryFn: () => fetchWork({ data: { id: workId! } }),
    enabled: Boolean(workId) && !quoteId,
  });

  const profile = useQuery({ queryKey: PROFILE_QUERY_KEY, queryFn: () => fetchProfile() });
  const catalog = useQuery({ queryKey: CATALOG_KEY, queryFn: () => fetchCatalog({ data: {} }) });
  const basePrices = useQuery({ queryKey: ["binder", "base-prices", "v1"], queryFn: () => fetchBasePrices() });
  const clients = useQuery({ queryKey: CLIENTS_KEY, queryFn: () => fetchClients() });
  const works = useQuery({ queryKey: WORKS_KEY, queryFn: () => fetchWorks({ data: {} }) });
  const recent = useQuery({ queryKey: ["binder", "quote-recent-services"], queryFn: () => fetchRecent() });
  const existing = useQuery({
    queryKey: [...QUOTES_KEY, quoteId] as const,
    queryFn: () => fetchQuote({ data: { id: quoteId! } }),
    enabled: Boolean(quoteId),
  });

  if (profile.isPending || catalog.isPending || basePrices.isPending || clients.isPending || works.isPending || recent.isPending || (quoteId && existing.isPending) || (workId && !quoteId && fromWork.isPending)) {
    return (
      <div role="status" aria-busy="true" className="space-y-4">
        <span className="sr-only">Chargement…</span>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (profile.error || catalog.error || basePrices.error || clients.error || works.error || recent.error || existing.error || !profile.data || !catalog.data || !basePrices.data || !clients.data || !works.data || !recent.data) {
    return <ErrorNote>Impossible de charger le constructeur. Rechargez la page.</ErrorNote>;
  }
  if (existing.data && existing.data.status !== "draft") {
    return (
      <div className="space-y-3">
        <ErrorNote>Ce devis a été envoyé : il n'est plus modifiable.</ErrorNote>
        <Link to="/atelier/devis/$quoteId" params={{ quoteId: existing.data.id }} className="text-sm underline">
          Retour au devis
        </Link>
      </div>
    );
  }
  return (
    <BuilderForm
      quoteId={quoteId}
      profile={profile.data}
      services={catalog.data.services}
      basePrices={basePrices.data}
      categories={catalog.data.categories}
      clients={clients.data}
      works={works.data}
      recentIds={recent.data}
      initial={
        existing.data
          ? stateFromDocument(existing.data)
          : fromWork.data
            ? stateFromWork(fromWork.data.work, fromWork.data.contact)
            : emptyBuilder()
      }
      fromWork={fromWork.data ? { reference: fromWork.data.work.reference, title: fromWork.data.work.title } : null}
    />
  );
}

function BuilderForm({
  quoteId,
  profile,
  services,
  basePrices,
  categories,
  clients,
  works,
  recentIds,
  initial,
  fromWork,
}: {
  quoteId?: string;
  profile: BillingProfile;
  services: { id: string; categoryId: string | null; name: string; description: string | null; unitPriceCents: number; vatRateBps: number | null; unit: string | null; isActive: boolean; isFavorite: boolean; referenceVersion: string | null; referenceOperationKey: string | null }[];
  basePrices: { pricingKey: string; label: string; unit: string; unitPriceCents: number | null; pricingMode: string }[];
  categories: { id: string; name: string }[];
  clients: { id: string; name: string; email: string | null; phone: string | null; addressLine1: string | null; postalCode: string | null; city: string | null }[];
  works: WorkSummary[];
  recentIds: string[];
  initial: BuilderState;
  /** L'ouvrage d'où l'on vient, pour le dire en haut de page. */
  fromWork?: { reference: string; title: string } | null;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const create = useServerFn(createMyQuote);
  const update = useServerFn(updateMyQuote);
  const saveService = useServerFn(saveMyService);
  const fetchWork = useServerFn(getMyWork);
  const createContact = useServerFn(saveMyContact);
  const createWork = useServerFn(saveMyWork);

  const [state, setState] = useState<BuilderState>(initial);
  const [search, setSearch] = useState("");
  const [showClientCreate, setShowClientCreate] = useState(false);
  const [showWorkCreate, setShowWorkCreate] = useState(false);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);
  const [referenceOperations, setReferenceOperations] = useState<readonly ReferenceOperation[] | null>(null);
  const [referenceError, setReferenceError] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [missingFromServer, setMissingFromServer] = useState<string[]>([]);
  useEffect(() => { setProblems([]); setMissingFromServer([]); }, [state]);
  const summaryRef = useRef<HTMLElement>(null);
  const savedRef = useRef(false);
  const dirty = JSON.stringify(state) !== JSON.stringify(initial);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (savedRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof BuilderState>(key: K, value: BuilderState[K]) => setState((s) => ({ ...s, [key]: value }));
  const setLine = (key: string, patch: Partial<QuoteLine>) =>
    setState((s) => ({ ...s, lines: s.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));

  const readiness = profileReadiness(profile, "quote");
  const regime = profile.vatRegime;
  const totals = useMemo(() => totalsOf(state, regime), [state, regime]);
  const dims = formatDimensions({ heightMm: parseMillimetres(state.height), widthMm: parseMillimetres(state.width), spineMm: parseMillimetres(state.spine) });
  const showVat = regime !== "FRANCHISE";

  const palette = resolvePricePalette(services, basePrices);
  const catalogServices: CatalogService[] = palette.workshop
    .map((s) => ({ id: s.id, categoryId: s.categoryId, name: s.name, description: s.description, unitPriceCents: s.unitPriceCents, vatRateBps: s.vatRateBps, unit: s.unit, referenceVersion: s.referenceVersion, referenceOperationKey: s.referenceOperationKey }));
  const favoriteServices = palette.workshop.filter((service) => service.isFavorite).map((service) => catalogServices.find((item) => item.id === service.id)!);
  const recentlyUsed = recentServices(catalogServices, recentIds);

  // --- Catalogue ----------------------------------------------------------------
  const selectedServiceIds = new Set(state.lines.map((l) => l.serviceId).filter(Boolean));
  const toggleService = (service: CatalogService) => {
    setState((s) =>
      s.lines.some((l) => l.serviceId === service.id)
        ? { ...s, lines: s.lines.filter((l) => l.serviceId !== service.id) }
        : { ...s, lines: [...s.lines, lineFromService(service, profile.defaultVatRateBps, nextKey())] },
    );
    setMobilePaletteOpen(false);
  };
  const addBasePrice = (service: (typeof basePrices)[number]) => {
    setState((s) => ({ ...s, lines: [...s.lines, lineFromBasePrice(service, profile.defaultVatRateBps, nextKey())] }));
    setMobilePaletteOpen(false);
  };
  const addFreeLine = (label = "") => {
    setState((s) => ({ ...s, lines: [...s.lines, freeLine(profile.defaultVatRateBps, nextKey(), label)] }));
    setMobilePaletteOpen(false);
  };

  const needle = normalizeSearch(search);
  const referenceIndex = useMemo(() => referenceOperations ? buildSearchIndex(referenceOperations) : null, [referenceOperations]);
  const referenceHits = referenceIndex && needle ? searchReference(referenceIndex, search, { limit: 12 }) : [];
  const referenceByKey = new Map((referenceOperations ?? []).map((operation) => [operation.key, operation]));
  const matchingServices = needle ? new Set(searchServices(palette.workshop, search, (key) => referenceByKey.get(key)).map((service) => service.id)) : null;
  const baseMatches = palette.base.filter((service) => !needle || normalizeSearch(`${service.label} ${service.pricingKey}`).includes(needle));
  const quickBase = !needle ? palette.base.filter((service) => ["plein_cuir", "nerfs", "dorure_titrage", "etui"].includes(service.pricingKey)) : [];
  useEffect(() => {
    if (!needle || referenceOperations || referenceError) return;
    let active = true;
    void loadReference().then((data) => { if (active) setReferenceOperations(data.operations); })
      .catch(() => { if (active) setReferenceError(true); });
    return () => { active = false; };
  }, [needle, referenceOperations, referenceError]);
  const groups = [
    ...categories.map((c) => ({ id: c.id, name: c.name, items: catalogServices.filter((s) => s.categoryId === c.id) })),
    { id: "none", name: "Autres", items: catalogServices.filter((s) => s.categoryId === null || !categories.some((c) => c.id === s.categoryId)) },
  ]
    .map((g) => ({ ...g, items: matchingServices ? g.items.filter((s) => matchingServices.has(s.id)) : g.items }))
    .filter((g) => g.items.length > 0);

  /** « Enregistrer cette ligne dans mon catalogue » : la ligne libre devient une prestation. */
  const saveLineToCatalog = useMutation({
    mutationFn: (line: QuoteLine) =>
      saveService({
        data: { id: null, categoryId: null, name: line.label.trim(), description: line.description.trim() || null, unitPriceCents: line.unitPriceCents, vatRateBps: null, unit: line.unit, isActive: true },
      }),
    onSuccess: (saved, line) => {
      setLine(line.key, { serviceId: saved.id, catalogPriceCents: saved.unitPriceCents });
      void queryClient.invalidateQueries({ queryKey: CATALOG_KEY });
    },
  });

  // --- Client ---------------------------------------------------------------------------
  const onClientName = (name: string) => {
    const match = clients.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
    setState((s) =>
      match
        ? { ...s, clientId: match.id, clientName: match.name, clientEmail: match.email ?? "", clientPhone: match.phone ?? "", clientAddress: match.addressLine1 ?? "", clientPostalCode: match.postalCode ?? "", clientCity: match.city ?? "" }
        : { ...s, clientId: null, workId: null, clientName: name },
    );
  };

  const quickClient = useMutation({
    mutationFn: () => createContact({ data: {
      id: null, firstName: null, lastName: state.clientName.trim(), organization: null,
      email: state.clientEmail.trim() || null, phone: state.clientPhone.trim() || null,
      addressLine1: state.clientAddress.trim() || null, postalCode: state.clientPostalCode.trim() || null,
      city: state.clientCity.trim() || null, country: null, notes: null,
    } }),
    onSuccess: (contact) => {
      setState((current) => ({ ...current, clientId: contact.id, clientName: contact.name }));
      setShowClientCreate(false);
      void queryClient.invalidateQueries({ queryKey: CLIENTS_KEY });
    },
    onError: () => setProblems(["Le client n'a pas pu être créé. Vérifiez le nom et les coordonnées."]),
  });
  const selectWork = async (id: string) => {
    if (!id) { set("workId", null); return; }
    try {
      const detail = await fetchWork({ data: { id } });
      setState((current) => ({ ...current, ...stateFromWork(detail.work, detail.contact), lines: current.lines,
        discountType: current.discountType, discountValue: current.discountValue,
        depositType: current.depositType, depositValue: current.depositValue,
        validityDays: current.validityDays, notes: current.notes }));
    } catch { setProblems(["Impossible de sélectionner cet ouvrage."]); }
  };
  const quickWork = useMutation({
    mutationFn: () => {
      if (!state.clientId) throw new Error("client_required");
      return createWork({ data: {
        id: null, contactId: state.clientId, title: state.title.trim(), author: state.author.trim() || null,
        editionNote: null, description: null, heightMm: parseMillimetres(state.height),
        widthMm: parseMillimetres(state.width), thicknessMm: parseMillimetres(state.spine),
        weightGrams: null, declaredValueCents: null, conditionNotes: state.bookNotes.trim() || null,
        internalNotes: null,
      } });
    },
    onSuccess: (detail) => {
      set("workId", detail.work.id);
      setShowWorkCreate(false);
      void queryClient.invalidateQueries({ queryKey: WORKS_KEY });
    },
    onError: () => setProblems(["L'ouvrage n'a pas pu être créé. Choisissez un client et saisissez son titre."]),
  });
  const addReference = (operation: ReferenceOperation) => {
    const workshop = palette.workshop.find((service) => service.referenceOperationKey === operation.key);
    if (workshop) {
      const choice = catalogServices.find((service) => service.id === workshop.id);
      if (choice) toggleService(choice);
      return;
    }
    const base = palette.base.find((service) => {
      const mapping = PRICEABLE_SERVICE_MAPPINGS.find((item) => item.pricingKey === service.pricingKey);
      return mapping?.mappingType === "exact" && mapping.referenceOperationKeys.includes(operation.key);
    });
    if (base) { addBasePrice(base); return; }
    setState((current) => ({ ...current, lines: [...current.lines, {
      ...freeLine(profile.defaultVatRateBps, nextKey(), operation.customerName || operation.canonicalName),
      unit: operation.unitCandidates[0] ?? null, description: `Référentiel ${operation.version} · ${operation.key}`,
      requiresManualPrice: true,
      referenceVersion: operation.version, referenceOperationKey: operation.key,
    }] }));
    setMobilePaletteOpen(false);
  };

  // --- Génération -------------------------------------------------------------------------
  const generate = useMutation({
    mutationFn: async () => {
      const built = toQuoteInput(state);
      if (!built.ok) throw Object.assign(new Error("invalid"), { problems: built.problems });
      return quoteId ? update({ data: { id: quoteId, quote: built.input } }) : create({ data: built.input });
    },
    onSuccess: (quote) => {
      savedRef.current = true;
      void queryClient.invalidateQueries({ queryKey: QUOTES_KEY });
      void queryClient.invalidateQueries({ queryKey: CLIENTS_KEY });
      void queryClient.invalidateQueries({ queryKey: WORK_KEY });
      void queryClient.invalidateQueries({ queryKey: WORKS_KEY });
      void navigate({ to: "/atelier/devis/$quoteId", params: { quoteId: quote.id } });
    },
    onError: (error) => {
      const local = (error as { problems?: string[] }).problems;
      if (local) {
        setProblems(local);
        return;
      }
      const parsed = parseServerError(error);
      if (parsed.code === "profile_incomplete") {
        setMissingFromServer(parsed.missing);
        void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
        setProblems(["Complétez d'abord les informations demandées en haut de page."]);
      } else setProblems(["Le devis n'a pas pu être enregistré. Réessayez."]);
    },
  });
  const onGenerate = () => {
    setProblems([]);
    setMissingFromServer([]);
    generate.mutate();
  };

  const generateLabel = generate.isPending ? "Enregistrement…" : quoteId ? "Enregistrer les modifications" : "Enregistrer le devis";
  const canGenerate = readiness.ready && !generate.isPending;

  return (
    <div className="pb-32 lg:pb-0">
      <header className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-serif text-2xl">{quoteId ? "Modifier le devis" : "Nouveau devis"}</h1>
        <Link to="/atelier/devis" className="text-sm text-muted-foreground underline">
          Retour aux devis
        </Link>
        {fromWork && !quoteId && (
          <p className="w-full text-sm text-muted-foreground">
            Pour l'ouvrage « {fromWork.title} » ({fromWork.reference}) — le contact et le livre sont déjà remplis.
          </p>
        )}
      </header>

      {!readiness.ready && (
        <div className="mb-5">
          <ProfileQuickSetup profile={profile} missing={missingFromServer.length ? missingFromServer : readiness.missing} />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)_minmax(0,370px)]">
        {/* ── Colonne 1 : client + ouvrage ─────────────────────────────────────── */}
        <div className="space-y-5 lg:col-span-3 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0">
          <section aria-labelledby="client-title" className={CARD}>
            <h2 id="client-title" className="font-serif text-lg">Client</h2>
            <div className="mt-3 space-y-3">
              <Field label="Choisir un client" htmlFor="client-select">
                <select id="client-select" className={FIELD} value={state.clientId ?? ""} onChange={(event) => {
                  const chosen = clients.find((client) => client.id === event.target.value);
                  if (chosen) onClientName(chosen.name);
                }}>
                  <option value="">Rechercher ou créer…</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
              </Field>
              <button type="button" className="text-sm underline" onClick={() => setShowClientCreate((open) => !open)}>+ Nouveau client</button>
              <Field label="Nom du client" htmlFor="client-name">
                <input id="client-name" className={FIELD} list="clients-list" value={state.clientName} onChange={(e) => onClientName(e.target.value)} autoComplete="off" />
                <datalist id="clients-list">
                  {clients.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </Field>
              {showClientCreate && <div className="space-y-2 rounded-md border border-border p-3">
                <Field label="E-mail" htmlFor="quick-client-email"><input id="quick-client-email" type="email" className={FIELD} value={state.clientEmail} onChange={(e) => set("clientEmail", e.target.value)} /></Field>
                <Field label="Téléphone" htmlFor="quick-client-phone"><input id="quick-client-phone" type="tel" className={FIELD} value={state.clientPhone} onChange={(e) => set("clientPhone", e.target.value)} /></Field>
                <button type="button" className={SECONDARY_BUTTON} disabled={!state.clientName.trim() || quickClient.isPending} onClick={() => quickClient.mutate()}>{quickClient.isPending ? "Création…" : "Créer et sélectionner"}</button>
              </div>}
              <details>
                <summary className="flex min-h-11 cursor-pointer items-center text-sm text-muted-foreground">Coordonnées (facultatif)</summary>
                <div className="space-y-3 pb-1">
                  <Field label="E-mail" htmlFor="client-email"><input id="client-email" type="email" className={FIELD} value={state.clientEmail} onChange={(e) => set("clientEmail", e.target.value)} /></Field>
                  <Field label="Téléphone" htmlFor="client-phone"><input id="client-phone" type="tel" className={FIELD} value={state.clientPhone} onChange={(e) => set("clientPhone", e.target.value)} /></Field>
                  <Field label="Adresse" htmlFor="client-address"><input id="client-address" className={FIELD} value={state.clientAddress} onChange={(e) => set("clientAddress", e.target.value)} /></Field>
                  <div className="grid grid-cols-[110px_1fr] gap-3">
                    <Field label="Code postal" htmlFor="client-postal"><input id="client-postal" className={FIELD} value={state.clientPostalCode} onChange={(e) => set("clientPostalCode", e.target.value)} /></Field>
                    <Field label="Ville" htmlFor="client-city"><input id="client-city" className={FIELD} value={state.clientCity} onChange={(e) => set("clientCity", e.target.value)} /></Field>
                  </div>
                </div>
              </details>
            </div>
          </section>

          <section aria-labelledby="book-title" className={CARD}>
            <h2 id="book-title" className="font-serif text-lg">Ouvrage</h2>
            <div className="mt-3 space-y-3">
              <Field label="Choisir un ouvrage" htmlFor="work-select">
                <select id="work-select" className={FIELD} value={state.workId ?? ""} onChange={(event) => void selectWork(event.target.value)}>
                  <option value="">Rechercher ou créer…</option>
                  {works.filter((work) => !state.clientId || work.contactId === state.clientId).map((work) =>
                    <option key={work.id} value={work.id}>{work.reference} · {work.title}</option>)}
                </select>
              </Field>
              <button type="button" className="text-sm underline" onClick={() => setShowWorkCreate((open) => !open)}>+ Nouvel ouvrage</button>
              {showWorkCreate && <p className="text-xs text-muted-foreground">Renseignez le titre et, si vous les connaissez, les dimensions ci-dessous. Choisissez d'abord le client.</p>}
              <Field label="Dimensions en mm (hauteur × largeur × dos)" htmlFor="book-height">
                <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2">
                  <input id="book-height" aria-label="Hauteur en millimètres" placeholder="220" inputMode="decimal" className={`${FIELD} text-center`} value={state.height} onChange={(e) => set("height", e.target.value)} />
                  <span aria-hidden="true">×</span>
                  <input aria-label="Largeur en millimètres" placeholder="145" inputMode="decimal" className={`${FIELD} text-center`} value={state.width} onChange={(e) => set("width", e.target.value)} />
                  <span aria-hidden="true">×</span>
                  <input aria-label="Épaisseur du dos en millimètres" placeholder="32" inputMode="decimal" className={`${FIELD} text-center`} value={state.spine} onChange={(e) => set("spine", e.target.value)} />
                </div>
                {dims && <p className="mt-1 text-sm font-medium" data-testid="dimensions-preview">{dims}</p>}
              </Field>
              <Field label="Titre (facultatif)" htmlFor="book-title-input"><input id="book-title-input" className={FIELD} value={state.title} onChange={(e) => set("title", e.target.value)} /></Field>
              {showWorkCreate && <button type="button" className={SECONDARY_BUTTON} disabled={!state.clientId || !state.title.trim() || quickWork.isPending} onClick={() => quickWork.mutate()}>{quickWork.isPending ? "Création…" : "Créer et sélectionner l'ouvrage"}</button>}
              <details>
                <summary className="flex min-h-11 cursor-pointer items-center text-sm text-muted-foreground">Auteur, notes (facultatif)</summary>
                <div className="space-y-3 pb-1">
                  <Field label="Auteur" htmlFor="book-author"><input id="book-author" className={FIELD} value={state.author} onChange={(e) => set("author", e.target.value)} /></Field>
                  <Field label="Notes sur l'ouvrage" htmlFor="book-notes"><textarea id="book-notes" rows={3} className={`${FIELD} h-auto py-2`} value={state.bookNotes} onChange={(e) => set("bookNotes", e.target.value)} /></Field>
                </div>
              </details>
            </div>
          </section>
        </div>

        {/* ── Colonne 2 : prestations ────────────────────────────────────────────── */}
        <button type="button" className={`${SECONDARY_BUTTON} lg:hidden`} onClick={() => setMobilePaletteOpen(true)}>Ajouter une prestation</button>
        <section aria-labelledby="catalog-title" className={`${CARD} ${mobilePaletteOpen ? "fixed inset-0 z-30 overflow-y-auto rounded-none bg-background pb-24" : "hidden"} lg:static lg:block lg:overflow-visible lg:rounded-lg lg:pb-5`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="catalog-title" className="font-serif text-lg">Prestations</h2>
            <button type="button" className="min-h-11 rounded-md border px-3 lg:hidden" onClick={() => setMobilePaletteOpen(false)}>Fermer</button>
            {(
              <div className="relative w-full sm:w-56">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input aria-label="Chercher une prestation" placeholder="Chercher…" className={`${FIELD} pl-9`} value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            )}
          </div>

          {catalogServices.length === 0 && baseMatches.length === 0 && referenceHits.length === 0 ? (
            <div className="mt-4 rounded-md border border-dashed border-border p-5 text-center">
              <p className="font-medium">Aucune prestation disponible.</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                Configurez vos prestations dans l'atelier. Les tarifs de base Ma Reliure apparaissent aussi dans la palette lorsqu'ils sont disponibles.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Link to="/atelier/tarifs" className={PRIMARY_BUTTON}>
                  Ajouter mes premières prestations
                </Link>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">En attendant, ajoutez une ligne libre dans le résumé.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-5">
              {favoriteServices.length > 0 && !needle && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">★ Favoris</h3>
                  <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    {favoriteServices.map((service) => <ServiceChoice key={service.id} service={service} selected={selectedServiceIds.has(service.id)} onClick={() => toggleService(service)} />)}
                  </ul>
                </div>
              )}
              {recentlyUsed.length > 0 && !needle && <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">↻ Récentes</h3>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">{recentlyUsed.map((service) => <ServiceChoice key={service.id} service={service} selected={selectedServiceIds.has(service.id)} onClick={() => toggleService(service)} />)}</ul>
              </div>}
              {quickBase.length > 0 && <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tarifs Ma Reliure · accès rapide</h3>
                <ul className="grid gap-2">{quickBase.map((service) => <li key={service.pricingKey}><button type="button" className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-input px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => addBasePrice(service)}><span>+ {service.label}</span><span className="tabular-nums text-muted-foreground">{service.pricingMode === "manual_review" ? "Sur étude" : euros(service.unitPriceCents ?? 0)}</span></button></li>)}</ul>
              </div>}
              {needle && referenceHits.length > 0 && <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Référentiel reliure-fr-v1</h3>
                <ul className="grid gap-2">{referenceHits.map(({ operation }) => <li key={operation.key}><button type="button" className="min-h-11 w-full rounded-md border border-input px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => addReference(operation)}>+ {operation.customerName || operation.canonicalName} · {operation.key}</button></li>)}</ul>
              </div>}
              {referenceError && needle && <p className="text-xs text-destructive">Le référentiel ne peut pas être chargé.</p>}
              {groups.length === 0 && baseMatches.length === 0 && referenceHits.length === 0 && <p className="text-sm text-muted-foreground">Aucune prestation ne correspond à « {search} ».</p>}
              {groups.length > 0 && !needle && <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mes prestations</h3>}
              {groups.map((group) => (
                <div key={group.id}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.name}</h3>
                  <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    {group.items.map((service) => {
                      const selected = selectedServiceIds.has(service.id);
                      return (
                        <li key={service.id}>
                          <button
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleService(service)}
                            className={`flex min-h-11 w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              selected ? "border-foreground bg-foreground/5" : "border-input bg-background hover:bg-accent"
                            }`}
                          >
                            <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${selected ? "border-foreground bg-foreground text-background" : "border-input"}`}>
                              {selected ? "✓" : ""}
                            </span>
                            <span className="min-w-0 flex-1 break-words leading-snug">{service.name}</span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">{euros(service.unitPriceCents)}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {baseMatches.length > 0 && (
                <details open={Boolean(needle)}>
                  <summary className="mb-2 min-h-11 cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tarifs de base Ma Reliure ({baseMatches.length})</summary>
                  <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    {baseMatches.map((service) => (
                      <li key={service.pricingKey}>
                        <button type="button" onClick={() => addBasePrice(service)} className="flex min-h-11 w-full items-center gap-3 rounded-md border border-input bg-background px-3 py-2 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          <span aria-hidden="true" className="text-muted-foreground">+</span>
                          <span className="min-w-0 flex-1 break-words leading-snug">{service.label}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">{service.pricingMode === "manual_review" ? "Sur étude" : euros(service.unitPriceCents ?? 0)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <p className="text-xs text-muted-foreground">
                Un prix manque ou doit changer ?{" "}
                <Link to="/atelier/tarifs" className="underline">Modifier mon catalogue</Link>.
              </p>
              <button type="button" className={SECONDARY_BUTTON} onClick={() => addFreeLine()}>+ Ligne libre</button>
            </div>
          )}
        </section>

        {/* ── Colonne 3 : résumé en direct ─────────────────────────────────────────── */}
        <aside ref={summaryRef} aria-labelledby="summary-title" className="lg:col-span-2 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)] lg:items-start lg:gap-5">
          {/* Sur ordinateur, seules les lignes défilent : le total et « Générer le devis » restent à l'écran. */}
          <div className={`${CARD} lg:contents`}>
            <div className="min-w-0 lg:rounded-lg lg:border lg:border-border lg:bg-card lg:p-5">
            <h2 id="summary-title" className="font-serif text-lg">Lignes du devis</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {[state.title.trim() || null, dims].filter(Boolean).join(" · ") || "Ouvrage à renseigner"}
            </p>

            {state.lines.length === 0 ? (
              <p className="mt-4 rounded-md bg-muted px-3 py-4 text-sm text-muted-foreground">
                Cochez les prestations à réaliser : le prix s'ajoute ici, immédiatement.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {state.lines.map((line) => {
                  const total = line.quantity > 0 ? lineTotalCents(line) : 0;
                  const adjusted = isPriceAdjusted(line);
                  return (
                    <li key={line.key} className="rounded-md border border-border p-3">
                      <div className="flex items-start gap-2">
                        <input aria-label="Libellé de la ligne" placeholder="Libellé (ex. Réparation du premier cahier)" className={`${FIELD} flex-1 font-medium`} value={line.label} onChange={(e) => setLine(line.key, { label: e.target.value })} />
                        <button type="button" aria-label={`Dupliquer ${line.label || "cette ligne"}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent" onClick={() => setState((s) => ({ ...s, lines: s.lines.flatMap((item) => item.key === line.key ? [item, { ...item, key: nextKey() }] : [item]) }))}>×2</button>
                        <button type="button" aria-label={`Retirer ${line.label || "cette ligne"}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent" onClick={() => setState((s) => ({ ...s, lines: s.lines.filter((l) => l.key !== line.key) }))}>
                          <X aria-hidden="true" className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-2 grid grid-cols-[64px_1fr_auto] items-center gap-2">
                        <QuantityInput id={`qty-${line.key}`} label={`Quantité — ${line.label || "ligne"}`} value={line.quantity} onChange={(quantity) => setLine(line.key, { quantity })} />
                        <MoneyInput id={`price-${line.key}`} label={`Prix HT — ${line.label || "ligne"}`} cents={line.unitPriceCents} onChange={(unitPriceCents) => setLine(line.key, { unitPriceCents })} invalid={line.requiresManualPrice && line.unitPriceCents === 0} blankWhenZero={line.requiresManualPrice} />
                        <span className="w-20 text-right text-sm font-medium tabular-nums">{line.requiresManualPrice && line.unitPriceCents === 0 ? "—" : euros(total)}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <input aria-label={`Unité — ${line.label || "ligne"}`} placeholder="Unité" className={FIELD} value={line.unit ?? ""} onChange={(e) => setLine(line.key, { unit: e.target.value || null })} />
                        <select aria-label={`TVA — ${line.label || "ligne"}`} className={FIELD} value={line.vatRateBps} onChange={(e) => setLine(line.key, { vatRateBps: Number(e.target.value) })}>
                          <option value={0}>TVA 0 %</option>
                          <option value={550}>TVA 5,5 %</option>
                          <option value={1000}>TVA 10 %</option>
                          <option value={2000}>TVA 20 %</option>
                        </select>
                      </div>
                      {line.priceSource === "base" && <p className="mt-1 text-xs text-muted-foreground">Tarif de base Ma Reliure</p>}
                      {line.requiresManualPrice && line.unitPriceCents <= 0 && <p className="mt-1 text-xs text-amber-800">Définissez le prix pour ce devis.</p>}
                      {adjusted && (
                        <p className="mt-1 text-xs text-amber-800">
                          Prix ajusté pour ce devis (catalogue : {euros(line.catalogPriceCents ?? 0)}).{" "}
                          <button type="button" className="underline" onClick={() => setLine(line.key, { unitPriceCents: line.catalogPriceCents ?? 0 })}>Rétablir</button>
                        </p>
                      )}
                      {line.priceSource === "manual" && !line.referenceOperationKey && line.label.trim() !== "" && line.unitPriceCents > 0 && <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <input type="checkbox" checked={line.serviceId !== null} disabled={line.serviceId !== null || saveLineToCatalog.isPending} onChange={(event) => { if (event.target.checked) saveLineToCatalog.mutate(line); }} />
                        Ajouter à mes prestations
                      </label>}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={SECONDARY_BUTTON} onClick={() => addFreeLine()}>
                <Plus aria-hidden="true" className="mr-1 h-4 w-4" /> Ligne libre
              </button>
              <button type="button" className={SECONDARY_BUTTON} onClick={() => addFreeLine("Frais supplémentaires")}>
                <Plus aria-hidden="true" className="mr-1 h-4 w-4" /> Frais
              </button>
            </div>

            <details className="mt-4">
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">Remise, acompte, conditions</summary>
              <div className="space-y-3 pb-1">
                <AdjustmentField id="discount" label="Remise" type={state.discountType} value={state.discountValue} onType={(t) => set("discountType", t)} onValue={(v) => set("discountValue", v)} />
                <AdjustmentField id="deposit" label="Acompte demandé (sur le total TTC)" type={state.depositType} value={state.depositValue} onType={(t) => set("depositType", t)} onValue={(v) => set("depositValue", v)} />
                <Field label={`Validité en jours (défaut : ${profile.quoteValidityDays})`} htmlFor="validity"><input id="validity" inputMode="numeric" className={FIELD} value={state.validityDays} onChange={(e) => set("validityDays", e.target.value)} /></Field>
                <Field label={`Conditions du devis${profile.quoteNotes ? " (défaut : vos mentions)" : ""}`} htmlFor="notes"><textarea id="notes" rows={3} className={`${FIELD} h-auto py-2`} value={state.notes} placeholder={profile.quoteNotes ?? ""} onChange={(e) => set("notes", e.target.value)} /></Field>
              </div>
            </details>
            </div>

            <div className="lg:sticky lg:top-4 lg:rounded-lg lg:border lg:border-border lg:bg-card lg:p-5">
            <h2 className="font-serif text-lg">Résumé du devis</h2>
            <dl className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm" aria-live="polite">
              {totals.discountCents > 0 && (
                <>
                  <Row label="Sous-total HT" value={euros(totals.subtotalCents)} />
                  <Row label="Remise" value={`− ${euros(totals.discountCents)}`} />
                </>
              )}
              <Row label={showVat ? "Total HT" : "Total"} value={euros(totals.totalHtCents)} strong={!showVat} />
              {showVat &&
                totals.vatBreakdown
                  .filter((g) => g.baseHtCents > 0)
                  .map((g) => <Row key={g.vatRateBps} label={`TVA ${String(g.vatRateBps / 100).replace(".", ",")} %`} value={euros(g.vatCents)} />)}
              {showVat && <Row label="Total TTC" value={euros(totals.totalTtcCents)} strong />}
              {totals.depositCents > 0 && (
                <>
                  <Row label="Acompte demandé" value={euros(totals.depositCents)} />
                  <Row label="Solde" value={euros(totals.balanceCents)} />
                </>
              )}
            </dl>

            {problems.length > 0 && (
              <div className="mt-3 space-y-1" role="alert">
                {problems.map((p) => (
                  <p key={p} className="text-sm text-destructive">{p}</p>
                ))}
              </div>
            )}
            <button type="button" className={`${PRIMARY_BUTTON} mt-4 hidden w-full lg:inline-flex`} onClick={onGenerate} disabled={!canGenerate}>
              {generateLabel}
            </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Téléphone / tablette : le total et l'action principale restent sous le pouce. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            <span className="block text-xs text-muted-foreground">{showVat ? "Total TTC" : "Total"} · voir le résumé</span>
            <span className="block truncate font-serif text-xl tabular-nums" data-testid="mobile-total">{euros(showVat ? totals.totalTtcCents : totals.totalHtCents)}</span>
          </button>
          <button type="button" className={PRIMARY_BUTTON} onClick={onGenerate} disabled={!canGenerate}>
            {generateLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${strong ? "border-t border-border pt-2 text-base font-semibold" : ""}`}>
      <dt className={strong ? "" : "text-muted-foreground"}>{label}</dt>
      <dd className="tabular-nums" data-testid={strong ? "grand-total" : undefined}>{value}</dd>
    </div>
  );
}

function ServiceChoice({ service, selected, onClick }: { service: CatalogService; selected: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={onClick}
        className={`flex min-h-11 w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? "border-foreground bg-foreground/5" : "border-input bg-background hover:bg-accent"}`}
      >
        <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${selected ? "border-foreground bg-foreground text-background" : "border-input"}`}>{selected ? "✓" : ""}</span>
        <span className="min-w-0 flex-1 break-words leading-snug">{service.name}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">{euros(service.unitPriceCents)}</span>
      </button>
    </li>
  );
}

function AdjustmentField({
  id,
  label,
  type,
  value,
  onType,
  onValue,
}: {
  id: string;
  label: string;
  type: AdjustmentType;
  value: string;
  onType: (t: AdjustmentType) => void;
  onValue: (v: string) => void;
}) {
  return (
    <Field label={label} htmlFor={`${id}-type`}>
      <div className="grid grid-cols-[1fr_110px] gap-2">
        <select id={`${id}-type`} className={FIELD} value={type} onChange={(e) => onType(e.target.value as AdjustmentType)}>
          <option value="NONE">Aucun</option>
          <option value="PERCENT">En pourcentage (%)</option>
          <option value="AMOUNT">En euros (€)</option>
        </select>
        <input aria-label={`${label} — valeur`} inputMode="decimal" disabled={type === "NONE"} className={`${FIELD} text-right`} value={value} onChange={(e) => onValue(e.target.value)} />
      </div>
    </Field>
  );
}
