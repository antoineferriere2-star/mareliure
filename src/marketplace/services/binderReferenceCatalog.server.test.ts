/**
 * Le catalogue de l'atelier face au référentiel : ajouter une opération, la renommer, choisir son unité,
 * fixer son prix, la mettre en favori, la masquer, créer une prestation personnelle — et ne jamais
 * toucher ni le référentiel, ni un devis déjà fait, ni l'atelier voisin.
 *
 * Faux client Supabase en mémoire (mêmes règles que binderWorks.server.test.ts). Le comportement réel de la
 * base (CHECK des liens, colonnes, immuabilité) est vérifié sur un vrai Postgres à part.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- le faux client Supabase est volontairement non typé */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  archiveService,
  BinderQuotesError,
  createQuote,
  listCatalog,
  saveBillingProfile,
  saveCategory,
  saveService,
  updateQuote,
} from "./binderQuotes.server";
import { addReferenceService, setServiceFavorite } from "./binderReferenceCatalog.server";
import { loadReference } from "@/marketplace/reference";
import { referenceServiceInput } from "@/marketplace/reference/catalogInput";
import { QUOTE_ITEM_ROW_KEYS } from "@/marketplace/quotes/quoteBuild";
import { quoteLineInput, serviceInput, type BillingProfileInput, type QuoteInput } from "@/marketplace/quotes/quoteInput";

type Row = Record<string, any>;

const DEFAULTS: Record<string, Row> = {
  marketplace_binder_services: { is_favorite: false, is_active: true, reference_version: null, reference_operation_key: null, sort_order: 0, description: null, unit: null, vat_rate_bps: null, category_id: null },
};

function makeDb() {
  const tables: Record<string, Row[]> = {};
  const rpcCalls: { name: string; args: Row }[] = [];
  let seq = 0;
  const uid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
  const rows = (t: string) => (tables[t] ??= []);

  function from(table: string) {
    let op: "select" | "insert" | "update" | "upsert" = "select";
    let values: any;
    let onConflict: string | undefined;
    const filters: ((r: Row) => boolean)[] = [];
    let order: { col: string; asc: boolean } | null = null;
    const run = () => {
      let result: Row[];
      if (op === "insert") {
        const list = (Array.isArray(values) ? values : [values]).map((v: Row) => ({
          id: uid(), created_at: "2026-09-21T10:00:00Z", updated_at: "2026-09-21T10:00:00Z", archived_at: null, ...(DEFAULTS[table] ?? {}), ...v,
        }));
        rows(table).push(...list);
        result = list;
      } else if (op === "upsert") {
        const key = onConflict ?? "id";
        const found = rows(table).find((r) => r[key] === values[key]);
        if (found) Object.assign(found, values);
        else rows(table).push({ ...values });
        result = [found ?? rows(table)[rows(table).length - 1]];
      } else {
        result = rows(table).filter((r) => filters.every((f) => f(r)));
        if (op === "update") result.forEach((r) => Object.assign(r, values));
        if (order) result = [...result].sort((a, b) => (a[order!.col] > b[order!.col] ? 1 : -1) * (order!.asc ? 1 : -1));
      }
      return result.map((r) => ({ ...r }));
    };
    const q: any = {
      select: () => q,
      insert: (v: any) => ((op = "insert"), (values = v), q),
      update: (v: any) => ((op = "update"), (values = v), q),
      upsert: (v: any, o?: { onConflict?: string }) => ((op = "upsert"), (values = v), (onConflict = o?.onConflict), q),
      eq: (col: string, v: any) => (filters.push((r) => r[col] === v), q),
      in: (col: string, v: any[]) => (filters.push((r) => v.includes(r[col])), q),
      order: (col: string, o?: { ascending?: boolean }) => ((order = { col, asc: o?.ascending !== false }), q),
      limit: () => q,
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      single: async () => {
        const r = run()[0];
        return r ? { data: r, error: null } : { data: null, error: { message: "no rows" } };
      },
      then: (resolve: any, reject: any) => Promise.resolve({ data: run(), error: null }).then(resolve, reject),
    };
    return q;
  }

  async function rpc(name: string, args: Row) {
    rpcCalls.push({ name, args: JSON.parse(JSON.stringify(args)) });
    if (name === "marketplace_binder_create_quote") {
      const id = uid();
      rows("marketplace_binder_quotes").push({ ...args.p_quote, id, binder_id: args.p_binder_id, status: "draft", created_at: "2026-09-21T10:00:00Z", quote_number: `D-2026-${String(rows("marketplace_binder_quotes").length + 1).padStart(4, "0")}` });
      args.p_items.forEach((item: Row, i: number) => rows("marketplace_binder_quote_items").push({ ...item, id: uid(), quote_id: id, binder_id: args.p_binder_id, position: i + 1 }));
      return { data: id, error: null };
    }
    if (name === "marketplace_binder_update_quote") {
      tables.marketplace_binder_quote_items = rows("marketplace_binder_quote_items").filter((i) => i.quote_id !== args.p_quote_id);
      args.p_items.forEach((item: Row, i: number) => rows("marketplace_binder_quote_items").push({ ...item, id: uid(), quote_id: args.p_quote_id, binder_id: args.p_binder_id, position: i + 1 }));
      return { data: null, error: null };
    }
    throw new Error(`unexpected rpc ${name}`);
  }
  return { sb: { from, rpc } as any, tables, rpcCalls };
}

