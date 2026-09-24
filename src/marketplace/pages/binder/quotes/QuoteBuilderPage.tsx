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
import { Camera, ChevronDown, Images, Plus, Search, Trash2, X } from "lucide-react";
import {
  attachMyOperationPhoto,
  createMyQuote,
  deleteMyQuoteItemPhoto,
  getMyOperationPhotos,
  uploadMyOperationPhoto,
  getBillingProfile,
  getMyCatalog,
  getMyBasePriceServices,
  getMyClients,
  getMyQuote,
  getMyRecentServiceIds,
  saveMyService,
  updateMyQuote,
  uploadMyQuoteItemPhoto,
} from "@/marketplace/services/binderQuotes.data.functions";
import { profileReadiness, type BillingProfile } from "@/marketplace/quotes/quoteBuild";
import { lineTotalCents } from "@/marketplace/quotes/quoteCalc";
import { DEFAULT_BLOCK_KEY, emptyBuilder, emptySizeBlock, stateFromDocument, stateFromWork, toQuoteInput, totalsOf, type AdjustmentType, type BuilderState, type QuoteSizeBlock } from "@/marketplace/quotes/builderState";
import { getMyWork, getMyWorks, saveMyContact, saveMyWork } from "@/marketplace/services/binderWorks.data.functions";
import { resolvePricePalette, recentServices } from "@/marketplace/quotes/workbenchPalette";
import { buildSearchIndex, normalizeSearch, searchReference, searchServices } from "@/marketplace/reference/search";
import { loadReference, type ReferenceOperation } from "@/marketplace/reference";
import { PRICEABLE_SERVICE_MAPPINGS } from "@/marketplace/pricing/basePrices";
import type { WorkSummary } from "@/marketplace/works/workViews";
import { WORK_KEY, WORKS_KEY } from "@/marketplace/pages/binder/works/workKeys";
import { formatDimensions, freeLine, isPriceAdjusted, lineFromBasePrice, lineFromService, parseMillimetres, type CatalogService, type QuoteLine } from "@/marketplace/quotes/quoteLines";
import { euros, parsePercentToBps, parseServerError } from "@/marketplace/quotes/quoteFormat";
import { Skeleton } from "@/components/ui/skeleton";
import { CARD, ErrorNote, FIELD, Field, MoneyInput, PRIMARY_BUTTON, QuantityInput, SECONDARY_BUTTON } from "./quoteUi";
import { ProfileQuickSetup } from "./ProfileQuickSetup";
import { CATALOG_KEY, CLIENTS_KEY, OPERATION_PHOTOS_KEY, PROFILE_QUERY_KEY, QUOTES_KEY } from "./quoteQueryKeys";
import { examplesFor, fileToBase64, photoTargetOfLine, QUOTE_OPERATION_PHOTO_MAX_BYTES, QUOTE_OPERATION_PHOTO_MAX_PER_LINE, QUOTE_OPERATION_PHOTO_MIME_TYPES } from "@/marketplace/quotes/quotePhotos";
import type { DocumentPhotoView } from "@/marketplace/quotes/quoteViews";

let lineCounter = 0;
const nextKey = () => `line-${Date.now().toString(36)}-${++lineCounter}`;
const nextBlockKey = () => `format-${Date.now().toString(36)}-${++lineCounter}`;
const COMMON_VAT_RATES = [0, 550, 1000, 2000] as const;

const BASE_FAMILIES = [
  ["Réparation", /repar|consolid|reprise|recoll|renfort|coin|coiffe|mors|dos/i],
  ["Reliure toile", /toile|embo.tage/i],
  ["Reliure cuir", /cuir|peau|maroquin|chagrin|veau/i],
  ["Dorure", /dorure|titrage|titre|or |palette/i],
  ["Finitions", /garde|tranche|nerf|signet|papier|finition/i],
  ["Protection", /etui|étui|bo.te|boîte|coffret|chemise/i],
  ["Restauration", /restaur|patrimon/i],
  ["Création", /creation|création|sur mesure/i],
] as const;