const BINDER_A = "a0000000-0000-4000-8000-00000000000a";
const BINDER_B = "b0000000-0000-4000-8000-00000000000b";
const TODAY = "2026-09-21";

const profile = (): BillingProfileInput => ({
  workshopName: "Atelier A", binderName: null, legalName: "Atelier A SARL", legalForm: "SARL", shareCapital: null, siren: "123 456 789", addressLine1: "12 rue des Relieurs", addressLine2: null, postalCode: "45000",
  city: "Orléans", country: "FR", siret: "123 456 789 00012", vatNumber: "FR12345678901", vatOnDebits: false, legalNotes: null, email: "a@example.test",
  phone: "02 00 00 00 00", website: null, documentAccentColor: "#7A2230", documentFooter: null, vatRegime: "VAT_LIABLE", defaultVatRateBps: 2000, vatMention: null, quotePrefix: "D", invoicePrefix: "F",
  quoteValidityDays: 30, paymentTerms: null, paymentDelayDays: 30, earlyPaymentDiscountTerms: null, latePenaltyTerms: null, iban: null, quoteNotes: null, invoiceNotes: null,
});
const importInput = (over: Partial<Parameters<typeof addReferenceService>[2]> = {}) => ({
  referenceVersion: "reliure-fr-v1", referenceOperationKey: "OPR-0103", name: "Dorure titre", description: null, unit: "par titre" as string | null,
  unitPriceCents: 4500, vatRateBps: null, categoryId: null, isFavorite: false, ...over,
});
const personal = (over: Partial<Parameters<typeof saveService>[2]> = {}) => ({
  id: null, categoryId: null, name: "Mon étui maison", description: null, unitPriceCents: 9000, vatRateBps: null, unit: "pièce", isActive: true, ...over,
});
const quote = (lines: { serviceId: string | null; label: string; unit?: string | null; price: number }[]): QuoteInput => ({
  clientId: null,
  client: { name: "Mme Martin", email: null, phone: null, addressLine1: null, postalCode: null, city: null, country: null },
  book: { title: "Les Misérables", author: null, heightMm: 220, widthMm: 145, spineMm: 32, notes: null },
  blocks: [{ key: "format-principal", label: "Format principal", bookCount: 1, heightMm: 220, widthMm: 145, spineMm: 32 }],
  lines: lines.map((l, index) => ({ lineKey: `ligne-${index + 1}`, blockKey: "format-principal", serviceId: l.serviceId, label: l.label, description: null, unit: l.unit ?? null, quantity: 1, unitPriceCents: l.price, catalogPriceCents: null, vatRateBps: 2000 })),
  discount: { type: "NONE" }, deposit: { type: "NONE" }, validityDays: null, notes: null,
});

let world: ReturnType<typeof makeDb>;
beforeEach(() => {
  world = makeDb();
});

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof BinderQuotesError) return error.code;
    throw error;
  }
  return "no error";
};

describe("ajouter une opération du référentiel à mon catalogue", () => {
  it("crée UNE prestation de l'atelier : lien (version, clé), nom, unité et prix de l'atelier", async () => {
    const s = await addReferenceService(world.sb, BINDER_A, importInput());
    expect(s).toMatchObject({ name: "Dorure titre", unit: "par titre", unitPriceCents: 4500, isActive: true, isFavorite: false, referenceVersion: "reliure-fr-v1", referenceOperationKey: "OPR-0103", archived: false });
    const row = world.tables.marketplace_binder_services[0];
    expect(row.binder_id).toBe(BINDER_A);
    expect(row.reference_version).toBe("reliure-fr-v1");
    expect(row.reference_operation_key).toBe("OPR-0103");
  });

  it("le prix est celui de l'atelier, exactement — rien ne vient du référentiel", async () => {
    const s = await addReferenceService(world.sb, BINDER_A, importInput({ unitPriceCents: 5200 }));
    expect(s.unitPriceCents).toBe(5200);
    expect((await addReferenceService(world.sb, BINDER_A, importInput({ unitPriceCents: 0 }))).unitPriceCents).toBe(0);
  });

  it("le nom est celui que l'atelier écrit (renommage), pas celui de l'opération", async () => {
    const found = (await loadReference()).operations.find((o) => o.key === "OPR-0103")!;
    const s = await addReferenceService(world.sb, BINDER_A, importInput({ name: "Titrage doré du dos" }));
    expect(s.name).toBe("Titrage doré du dos");
    expect(s.name).not.toBe(found.canonicalName);
  });

  it("l'unité reste ouverte : une unité personnelle est stockée telle quelle", async () => {
    const s = await addReferenceService(world.sb, BINDER_A, importInput({ unit: "séance de dorure à la feuille" }));
    expect(s.unit).toBe("séance de dorure à la feuille");
    expect((await addReferenceService(world.sb, BINDER_A, importInput({ unit: null }))).unit).toBeNull();
  });

  it("favori : à l'ajout, puis à volonté", async () => {
    const s = await addReferenceService(world.sb, BINDER_A, importInput({ isFavorite: true }));
    expect(s.isFavorite).toBe(true);
    expect((await setServiceFavorite(world.sb, BINDER_A, { id: s.id, isFavorite: false })).isFavorite).toBe(false);
    expect((await setServiceFavorite(world.sb, BINDER_A, { id: s.id, isFavorite: true })).isFavorite).toBe(true);
  });

  it("le même opération peut être ajoutée deux fois (deux unités, deux noms) : l'atelier décide", async () => {
    await addReferenceService(world.sb, BINDER_A, importInput({ name: "Titrage à la ligne", unit: "par ligne" }));
    await addReferenceService(world.sb, BINDER_A, importInput({ name: "Titrage au forfait", unit: null }));
    expect((await listCatalog(world.sb, BINDER_A)).services).toHaveLength(2);
  });

  it("refuse une version inconnue, une clé inconnue — et n'écrit rien", async () => {
    expect(await codeOf(addReferenceService(world.sb, BINDER_A, importInput({ referenceVersion: "reliure-fr-v2" })))).toBe("invalid_input");
    expect(await codeOf(addReferenceService(world.sb, BINDER_A, importInput({ referenceOperationKey: "OPR-9999" })))).toBe("invalid_input");
    expect(world.tables.marketplace_binder_services ?? []).toHaveLength(0);
  });

  it("refuse les natures exclues, même si le navigateur les envoie : ajustement, matériau, « prestation sur devis »", async () => {
    const { operations } = await loadReference();
    const byName = (n: string) => operations.find((o) => o.canonicalName === n)!.key;
    for (const name of ["Majoration de grand format", "Remise de série", "Forfait de préparation non standard", "Choix de cuir", "Choix de toile", "Prestation sur devis"]) {
      expect(await codeOf(addReferenceService(world.sb, BINDER_A, importInput({ referenceOperationKey: byName(name) }))), name).toBe("invalid_input");
    }
    expect(world.tables.marketplace_binder_services ?? []).toHaveLength(0);
  });

  it("chaque opération importable de la ressource peut être ajoutée ; aucune autre", async () => {
    const { operations } = await loadReference();
    const importable = operations.filter((o) => ["operation", "package", "diagnostic"].includes(o.kind) && o.active);
    expect(importable).toHaveLength(186);
    for (const op of importable.slice(0, 5)) expect(await codeOf(addReferenceService(world.sb, BINDER_A, importInput({ referenceOperationKey: op.key })))).toBe("no error");
  });

  it("la catégorie doit être celle de l'atelier", async () => {
    const foreign = await saveCategory(world.sb, BINDER_B, { id: null, name: "Étuis", sortOrder: 0 });
    expect(await codeOf(addReferenceService(world.sb, BINDER_A, importInput({ categoryId: foreign.id })))).toBe("invalid_input");
    expect(world.tables.marketplace_binder_services ?? []).toHaveLength(0);
    const own = await saveCategory(world.sb, BINDER_A, { id: null, name: "Titrage", sortOrder: 0 });
    expect((await addReferenceService(world.sb, BINDER_A, importInput({ categoryId: own.id }))).categoryId).toBe(own.id);
  });
});