function baseFamily(label: string) {
  return BASE_FAMILIES.find(([, pattern]) => pattern.test(label))?.[0] ?? "Autres";
}

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
      initialPhotos={existing.data?.items.flatMap((item) => item.photos) ?? []}
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
  initialPhotos,
  fromWork,
}: {
  quoteId?: string;
  profile: BillingProfile;
  services: { id: string; categoryId: string | null; name: string; description: string | null; unitPriceCents: number; vatRateBps: number | null; unit: string | null; isActive: boolean; isFavorite: boolean; referenceVersion: string | null; referenceOperationKey: string | null }[];
  basePrices: { pricingKey: string; label: string; unit: string; unitPriceCents: number | null; pricingMode: string; isFavorite?: boolean }[];
  categories: { id: string; name: string }[];
  clients: { id: string; name: string; email: string | null; phone: string | null; addressLine1: string | null; postalCode: string | null; city: string | null }[];
  works: WorkSummary[];
  recentIds: string[];
  initial: BuilderState;
  initialPhotos: DocumentPhotoView[];
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
  const uploadPhoto = useServerFn(uploadMyQuoteItemPhoto);
  const deletePhoto = useServerFn(deleteMyQuoteItemPhoto);
  const attachExample = useServerFn(attachMyOperationPhoto);
  const saveExample = useServerFn(uploadMyOperationPhoto);
  const fetchExamples = useServerFn(getMyOperationPhotos);
  // La bibliothèque n'est qu'une aide : si elle ne charge pas, le devis se construit sans elle.
  const examples = useQuery({ queryKey: OPERATION_PHOTOS_KEY, queryFn: () => fetchExamples(), retry: false });

  const [state, setState] = useState<BuilderState>(initial);
  const [activeBlockKey, setActiveBlockKey] = useState(initial.blocks[0]?.key ?? DEFAULT_BLOCK_KEY);
  const [pendingPhotos, setPendingPhotos] = useState<Record<string, { key: string; file: File; caption: string; includeInPdf: boolean; previewUrl: string; keepAsExample: boolean }[]>>({});
  /** Les exemples de la bibliothèque retenus pour une ligne : copiés sur le devis à l'enregistrement. */
  const [examplePicks, setExamplePicks] = useState<Record<string, { key: string; photoId: string; url: string; caption: string; includeInPdf: boolean }[]>>({});
  const [photoIdsToDelete, setPhotoIdsToDelete] = useState<string[]>([]);
  const [savedDraftId, setSavedDraftId] = useState<string | null>(quoteId ?? null);
  const [search, setSearch] = useState("");
  const [openCategory, setOpenCategory] = useState<string | null>(null);
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
  const dirty = JSON.stringify(state) !== JSON.stringify(initial) || Object.values(pendingPhotos).some((photos) => photos.length > 0) || Object.values(examplePicks).some((picks) => picks.length > 0) || photoIdsToDelete.length > 0;
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
  const setBlock = (key: string, patch: Partial<QuoteSizeBlock>) =>
    setState((s) => ({ ...s, blocks: s.blocks.map((block) => block.key === key ? { ...block, ...patch } : block) }));
  const activeBlock = state.blocks.find((block) => block.key === activeBlockKey) ?? state.blocks[0];
  const existingPhotos = initialPhotos.filter((photo) => !photoIdsToDelete.includes(photo.id));
  const queuePhotoDeletion = (photoId: string) => setPhotoIdsToDelete((ids) => ids.includes(photoId) ? ids : [...ids, photoId]);
  const photoCount = (lineKey: string) =>
    existingPhotos.filter((photo) => photo.lineKey === lineKey).length + (pendingPhotos[lineKey]?.length ?? 0) + (examplePicks[lineKey]?.length ?? 0);
  /** Les exemples de l'opération que la ligne n'a pas encore, dans la limite de ses places libres. */
  const availableExamples = (line: QuoteLine) => {
    const picked = new Set((examplePicks[line.key] ?? []).map((pick) => pick.photoId));
    return examplesFor(photoTargetOfLine(line), examples.data ?? [])
      .filter((photo) => !picked.has(photo.id))
      .slice(0, Math.max(0, QUOTE_OPERATION_PHOTO_MAX_PER_LINE - photoCount(line.key)));
  };
  const pickExamples = (line: QuoteLine) => {
    const photos = availableExamples(line);
    if (photos.length === 0) return;
    setExamplePicks((all) => ({ ...all, [line.key]: [...(all[line.key] ?? []), ...photos.map((photo) => ({ key: `${line.key}-${photo.id}`, photoId: photo.id, url: photo.url, caption: photo.caption ?? "", includeInPdf: true }))] }));
  };
  const addLine = (line: QuoteLine) => {
    setState((s) => ({ ...s, lines: [...s.lines, line] }));
    pickExamples(line);
  };
  const forgetLinePhotos = (lineKey: string) => {
    existingPhotos.filter((photo) => photo.lineKey === lineKey).forEach((photo) => queuePhotoDeletion(photo.id));
    setPendingPhotos((photos) => ({ ...photos, [lineKey]: [] }));
    setExamplePicks((picks) => ({ ...picks, [lineKey]: [] }));
  };
  const removeLine = (lineKey: string) => {
    forgetLinePhotos(lineKey);
    setState((s) => ({ ...s, lines: s.lines.filter((line) => line.key !== lineKey) }));
  };
  const removeBlock = (blockKey: string) => {
    if (state.blocks.length <= 1) return;
    state.lines.filter((line) => (line.blockKey ?? DEFAULT_BLOCK_KEY) === blockKey).forEach((line) => forgetLinePhotos(line.key));
    setState((s) => ({ ...s, blocks: s.blocks.filter((block) => block.key !== blockKey), lines: s.lines.filter((line) => (line.blockKey ?? DEFAULT_BLOCK_KEY) !== blockKey) }));
    const next = state.blocks.find((block) => block.key !== blockKey);
    if (next) setActiveBlockKey(next.key);
  };
  const addBlock = () => {
    const key = nextBlockKey();
    setState((s) => ({ ...s, blocks: [...s.blocks, emptySizeBlock(key, `Format ${s.blocks.length + 1}`)] }));
    setActiveBlockKey(key);
  };
  const addPhotos = (lineKey: string, files: FileList | null) => {
    if (!files) return;
    const currentCount = photoCount(lineKey);
    const accepted = [...files].filter((file) => QUOTE_OPERATION_PHOTO_MIME_TYPES.includes(file.type as never) && file.size <= QUOTE_OPERATION_PHOTO_MAX_BYTES)
      .slice(0, Math.max(0, QUOTE_OPERATION_PHOTO_MAX_PER_LINE - currentCount));
    if (accepted.length !== files.length) setProblems([`Maximum ${QUOTE_OPERATION_PHOTO_MAX_PER_LINE} photos JPEG ou PNG de 8 Mo par prestation.`]);
    setPendingPhotos((photos) => ({ ...photos, [lineKey]: [...(photos[lineKey] ?? []), ...accepted.map((file) => ({ key: `${lineKey}-${nextKey()}`, file, caption: "", includeInPdf: true, previewUrl: URL.createObjectURL(file), keepAsExample: false }))] }));
  };

  const readiness = profileReadiness(profile, "quote");
  const regime = profile.vatRegime;
  const [quoteVatRate, setQuoteVatRate] = useState<number | "mixed">(() => {
    const rates = [...new Set(initial.lines.map((line) => line.vatRateBps))];
    return rates.length > 1 ? "mixed" : rates[0] ?? profile.defaultVatRateBps;
  });
  const activeVatRate = quoteVatRate === "mixed" ? profile.defaultVatRateBps : quoteVatRate;
  const totals = useMemo(() => totalsOf(state, regime), [state, regime]);
  const dims = formatDimensions({ heightMm: parseMillimetres(state.height), widthMm: parseMillimetres(state.width), spineMm: parseMillimetres(state.spine) });
  const showVat = regime !== "FRANCHISE";
  const activeLines = state.lines.filter((line) => (line.blockKey ?? DEFAULT_BLOCK_KEY) === activeBlockKey);
  const activeBlockTotal = activeLines.reduce((sum, line) => sum + lineTotalCents(line) * (activeBlock?.bookCount ?? 1), 0);
  const activeDimensions = activeBlock ? formatDimensions({ heightMm: parseMillimetres(activeBlock.height), widthMm: parseMillimetres(activeBlock.width), spineMm: parseMillimetres(activeBlock.spine) }) : null;

  const palette = resolvePricePalette(services, basePrices);
  const catalogServices: CatalogService[] = palette.workshop
    .map((s) => ({ id: s.id, categoryId: s.categoryId, name: s.name, description: s.description, unitPriceCents: s.unitPriceCents, vatRateBps: s.vatRateBps, unit: s.unit, referenceVersion: s.referenceVersion, referenceOperationKey: s.referenceOperationKey }));
  const favoriteServices = palette.workshop.filter((service) => service.isFavorite).map((service) => catalogServices.find((item) => item.id === service.id)!);
  const favoriteBaseServices = palette.base.filter((service) => service.isFavorite);
  const recentlyUsed = recentServices(catalogServices, recentIds);

  // --- Catalogue ----------------------------------------------------------------
  const selectedServiceIds = new Set(state.lines.filter((line) => (line.blockKey ?? DEFAULT_BLOCK_KEY) === activeBlockKey).map((l) => l.serviceId).filter(Boolean));
  const toggleService = (service: CatalogService) => {
    const selected = state.lines.find((line) => line.serviceId === service.id && (line.blockKey ?? DEFAULT_BLOCK_KEY) === activeBlockKey);
    if (selected) removeLine(selected.key);
    else addLine({ ...lineFromService(service, activeVatRate, nextKey()), blockKey: activeBlockKey });
    setMobilePaletteOpen(false);
  };
  const addBasePrice = (service: (typeof basePrices)[number]) => {
    addLine({ ...lineFromBasePrice(service, activeVatRate, nextKey()), blockKey: activeBlockKey });
    setMobilePaletteOpen(false);
  };
  const addFreeLine = (label = "") => {
    setState((s) => ({ ...s, lines: [...s.lines, { ...freeLine(activeVatRate, nextKey(), label), blockKey: activeBlockKey }] }));
    setMobilePaletteOpen(false);
  };
  const applyVatRate = (rate: number) => {
    setQuoteVatRate(rate);
    setState((current) => ({ ...current, lines: current.lines.map((line) => ({ ...line, vatRateBps: rate })) }));
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
  const allGroups = [
    ...categories.map((c) => ({ id: c.id, name: c.name, items: catalogServices.filter((s) => s.categoryId === c.id) })),
    { id: "none", name: "Autres", items: catalogServices.filter((s) => s.categoryId === null || !categories.some((c) => c.id === s.categoryId)) },
  ].filter((g) => g.items.length > 0);
  const groups = allGroups
    .map((g) => ({ ...g, items: matchingServices ? g.items.filter((s) => matchingServices.has(s.id)) : g.items }))
    .filter((g) => g.items.length > 0);
  const baseGroups = [...new Set(palette.base.map((service) => baseFamily(service.label)))].map((name) => ({
    id: `base-${name}`,
    name,
    items: palette.base.filter((service) => baseFamily(service.label) === name),
  }));

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
      ...freeLine(activeVatRate, nextKey(), operation.customerName || operation.canonicalName), blockKey: activeBlockKey,
      unit: operation.unitCandidates[0] ?? null, description: "",
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
      for (const photoId of photoIdsToDelete) {
        await deletePhoto({ data: { id: photoId } });
        setPhotoIdsToDelete((ids) => ids.filter((id) => id !== photoId));
      }
      const quote = savedDraftId ? await update({ data: { id: savedDraftId, quote: built.input } }) : await create({ data: built.input });
      setSavedDraftId(quote.id);
      try {
        for (const [lineKey, photos] of Object.entries(pendingPhotos)) {
          const target = photoTargetOfLine(state.lines.find((candidate) => candidate.key === lineKey) ?? { serviceId: null });
          for (const photo of photos) {
            const mimeType = photo.file.type as "image/jpeg" | "image/png";
            const imageBase64 = await fileToBase64(photo.file);
            const caption = photo.caption.trim() || null;
            // La bibliothèque d'abord : si le devis échoue ensuite, un nouvel essai ne l'enregistre pas deux fois.
            if (photo.keepAsExample && target) {
              await saveExample({ data: { target, mimeType, imageBase64, caption } });
              setPendingPhotos((all) => ({ ...all, [lineKey]: (all[lineKey] ?? []).map((candidate) => candidate.key === photo.key ? { ...candidate, keepAsExample: false } : candidate) }));
            }
            await uploadPhoto({ data: { quoteId: quote.id, lineKey, filename: photo.file.name, mimeType, imageBase64, caption, includeInPdf: photo.includeInPdf } });
            URL.revokeObjectURL(photo.previewUrl);
            setPendingPhotos((all) => ({ ...all, [lineKey]: (all[lineKey] ?? []).filter((candidate) => candidate.key !== photo.key) }));
          }
        }
        for (const [lineKey, picks] of Object.entries(examplePicks)) {
          for (const pick of picks) {
            await attachExample({ data: { quoteId: quote.id, lineKey, photoId: pick.photoId, caption: pick.caption.trim() || null, includeInPdf: pick.includeInPdf } });
            setExamplePicks((all) => ({ ...all, [lineKey]: (all[lineKey] ?? []).filter((candidate) => candidate.key !== pick.key) }));
          }
        }
      } catch (error) {
        throw Object.assign(error instanceof Error ? error : new Error("photo_upload_failed"), { photoUploadFailed: true });
      }
      return quote;
    },
    onSuccess: (quote) => {
      savedRef.current = true;
      void queryClient.invalidateQueries({ queryKey: QUOTES_KEY });
      void queryClient.invalidateQueries({ queryKey: CLIENTS_KEY });
      void queryClient.invalidateQueries({ queryKey: WORK_KEY });
      void queryClient.invalidateQueries({ queryKey: WORKS_KEY });
      void queryClient.invalidateQueries({ queryKey: OPERATION_PHOTOS_KEY });
      void navigate({ to: "/atelier/devis/$quoteId", params: { quoteId: quote.id } });
    },
    onError: (error) => {
      const local = (error as { problems?: string[] }).problems;
      if (local) {
        setProblems(local);
        return;
      }
      if ((error as { photoUploadFailed?: boolean }).photoUploadFailed) {
        setProblems(["Le devis est conservé en brouillon. Certaines photos n'ont pas été ajoutées ; réessayez."]);
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
            <div className="mt-5 space-y-6">
              {(favoriteServices.length > 0 || favoriteBaseServices.length > 0) && !needle && (
                <div>
                  <h3 className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#7a2230]">★ Favoris</h3>
                  <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    {favoriteServices.map((service) => <ServiceChoice key={service.id} service={service} selected={selectedServiceIds.has(service.id)} onClick={() => toggleService(service)} />)}
                    {favoriteBaseServices.map((service) => <li key={service.pricingKey}><button type="button" onClick={() => addBasePrice(service)} className="flex min-h-11 w-full items-center gap-3 rounded-sm border border-[#cfc5b6] bg-[#fffdf8] px-3 py-2 text-left text-sm hover:bg-[#f5f0e8]"><span aria-hidden="true" className="text-amber-500">★</span><span className="min-w-0 flex-1">{service.label}</span><span className="text-[#74695d]">{service.pricingMode === "manual_review" ? "Sur étude" : euros(service.unitPriceCents ?? 0)}</span></button></li>)}
                  </ul>
                </div>
              )}
              {recentlyUsed.length > 0 && !needle && <div>
                <h3 className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#74695d]">↻ Récentes</h3>
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">{recentlyUsed.slice(0, 8).map((service) => <ServiceChoice key={service.id} service={service} selected={selectedServiceIds.has(service.id)} onClick={() => toggleService(service)} />)}</ul>
              </div>}
              {quickBase.length > 0 && <div>
                <h3 className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#74695d]">Prestations fréquentes</h3>
                <ul className="grid gap-2">{quickBase.map((service) => <li key={service.pricingKey}><button type="button" className="flex min-h-11 w-full items-center justify-between gap-2 rounded-sm border border-[#cfc5b6] bg-[#fffdf8] px-3 py-2 text-left text-sm hover:border-[#7a2230]/45 hover:bg-[#f5f0e8]" onClick={() => addBasePrice(service)}><span>+ {service.label}</span><span className="tabular-nums text-[#74695d]">{service.pricingMode === "manual_review" ? "Sur étude" : euros(service.unitPriceCents ?? 0)}</span></button></li>)}</ul>
              </div>}

              {!needle && (allGroups.length > 0 || baseGroups.length > 0) && <div>
                <h3 className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#74695d]">Catégories</h3>
                <div className="flex flex-wrap gap-2">
                  {[...allGroups.map((group) => ({ id: group.id, name: group.name, count: group.items.length })), ...baseGroups.map((group) => ({ id: group.id, name: group.name, count: group.items.length }))].map((group) => (
                    <button key={group.id} type="button" aria-pressed={openCategory === group.id} onClick={() => setOpenCategory((current) => current === group.id ? null : group.id)} className={`min-h-10 rounded-full border px-3 text-xs font-semibold ${openCategory === group.id ? "border-[#241a12] bg-[#241a12] text-white" : "border-[#cfc5b6] bg-[#fffdf8] text-[#5d5146] hover:border-[#796b5d]"}`}>{group.name} <span className="opacity-60">{group.count}</span></button>
                  ))}
                </div>
                {allGroups.filter((group) => group.id === openCategory).map((group) => <ul key={group.id} className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">{group.items.map((service) => <ServiceChoice key={service.id} service={service} selected={selectedServiceIds.has(service.id)} onClick={() => toggleService(service)} />)}</ul>)}
                {baseGroups.filter((group) => group.id === openCategory).map((group) => <ul key={group.id} className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">{group.items.map((service) => <li key={service.pricingKey}><button type="button" onClick={() => addBasePrice(service)} className="flex min-h-11 w-full items-center gap-3 rounded-sm border border-[#cfc5b6] bg-[#fffdf8] px-3 py-2 text-left text-sm hover:border-[#7a2230]/45 hover:bg-[#f5f0e8]"><span aria-hidden="true" className="text-[#7a2230]">+</span><span className="min-w-0 flex-1 break-words leading-snug">{service.label}</span><span className="shrink-0 tabular-nums text-[#74695d]">{service.pricingMode === "manual_review" ? "Sur étude" : euros(service.unitPriceCents ?? 0)}</span></button></li>)}</ul>)}
              </div>}

              <div className="border-t border-[#d8d0c4] pt-5">
                <h3 className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#74695d]">Recherche</h3>
                <div className="relative w-full">
                  <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#74695d]" />
                  <input aria-label="Rechercher une prestation" placeholder="Rechercher une prestation…" className={`${FIELD} pl-9`} value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </div>
              {needle && groups.map((group) => <div key={group.id}><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.name}</h3><ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">{group.items.map((service) => <ServiceChoice key={service.id} service={service} selected={selectedServiceIds.has(service.id)} onClick={() => toggleService(service)} />)}</ul></div>)}
              {needle && baseMatches.length > 0 && <div><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tarifs disponibles</h3><ul className="grid gap-2">{baseMatches.map((service) => <li key={service.pricingKey}><button type="button" onClick={() => addBasePrice(service)} className="flex min-h-11 w-full items-center gap-3 rounded-sm border border-[#cfc5b6] bg-[#fffdf8] px-3 py-2 text-left text-sm hover:bg-[#f5f0e8]"><span aria-hidden="true">+</span><span className="min-w-0 flex-1">{service.label}</span><span className="text-[#74695d]">{service.pricingMode === "manual_review" ? "Sur étude" : euros(service.unitPriceCents ?? 0)}</span></button></li>)}</ul></div>}
              {needle && referenceHits.length > 0 && <div><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Autres prestations</h3><ul className="grid gap-2">{referenceHits.map(({ operation }) => <li key={operation.key}><button type="button" className="min-h-11 w-full rounded-sm border border-[#cfc5b6] px-3 py-2 text-left text-sm hover:bg-[#f5f0e8]" onClick={() => addReference(operation)}>+ {operation.customerName || operation.canonicalName}</button></li>)}</ul></div>}
              {referenceError && needle && <p className="text-xs text-destructive">La recherche étendue ne peut pas être chargée.</p>}
              {needle && groups.length === 0 && baseMatches.length === 0 && referenceHits.length === 0 && <p className="text-sm text-muted-foreground">Aucune prestation ne correspond à « {search} ».</p>}
              <p className="text-xs text-muted-foreground">
                Un prix manque ou doit changer ?{" "}
                <Link to="/atelier/tarifs" className="underline">Modifier mon catalogue</Link>.
              </p>
              <button type="button" className={`${SECONDARY_BUTTON} w-full`} onClick={() => addFreeLine()}>+ Ligne libre</button>
            </div>
          )}
        </section>

        {/* ── Colonne 3 : résumé en direct ─────────────────────────────────────────── */}
        <aside ref={summaryRef} aria-labelledby="summary-title" className="lg:col-span-2 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)] lg:items-start lg:gap-5">
          {/* Sur ordinateur, seules les lignes défilent : le total et « Générer le devis » restent à l'écran. */}
          <div className={`${CARD} lg:contents`}>
            <div className="min-w-0 lg:rounded-lg lg:border lg:border-border lg:bg-card lg:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 id="summary-title" className="font-serif text-lg">Formats et prestations</h2>
                <p className="mt-1 text-sm text-muted-foreground">Un bloc peut représenter une taille et plusieurs livres identiques.</p>
              </div>
              <button type="button" className={SECONDARY_BUTTON} onClick={addBlock}><Plus aria-hidden="true" className="mr-1 h-4 w-4" /> Ajouter un format</button>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Formats du devis">
              {state.blocks.map((block) => {
                const count = state.lines.filter((line) => (line.blockKey ?? DEFAULT_BLOCK_KEY) === block.key).length;
                return <button key={block.key} type="button" role="tab" aria-selected={block.key === activeBlockKey} onClick={() => setActiveBlockKey(block.key)} className={`min-h-11 shrink-0 rounded-md border px-3 py-2 text-left text-sm ${block.key === activeBlockKey ? "border-[#7a2230] bg-[#f7eff0] text-[#5f1b27]" : "border-[#cfc5b6] bg-[#fffdf8]"}`}>
                  <strong className="block">{block.label || "Format sans nom"}</strong>
                  <span className="text-xs text-muted-foreground">{block.bookCount} livre{block.bookCount > 1 ? "s" : ""} · {count} prestation{count > 1 ? "s" : ""}</span>
                </button>;
              })}
            </div>

            {activeBlock && <div className="mt-3 rounded-md border border-[#d8d0c4] bg-[#f8f4ed] p-3">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px_auto] sm:items-end">
                <Field label="Nom du format" htmlFor={`block-label-${activeBlock.key}`}><input id={`block-label-${activeBlock.key}`} className={FIELD} value={activeBlock.label} onChange={(event) => setBlock(activeBlock.key, { label: event.target.value })} placeholder="Ex. Petit format" /></Field>
                <Field label="Nombre de livres" htmlFor={`block-count-${activeBlock.key}`}><input id={`block-count-${activeBlock.key}`} type="number" min={1} max={10000} className={`${FIELD} text-center`} value={activeBlock.bookCount} onChange={(event) => setBlock(activeBlock.key, { bookCount: Math.max(1, Math.min(10000, Number(event.target.value) || 1)) })} /></Field>
                {state.blocks.length > 1 && <button type="button" className="flex min-h-11 items-center justify-center rounded-md px-3 text-sm text-destructive hover:bg-destructive/10" onClick={() => removeBlock(activeBlock.key)}><Trash2 aria-hidden="true" className="mr-1 h-4 w-4" /> Retirer</button>}
              </div>
              <Field label="Dimensions en mm (hauteur × largeur × dos)" htmlFor={`block-height-${activeBlock.key}`}>
                <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2">
                  <input id={`block-height-${activeBlock.key}`} aria-label={`Hauteur — ${activeBlock.label}`} inputMode="decimal" placeholder="220" className={`${FIELD} text-center`} value={activeBlock.height} onChange={(event) => setBlock(activeBlock.key, { height: event.target.value })} />
                  <span aria-hidden="true">×</span>
                  <input aria-label={`Largeur — ${activeBlock.label}`} inputMode="decimal" placeholder="145" className={`${FIELD} text-center`} value={activeBlock.width} onChange={(event) => setBlock(activeBlock.key, { width: event.target.value })} />
                  <span aria-hidden="true">×</span>
                  <input aria-label={`Dos — ${activeBlock.label}`} inputMode="decimal" placeholder="32" className={`${FIELD} text-center`} value={activeBlock.spine} onChange={(event) => setBlock(activeBlock.key, { spine: event.target.value })} />
                </div>
              </Field>
              <p className="mt-2 text-xs text-muted-foreground">{activeDimensions ?? "Dimensions facultatives"} · Sous-total du bloc : <strong className="text-foreground">{euros(activeBlockTotal)}</strong></p>
            </div>}

            {showVat && (
              <div className="mt-4 flex flex-wrap items-end gap-3 border-y border-[#d8d0c4] bg-[#f8f4ed] px-3 py-3">
                <Field label="TVA du devis" htmlFor="quote-vat-rate">
                  <select id="quote-vat-rate" className={`${FIELD} min-w-40`} value={quoteVatRate} onChange={(event) => {
                    if (event.target.value === "mixed") return;
                    applyVatRate(Number(event.target.value));
                  }}>
                    {quoteVatRate === "mixed" && <option value="mixed">Taux mixtes (ancien devis)</option>}
                    {COMMON_VAT_RATES.map((rate) => <option key={rate} value={rate}>{String(rate / 100).replace(".", ",")} %</option>)}
                    {typeof quoteVatRate === "number" && !COMMON_VAT_RATES.includes(quoteVatRate as typeof COMMON_VAT_RATES[number]) && <option value={quoteVatRate}>{String(quoteVatRate / 100).replace(".", ",")} %</option>}
                  </select>
                </Field>
                <details className="relative">
                  <summary className="flex min-h-11 cursor-pointer items-center text-xs font-semibold text-[#5f1b27] underline underline-offset-4">Autre taux…</summary>
                  <div className="absolute right-0 top-full z-10 mt-1 w-52 border border-[#cfc5b6] bg-[#fffdf8] p-3 shadow-lg">
                    <label htmlFor="custom-vat" className="text-xs font-medium text-[#685d51]">Taux en %</label>
                    <input id="custom-vat" inputMode="decimal" className={`${FIELD} mt-1`} placeholder="ex. 8,5" onBlur={(event) => { const rate = parsePercentToBps(event.target.value); if (rate !== null) applyVatRate(rate); }} />
                    <p className="mt-1 text-[0.68rem] text-[#74695d]">Appliqué à toutes les lignes.</p>
                  </div>
                </details>
              </div>
            )}

            {activeLines.length === 0 ? (
              <p className="mt-4 rounded-md bg-muted px-3 py-4 text-sm text-muted-foreground">
                Cochez les prestations à réaliser : le prix s'ajoute ici, immédiatement.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-[#d8d0c4] border-y border-[#cfc5b6] bg-[#fffdf8]">
                {activeLines.map((line) => {
                  const total = line.quantity > 0 ? lineTotalCents(line) * (activeBlock?.bookCount ?? 1) : 0;
                  const adjusted = isPriceAdjusted(line);
                  return (
                    <li key={line.key}>
                      <details className="group">
                        <summary className="grid min-h-20 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-3 [&::-webkit-details-marker]:hidden">
                          <span className="min-w-0"><strong className="block truncate text-sm font-semibold">{line.label || "Prestation sans libellé"}</strong><span className="mt-1 block text-xs text-[#74695d]">{String(line.quantity).replace(".", ",")} × {line.unit || "unité"} · {euros(line.unitPriceCents)} HT{photoCount(line.key) > 0 && ` · ${photoCount(line.key)} photo${photoCount(line.key) > 1 ? "s" : ""}`}</span></span>
                          <strong className="text-sm tabular-nums">{line.requiresManualPrice && line.unitPriceCents === 0 ? "À chiffrer" : euros(total)}</strong>
                          <ChevronDown aria-hidden="true" className="h-4 w-4 text-[#74695d] transition group-open:rotate-180" />
                        </summary>
                        <div className="border-t border-[#e2dbd0] bg-[#faf7f1] px-3 py-4">
                          <div className="flex items-start gap-2">
                            <input aria-label="Libellé de la ligne" placeholder="Libellé (ex. Réparation du premier cahier)" className={`${FIELD} flex-1 font-medium`} value={line.label} onChange={(e) => setLine(line.key, { label: e.target.value })} />
                            <button type="button" aria-label={`Dupliquer ${line.label || "cette ligne"}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-sm font-semibold text-[#685d51] hover:bg-[#eee7dc]" onClick={() => setState((s) => ({ ...s, lines: s.lines.flatMap((item) => item.key === line.key ? [item, { ...item, key: nextKey() }] : [item]) }))}>×2</button>
                            <button type="button" aria-label={`Retirer ${line.label || "cette ligne"}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-[#685d51] hover:bg-[#eee7dc]" onClick={() => removeLine(line.key)}><X aria-hidden="true" className="h-4 w-4" /></button>
                          </div>
                          <div className="mt-3 grid grid-cols-[64px_minmax(0,1fr)] gap-2 sm:grid-cols-[64px_minmax(0,1fr)_minmax(0,1fr)]">
                            <QuantityInput id={`qty-${line.key}`} label={`Quantité — ${line.label || "ligne"}`} value={line.quantity} onChange={(quantity) => setLine(line.key, { quantity })} />
                            <MoneyInput id={`price-${line.key}`} label={`Prix HT — ${line.label || "ligne"}`} cents={line.unitPriceCents} onChange={(unitPriceCents) => setLine(line.key, { unitPriceCents })} invalid={line.requiresManualPrice && line.unitPriceCents === 0} blankWhenZero={line.requiresManualPrice} />
                            <input aria-label={`Unité — ${line.label || "ligne"}`} placeholder="Unité" className={`${FIELD} col-span-2 sm:col-span-1`} value={line.unit ?? ""} onChange={(e) => setLine(line.key, { unit: e.target.value || null })} />
                          </div>
                          <textarea aria-label={`Description client — ${line.label || "ligne"}`} rows={2} className={`${FIELD} mt-3 h-auto py-2`} placeholder="Description client (facultative)" value={line.description} onChange={(event) => setLine(line.key, { description: event.target.value })} />
                          <div className="mt-3 border-t border-[#e2dbd0] pt-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-[#685d51]">Photos d’exemple</p>
                              <div className="flex flex-wrap gap-2">
                                {availableExamples(line).length > 0 && <button type="button" className="inline-flex min-h-11 items-center rounded-md border border-[#cfc5b6] bg-white px-3 text-xs font-semibold hover:bg-[#f5f0e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a2230]/45" onClick={() => pickExamples(line)}><Images aria-hidden="true" className="mr-1 h-4 w-4" /> Mes exemples ({availableExamples(line).length})</button>}
                                <label className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-[#cfc5b6] bg-white px-3 text-xs font-semibold hover:bg-[#f5f0e8] focus-within:ring-2 focus-within:ring-[#7a2230]/45"><Camera aria-hidden="true" className="mr-1 h-4 w-4" /> Ajouter<input type="file" accept="image/jpeg,image/png" multiple className="sr-only" onChange={(event) => { addPhotos(line.key, event.target.files); event.currentTarget.value = ""; }} /></label>
                              </div>
                            </div>
                            {photoCount(line.key) > 0 && <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {(examplePicks[line.key] ?? []).map((pick) => <figure key={pick.key} className="relative overflow-hidden rounded-md border bg-white"><img src={pick.url} alt={pick.caption || `Exemple de l’atelier pour ${line.label}`} className="aspect-[4/3] w-full object-cover" /><span className="absolute left-1 top-1 rounded-sm bg-[#241a12]/85 px-1.5 py-0.5 text-[0.62rem] font-semibold text-white">Mon exemple</span><div className="space-y-1 p-2"><input aria-label="Légende de la photo" className={`${FIELD} h-9 text-xs`} placeholder="Légende (facultative)" value={pick.caption} onChange={(event) => setExamplePicks((all) => ({ ...all, [line.key]: (all[line.key] ?? []).map((candidate) => candidate.key === pick.key ? { ...candidate, caption: event.target.value } : candidate) }))} /><label className="flex min-h-8 items-center gap-1 text-[0.68rem] text-muted-foreground"><input type="checkbox" checked={pick.includeInPdf} onChange={(event) => setExamplePicks((all) => ({ ...all, [line.key]: (all[line.key] ?? []).map((candidate) => candidate.key === pick.key ? { ...candidate, includeInPdf: event.target.checked } : candidate) }))} /> Inclure au PDF</label></div><button type="button" aria-label="Ne pas reprendre cet exemple" className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-destructive shadow" onClick={() => setExamplePicks((all) => ({ ...all, [line.key]: (all[line.key] ?? []).filter((candidate) => candidate.key !== pick.key) }))}><X aria-hidden="true" className="h-4 w-4" /></button></figure>)}
                              {existingPhotos.filter((photo) => photo.lineKey === line.key).map((photo) => <figure key={photo.id} className="relative overflow-hidden rounded-md border bg-white"><img src={photo.url} alt={photo.caption || `Exemple pour ${line.label}`} className="aspect-[4/3] w-full object-cover" /><figcaption className="p-2 text-[0.68rem] text-muted-foreground">{photo.caption || "Photo incluse au PDF"}</figcaption><button type="button" aria-label="Retirer cette photo" className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-destructive shadow" onClick={() => queuePhotoDeletion(photo.id)}><X aria-hidden="true" className="h-4 w-4" /></button></figure>)}
                              {(pendingPhotos[line.key] ?? []).map((photo) => <figure key={photo.key} className="relative overflow-hidden rounded-md border bg-white"><img src={photo.previewUrl} alt={`Nouvel exemple pour ${line.label}`} className="aspect-[4/3] w-full object-cover" /><div className="space-y-1 p-2"><input aria-label="Légende de la photo" className={`${FIELD} h-9 text-xs`} placeholder="Légende (facultative)" value={photo.caption} onChange={(event) => setPendingPhotos((all) => ({ ...all, [line.key]: (all[line.key] ?? []).map((candidate) => candidate.key === photo.key ? { ...candidate, caption: event.target.value } : candidate) }))} /><label className="flex items-center gap-1 text-[0.68rem] text-muted-foreground"><input type="checkbox" checked={photo.includeInPdf} onChange={(event) => setPendingPhotos((all) => ({ ...all, [line.key]: (all[line.key] ?? []).map((candidate) => candidate.key === photo.key ? { ...candidate, includeInPdf: event.target.checked } : candidate) }))} /> Inclure au PDF</label>{photoTargetOfLine(line) && <label className="flex min-h-8 items-center gap-1 text-[0.68rem] text-muted-foreground"><input type="checkbox" checked={photo.keepAsExample} onChange={(event) => setPendingPhotos((all) => ({ ...all, [line.key]: (all[line.key] ?? []).map((candidate) => candidate.key === photo.key ? { ...candidate, keepAsExample: event.target.checked } : candidate) }))} /> Garder dans mes exemples</label>}</div><button type="button" aria-label="Retirer cette nouvelle photo" className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-destructive shadow" onClick={() => setPendingPhotos((all) => ({ ...all, [line.key]: (all[line.key] ?? []).filter((candidate) => candidate.key !== photo.key) }))}><X aria-hidden="true" className="h-4 w-4" /></button></figure>)}
                            </div>}
                            <p className="mt-2 text-[0.68rem] text-muted-foreground">Jusqu’à {QUOTE_OPERATION_PHOTO_MAX_PER_LINE} photos JPEG ou PNG. Elles restent privées.</p>
                          </div>
                          {line.priceSource === "base" && <p className="mt-2 text-xs text-[#74695d]">Source interne : tarif de base Ma Reliure. Cette mention ne figure pas sur le PDF client.</p>}
                          {line.requiresManualPrice && line.unitPriceCents <= 0 && <p className="mt-2 text-xs text-amber-800">Définissez le prix pour ce devis.</p>}
                          {adjusted && <p className="mt-2 text-xs text-amber-800">Prix ajusté pour ce devis (catalogue : {euros(line.catalogPriceCents ?? 0)}). <button type="button" className="underline" onClick={() => setLine(line.key, { unitPriceCents: line.catalogPriceCents ?? 0 })}>Rétablir</button></p>}
                          {line.priceSource === "manual" && !line.referenceOperationKey && line.label.trim() !== "" && line.unitPriceCents > 0 && <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={line.serviceId !== null} disabled={line.serviceId !== null || saveLineToCatalog.isPending} onChange={(event) => { if (event.target.checked) saveLineToCatalog.mutate(line); }} />Ajouter à mes prestations</label>}
                        </div>
                      </details>
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