describe("une prestation totalement personnelle", () => {
  it("n'a aucun lien au référentiel et n'est pas favorite par défaut", async () => {
    const s = await saveService(world.sb, BINDER_A, personal());
    expect(s).toMatchObject({ referenceVersion: null, referenceOperationKey: null, isFavorite: false, name: "Mon étui maison", unit: "pièce", unitPriceCents: 9000 });
  });

  it("peut être créée en favori", async () => {
    expect((await saveService(world.sb, BINDER_A, personal({ isFavorite: true }))).isFavorite).toBe(true);
  });
});

describe("l'atelier reste propriétaire — ce que modifier une prestation ne change pas", () => {
  it("enregistrer un prix, un nom, une unité ou masquer ne touche ni le lien ni le favori", async () => {
    const s = await addReferenceService(world.sb, BINDER_A, importInput({ isFavorite: true }));
    const updated = await saveService(world.sb, BINDER_A, { id: s.id, categoryId: null, name: "Mon titrage", description: "à la main", unitPriceCents: 5800, vatRateBps: 550, unit: "ligne", isActive: false });
    expect(updated).toMatchObject({ name: "Mon titrage", unitPriceCents: 5800, unit: "ligne", isActive: false, isFavorite: true, referenceVersion: "reliure-fr-v1", referenceOperationKey: "OPR-0103" });
  });

  it("le favori change seulement quand on le demande", async () => {
    const s = await saveService(world.sb, BINDER_A, personal({ isFavorite: true }));
    expect((await saveService(world.sb, BINDER_A, { ...personal({ id: s.id, isFavorite: false }) })).isFavorite).toBe(false);
  });

  it("le navigateur ne peut PAS écrire le lien depuis saveService : le schéma refuse le champ (.strict())", () => {
    for (const extra of [{ referenceVersion: "reliure-fr-v1" }, { referenceOperationKey: "OPR-0001" }, { reference_operation_key: "OPR-0001" }, { binderId: BINDER_B }]) {
      expect(serviceInput.safeParse({ ...personal(), ...extra }).success, JSON.stringify(extra)).toBe(false);
    }
  });

  it("masquer, retirer et renommer ne touchent jamais le référentiel", async () => {
    const before = JSON.stringify((await loadReference()).operations);
    const s = await addReferenceService(world.sb, BINDER_A, importInput());
    await saveService(world.sb, BINDER_A, { id: s.id, categoryId: null, name: "Autre nom", description: null, unitPriceCents: 1, vatRateBps: null, unit: null, isActive: false });
    await archiveService(world.sb, BINDER_A, s.id);
    expect((await listCatalog(world.sb, BINDER_A)).services).toHaveLength(0);
    expect((await listCatalog(world.sb, BINDER_A, { includeArchived: true })).services[0]).toMatchObject({ archived: true, referenceOperationKey: "OPR-0103" });
    expect(JSON.stringify((await loadReference()).operations)).toBe(before);
    expect((await loadReference()).operations).toHaveLength(195);
  });

  it("masquer (inactive) puis retirer une prestation ne supprime aucune ligne : l'atelier garde son historique", async () => {
    const s = await addReferenceService(world.sb, BINDER_A, importInput());
    await archiveService(world.sb, BINDER_A, s.id);
    expect(world.tables.marketplace_binder_services).toHaveLength(1);
    expect(world.tables.marketplace_binder_services[0].archived_at).not.toBeNull();
  });
});

describe("isolation entre ateliers", () => {
  it("l'atelier B ne voit pas, n'ajoute pas sur et ne met pas en favori la prestation de l'atelier A", async () => {
    const a = await addReferenceService(world.sb, BINDER_A, importInput({ isFavorite: true }));
    expect((await listCatalog(world.sb, BINDER_B)).services).toEqual([]);
    expect(await codeOf(setServiceFavorite(world.sb, BINDER_B, { id: a.id, isFavorite: false }))).toBe("not_found");
    expect(world.tables.marketplace_binder_services[0].is_favorite).toBe(true); // refusé APRÈS coup ne suffit pas : rien n'a bougé
    expect(await codeOf(saveService(world.sb, BINDER_B, { id: a.id, categoryId: null, name: "Piraté", description: null, unitPriceCents: 1, vatRateBps: null, unit: null, isActive: false }))).toBe("not_found");
    expect(world.tables.marketplace_binder_services[0]).toMatchObject({ name: "Dorure titre", unit_price_cents: 4500, reference_operation_key: "OPR-0103" });
  });

  it("chaque atelier importe SA prestation : les deux ont la même opération, chacun son prix", async () => {
    await addReferenceService(world.sb, BINDER_A, importInput({ unitPriceCents: 4500 }));
    await addReferenceService(world.sb, BINDER_B, importInput({ unitPriceCents: 6000, name: "Titrage" }));
    expect((await listCatalog(world.sb, BINDER_A)).services.map((s) => [s.name, s.unitPriceCents])).toEqual([["Dorure titre", 4500]]);
    expect((await listCatalog(world.sb, BINDER_B)).services.map((s) => [s.name, s.unitPriceCents])).toEqual([["Titrage", 6000]]);
  });
});

describe("la provenance sur les lignes de devis — recopiée, jamais réécrite", () => {
  beforeEach(async () => {
    await saveBillingProfile(world.sb, BINDER_A, profile());
  });
  const items = () => world.tables.marketplace_binder_quote_items;
  const lastCreate = () => world.rpcCalls.filter((c) => c.name === "marketplace_binder_create_quote").at(-1)!;

  it("une ligne d'une prestation liée reçoit (version, clé) ; une ligne libre et une prestation personnelle, rien", async () => {
    const linked = await addReferenceService(world.sb, BINDER_A, importInput());
    const own = await saveService(world.sb, BINDER_A, personal());
    await createQuote(world.sb, BINDER_A, quote([{ serviceId: linked.id, label: "Dorure titre", price: 4500 }, { serviceId: own.id, label: "Mon étui maison", price: 9000 }, { serviceId: null, label: "Ligne libre", price: 1000 }]), TODAY);
    const sent = lastCreate().args.p_items as Row[];
    expect(sent[0]).toMatchObject({ reference_version: "reliure-fr-v1", reference_operation_key: "OPR-0103" });
    for (const plain of [sent[1], sent[2]]) expect(Object.keys(plain).sort()).toEqual([...QUOTE_ITEM_ROW_KEYS].sort());
  });

  it("un devis historique — sans aucune prestation liée — envoie EXACTEMENT les clés d'avant", async () => {
    const own = await saveService(world.sb, BINDER_A, personal());
    await createQuote(world.sb, BINDER_A, quote([{ serviceId: own.id, label: "Mon étui maison", price: 9000 }, { serviceId: null, label: "Libre", price: 100 }]), TODAY);
    for (const item of lastCreate().args.p_items as Row[]) expect(Object.keys(item).sort()).toEqual([...QUOTE_ITEM_ROW_KEYS].sort());
  });

  it("une référence libre exige les deux clés vérifiées ; les colonnes SQL restent interdites en entrée", async () => {
    const line = quote([{ serviceId: null, label: "x", price: 1 }]).lines[0];
    expect(quoteLineInput.safeParse({ ...line, reference_operation_key: "OPR-0103" }).success).toBe(false);
    expect(quoteLineInput.safeParse({ ...line, referenceVersion: "reliure-fr-v1", referenceOperationKey: "OPR-0103" }).success).toBe(true);
    await expect(createQuote(world.sb, BINDER_A, {
      ...quote([{ serviceId: null, label: "x", price: 1 }]),
      lines: [{ ...line, referenceVersion: "reliure-fr-v1" }],
    }, TODAY)).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("le libellé, l'unité, la quantité et le prix restent des snapshots : renommer ou re-tarifer la prestation ensuite ne change pas le devis", async () => {
    const linked = await addReferenceService(world.sb, BINDER_A, importInput());
    await createQuote(world.sb, BINDER_A, quote([{ serviceId: linked.id, label: "Dorure titre", unit: "par titre", price: 4500 }]), TODAY);
    const snapshot = JSON.stringify(items());
    await saveService(world.sb, BINDER_A, { id: linked.id, categoryId: null, name: "Renommée", description: null, unitPriceCents: 99900, vatRateBps: null, unit: "motif", isActive: false });
    await archiveService(world.sb, BINDER_A, linked.id);
    expect(JSON.stringify(items())).toBe(snapshot);
    expect(items()[0]).toMatchObject({ label: "Dorure titre", unit: "par titre", unit_price_cents: 4500, reference_operation_key: "OPR-0103" });
  });

  it("une nouvelle version du référentiel ne change rien : le devis garde (reliure-fr-v1, clé) tel qu'écrit", async () => {
    const linked = await addReferenceService(world.sb, BINDER_A, importInput());
    await createQuote(world.sb, BINDER_A, quote([{ serviceId: linked.id, label: "Dorure titre", price: 4500 }]), TODAY);
    expect(items()[0].reference_version).toBe("reliure-fr-v1");
    // Aucune fonction de ce code ne réécrit des lignes de devis à partir du référentiel.
    const src = readFileSync(resolve(process.cwd(), "src/marketplace/services/binderReferenceCatalog.server.ts"), "utf8");
    expect(src).not.toMatch(/marketplace_binder_quote_items|marketplace_binder_quotes|marketplace_binder_invoice/);
  });

  it("modifier un brouillon recalcule la provenance depuis la prestation de l'atelier (jamais depuis le navigateur)", async () => {
    const linked = await addReferenceService(world.sb, BINDER_A, importInput());
    const created = await createQuote(world.sb, BINDER_A, quote([{ serviceId: null, label: "Libre", price: 100 }]), TODAY);
    await updateQuote(world.sb, BINDER_A, created.id, quote([{ serviceId: linked.id, label: "Dorure titre", price: 4500 }]));
    expect(items().find((i) => i.label === "Dorure titre")).toMatchObject({ reference_version: "reliure-fr-v1", reference_operation_key: "OPR-0103" });
    expect(items().find((i) => i.label === "Libre")).toBeUndefined();
  });

  it("la prestation d'un autre atelier est refusée AVANT toute écriture, avec ou sans lien", async () => {
    const foreign = await addReferenceService(world.sb, BINDER_B, importInput());
    expect(await codeOf(createQuote(world.sb, BINDER_A, quote([{ serviceId: foreign.id, label: "Volée", price: 1 }]), TODAY))).toBe("invalid_input");
    expect(world.rpcCalls.filter((c) => c.name === "marketplace_binder_create_quote")).toHaveLength(0);
  });
});

describe("le contrat d'entrée : ce que le navigateur peut envoyer", () => {
  const valid = importInput();
  it("accepte l'ajout normal", () => {
    expect(referenceServiceInput.safeParse(valid).success).toBe(true);
  });

  it("refuse tout champ en plus : atelier, prix suggéré, source de prix, lien libre (.strict())", () => {
    for (const extra of [{ binderId: BINDER_B }, { suggestedPriceCents: 4000 }, { publicPrice: 40 }, { priceMin: 30 }, { isActive: false }, { reference_operation_key: "OPR-0001" }]) {
      expect(referenceServiceInput.safeParse({ ...valid, ...extra }).success, JSON.stringify(extra)).toBe(false);
    }
  });

  it("refuse un slug, une clé mal formée, une version mal formée, un prix négatif ou décimal", () => {
    for (const bad of [{ referenceOperationKey: "OPR-0103-titrage_au_dos" }, { referenceOperationKey: "opr-0103" }, { referenceOperationKey: "OPR-1" }, { referenceVersion: "V1" }, { referenceVersion: "" }, { unitPriceCents: -1 }, { unitPriceCents: 45.5 }, { name: "   " }, { categoryId: "pas-un-uuid" }]) {
      expect(referenceServiceInput.safeParse({ ...valid, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("garde-fous de code", () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("chaque accès aux données du catalogue de référence porte le filtre d'atelier", () => {
    const src = strip(readFileSync(resolve(process.cwd(), "src/marketplace/services/binderReferenceCatalog.server.ts"), "utf8"));
    const chains = src.split(/\bsb\s*\.(?=from\(|rpc\()/).slice(1);
    expect(chains.length).toBe(2);
    for (const chain of chains) expect(chain.slice(0, chain.search(/;\s*\n/)), chain.slice(0, 100)).toContain("binderId");
  });

  it("les deux server functions sont authentifiées, valident leur entrée et résolvent l'atelier depuis la session", () => {
    const src = readFileSync(resolve(process.cwd(), "src/marketplace/services/binderReferenceCatalog.data.functions.ts"), "utf8");
    const fns = [...src.matchAll(/export const (\w+) = createServerFn\(\{ method: "POST" \}\)([\s\S]*?)(?=\nexport const |\n*$)/g)];
    expect(fns.map((m) => m[1]).sort()).toEqual(["addMyReferenceService", "setMyServiceFavorite"]);
    for (const [, name, body] of fns) {
      expect(body, name).toContain(".middleware([requireSupabaseAuth])");
      expect(body, name).toContain(".inputValidator(");
      expect(body, name).toContain("run(context.userId");
      expect(body, name).not.toMatch(/data\.binderId|data\.binder_id/);
    }
  });

  it("aucun module du catalogue ne lit un prix du référentiel ni un fichier de prix publics", () => {
    for (const file of ["src/marketplace/services/binderReferenceCatalog.server.ts", "src/marketplace/reference/catalogInput.ts", "src/marketplace/reference/serviceForm.ts", "src/marketplace/reference/search.ts"]) {
      const src = strip(readFileSync(resolve(process.cwd(), file), "utf8"));
      expect(src, file).not.toMatch(/\.csv|observed|publicPrice|suggestedPrice|recommendedPrice|prix conseill/i);
    }
  });
});
