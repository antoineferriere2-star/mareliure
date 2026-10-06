import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Schéma environnant minimal ; les deux migrations réelles fournissent gardes, triggers et fonctions.
let db: PGlite;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const migration = (name: string) =>
  readFileSync(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");

const ADMIN = id(1);
const BINDER_A = id(10);
const BINDER_B = id(11);
const OPPE_CASE = id(20);
const OWN_CASE = id(21);
const FB_PROFILE_CASE = id(22);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE user_roles(user_id uuid, role text);
    CREATE TABLE marketplace_binders(id uuid PRIMARY KEY, status text);
    CREATE TABLE marketplace_cases(id uuid PRIMARY KEY, brand text NOT NULL DEFAULT 'MA_RELIURE',
      acquisition_origin text NOT NULL DEFAULT 'MA_RELIURE_ACQUIRED', referred_binder_id uuid);
    CREATE TABLE marketplace_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid,binder_id uuid,actor_user_id uuid,event_type text,metadata jsonb);
    CREATE TABLE marketplace_commercial_proposals(id uuid PRIMARY KEY,case_id uuid,status text,accepted_at timestamptz,currency text,total_cents integer);
    CREATE TABLE marketplace_case_matches(case_id uuid, binder_id uuid, state text,selected_at timestamptz);
    CREATE TABLE marketplace_binder_members(binder_id uuid,user_id uuid,account_status text);
    CREATE TABLE recipe_rights(binder_id uuid PRIMARY KEY,eligible boolean);
    CREATE FUNCTION marketplace_workshop_can_create(p_binder_id uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT eligible FROM recipe_rights WHERE binder_id=p_binder_id $$;
    CREATE TABLE marketplace_quotes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_id uuid, binder_id uuid);
    CREATE TABLE marketplace_binder_clients(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),binder_id uuid,name text,email text,phone text,
      origin text NOT NULL DEFAULT 'mon_client',origin_case_id uuid,created_at timestamptz DEFAULT now(),
      CONSTRAINT marketplace_binder_clients_origin_check CHECK (origin IN ('mon_client','ma_reliure') AND (origin_case_id IS NULL OR origin='ma_reliure')));
    CREATE TABLE marketplace_binder_works(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),binder_id uuid,contact_id uuid,reference text,title text,description text,
      source text NOT NULL DEFAULT 'mon_client',case_id uuid,
      CONSTRAINT marketplace_binder_works_source_check CHECK (source IN ('mon_client','ma_reliure') AND (case_id IS NULL OR source='ma_reliure')));
    CREATE TABLE marketplace_binder_quotes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),binder_id uuid,client_id uuid,work_id uuid,status text,currency text,total_ttc_cents integer);
    CREATE TABLE marketplace_binder_invoices(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),binder_id uuid,quote_id uuid,status text,currency text,total_ttc_cents integer);
    CREATE FUNCTION marketplace_binder_next_work_reference(p_binder uuid, p_year integer) RETURNS text
      LANGUAGE sql AS $$ SELECT 'OUV-' || p_year || '-' || substr(gen_random_uuid()::text, 1, 6) $$;
    INSERT INTO auth.users VALUES('${ADMIN}'); INSERT INTO user_roles VALUES('${ADMIN}','admin');
    INSERT INTO marketplace_binders VALUES('${BINDER_A}','approved'),('${BINDER_B}','approved');
    INSERT INTO marketplace_binder_members VALUES('${BINDER_A}','${ADMIN}','active');
    INSERT INTO recipe_rights VALUES('${BINDER_A}',true),('${BINDER_B}',true);
  `);
  await db.exec(migration("20260928090000_marketplace_payment_circuits.sql"));
  await db.exec(migration("20261005090000_commercial_origin_separation.sql"));
  await db.exec(migration("20261007150000_workshop_referral_import.sql"));
  await db.exec(`
    INSERT INTO marketplace_cases(id) VALUES('${OPPE_CASE}');
    INSERT INTO marketplace_cases(id, brand) VALUES('${OWN_CASE}','MA_RELIURE'),('${FB_PROFILE_CASE}','FINE_BINDERY');
    UPDATE marketplace_cases SET acquisition_origin='BINDER_REFERRED', referred_binder_id='${BINDER_A}' WHERE id='${OWN_CASE}';
    UPDATE marketplace_cases SET acquisition_origin='FINEBINDERY_PROFILE', referred_binder_id='${BINDER_A}' WHERE id='${FB_PROFILE_CASE}';
    INSERT INTO marketplace_case_matches(case_id,binder_id,state) VALUES
      ('${OPPE_CASE}','${BINDER_A}','selected'),('${OWN_CASE}','${BINDER_A}','selected'),
      ('${OWN_CASE}','${BINDER_B}','selected'),('${FB_PROFILE_CASE}','${BINDER_A}','selected');
  `);
}, 30000);
afterAll(async () => { await db?.close(); });

const importCase = (binder: string, caseId: string) =>
  db.query<{ work: string }>(
    `SELECT marketplace_binder_import_case('${binder}','${caseId}','Client Test','client@example.test','0600000000','Missel','') AS work`,
  );

const importOwn = (caseId: string, binder = BINDER_A, actor = ADMIN, title = "Ouvrage de recette") => db.query<{work:string}>(
  "SELECT marketplace_binder_import_own_case($1,$2,$3,'Client fictif','fixture@example.test',null,$4,'Demande de recette') AS work", [binder,caseId,actor,title],
);
const seedOwn = async (n:number,state="invited") => {
  await db.query("INSERT INTO marketplace_cases(id,acquisition_origin,referred_binder_id) VALUES($1,'BINDER_REFERRED',$2)",[id(n),BINDER_A]);
  await db.query("INSERT INTO marketplace_case_matches(case_id,binder_id,state) VALUES($1,$2,$3)",[id(n),BINDER_A,state]);
};

describe("origine commerciale", () => {
  it("se dérive de la provenance, jamais d'une saisie", async () => {
    const { rows } = await db.query<{ id: string; commercial_origin: string }>(
      "SELECT id, commercial_origin FROM marketplace_cases ORDER BY id",
    );
    expect(rows.map((r) => r.commercial_origin)).toEqual(["oppe", "workshop_client", "workshop_client"]);
  });

  it("refuse toute vente Oppe sur le client propre d'un atelier, même venu d'une vitrine Fine Bindery", async () => {
    for (const caseId of [OWN_CASE, FB_PROFILE_CASE]) {
      await expect(
        db.exec(`INSERT INTO marketplace_commercial_proposals(id,case_id,status) VALUES(gen_random_uuid(),'${caseId}','draft')`),
      ).rejects.toThrow("oppe_sale_forbidden_on_workshop_client");
    }
    await db.exec(`INSERT INTO marketplace_commercial_proposals(id,case_id,status) VALUES('${id(30)}','${OPPE_CASE}','draft')`);
  });

  it("se fige dès qu'un engagement existe", async () => {
    await expect(
      db.exec(`UPDATE marketplace_cases SET acquisition_origin='BINDER_REFERRED', referred_binder_id='${BINDER_A}' WHERE id='${OPPE_CASE}'`),
    ).rejects.toThrow("commercial_origin_locked");
  });
});

describe("import d'un dossier en fiche ouvrage", () => {
  it("garde la provenance d'un projet Oppe sans transmettre les coordonnées du client", async () => {
    const { rows } = await importCase(BINDER_A, OPPE_CASE);
    const work = (await db.query<{ source: string; origin: string; email: string | null; phone: string | null }>(
      `SELECT w.source, c.origin, c.email, c.phone FROM marketplace_binder_works w JOIN marketplace_binder_clients c ON c.id=w.contact_id WHERE w.id='${rows[0].work}'`,
    )).rows[0];
    expect(work).toEqual({ source: "ma_reliure", origin: "ma_reliure", email: null, phone: null });
  });

  it("garde la provenance d'un client propre, coordonnées comprises", async () => {
    const { rows } = await importCase(BINDER_A, OWN_CASE);
    const work = (await db.query<{ source: string; origin: string; email: string | null }>(
      `SELECT w.source, c.origin, c.email FROM marketplace_binder_works w JOIN marketplace_binder_clients c ON c.id=w.contact_id WHERE w.id='${rows[0].work}'`,
    )).rows[0];
    expect(work).toEqual({ source: "workshop_platform", origin: "workshop_platform", email: "client@example.test" });
  });

  it("refuse le client propre d'un atelier à un autre atelier", async () => {
    await expect(importCase(BINDER_B, OWN_CASE)).rejects.toThrow("case_not_selected_for_binder");
  });

  it("ne laisse jamais réécrire une provenance", async () => {
    await expect(db.exec(`UPDATE marketplace_binder_works SET source='mon_client', case_id=NULL WHERE case_id='${OPPE_CASE}'`))
      .rejects.toThrow("binder_provenance_immutable");
    await expect(db.exec(`UPDATE marketplace_binder_clients SET origin='mon_client', origin_case_id=NULL WHERE origin_case_id='${OPPE_CASE}'`))
      .rejects.toThrow("binder_provenance_immutable");
  });
});

describe("documents de l'atelier", () => {
  it("refuse un devis de l'atelier au client final d'une commande Oppe", async () => {
    const work = (await db.query<{ id: string; contact_id: string }>(
      `SELECT id, contact_id FROM marketplace_binder_works WHERE case_id='${OPPE_CASE}'`,
    )).rows[0];
    await expect(db.exec(`INSERT INTO marketplace_binder_quotes(binder_id,work_id,status) VALUES('${BINDER_A}','${work.id}','draft')`))
      .rejects.toThrow("workshop_document_forbidden_on_oppe_order");
    await expect(db.exec(`INSERT INTO marketplace_binder_quotes(binder_id,client_id,status) VALUES('${BINDER_A}','${work.contact_id}','draft')`))
      .rejects.toThrow("workshop_document_forbidden_on_oppe_order");
  });

  it("autorise le devis de l'atelier à son client propre", async () => {
    const work = (await db.query<{ id: string }>(`SELECT id FROM marketplace_binder_works WHERE case_id='${OWN_CASE}'`)).rows[0];
    await db.exec(`INSERT INTO marketplace_binder_quotes(id,binder_id,work_id,status,currency,total_ttc_cents) VALUES('${id(40)}','${BINDER_A}','${work.id}','draft','EUR',1000)`);
  });

  it("refuse de rattacher après coup un devis existant à une commande Oppe", async () => {
    const work = (await db.query<{ id: string }>(`SELECT id FROM marketplace_binder_works WHERE case_id='${OPPE_CASE}'`)).rows[0];
    await expect(db.exec(`UPDATE marketplace_binder_quotes SET work_id='${work.id}' WHERE id='${id(40)}'`))
      .rejects.toThrow("workshop_document_forbidden_on_oppe_order");
  });
});

describe("droits", () => {
  it("n'ouvre aucune nouvelle fonction à l'API publique", async () => {
    const { rows } = await db.query<{ anon: boolean; auth: boolean; service: boolean }>(
      "SELECT has_function_privilege('anon','marketplace_binder_document_is_oppe_order(uuid,uuid,uuid)','EXECUTE') AS anon, has_function_privilege('authenticated','marketplace_binder_document_is_oppe_order(uuid,uuid,uuid)','EXECUTE') AS auth, has_function_privilege('service_role','marketplace_binder_document_is_oppe_order(uuid,uuid,uuid)','EXECUTE') AS service",
    );
    expect(rows).toEqual([{ anon: false, auth: false, service: true }]);
  });
});

describe("circuits de paiement", () => {
  it("n'ouvre plus la commission de 25 % ni la conciergerie, même par écriture directe", async () => {
    await expect(db.exec(`UPDATE marketplace_case_payment_circuits SET circuit='network_sale' WHERE case_id='${OWN_CASE}'`))
      .rejects.toThrow("payment_circuit_retired");
    await db.exec(`INSERT INTO marketplace_events(id,case_id) VALUES('${id(50)}','${OWN_CASE}')`);
    await expect(db.exec(`SELECT marketplace_set_case_payment_circuit('${OWN_CASE}','network_sale','${id(50)}','${ADMIN}','Provenance vérifiée')`))
      .rejects.toThrow("circuit_and_evidence_required");
  });

  it("aligne la qualification sur l'origine", async () => {
    await expect(db.exec(`SELECT marketplace_set_case_payment_circuit('${OWN_CASE}','legacy_resale','${id(50)}','${ADMIN}','Provenance vérifiée')`))
      .rejects.toThrow("circuit_origin_mismatch");
    await db.exec(`SELECT marketplace_set_case_payment_circuit('${OWN_CASE}','own_client','${id(50)}','${ADMIN}','Provenance vérifiée')`);
  });

  it("fige le vendeur Oppe et l'origine sur la proposition", async () => {
    const { rows } = await db.query<{ seller: string; origin: string }>(
      `SELECT payment_provenance->>'seller' AS seller, payment_provenance->>'commercial_origin' AS origin FROM marketplace_commercial_proposals WHERE id='${id(30)}'`,
    );
    expect(rows).toEqual([{ seller: "oppe", origin: "oppe" }]);
  });
});

describe("premier devis d’une demande de vitrine", () => {
  it("refuse un autre atelier, un acteur non membre et une commande Oppe",async () => {
    await seedOwn(70);
    await expect(importOwn(id(70),BINDER_B)).rejects.toThrow("active_approved_workshop_required");
    await expect(importOwn(id(70),BINDER_A,id(999))).rejects.toThrow("active_approved_workshop_required");
    await expect(importOwn(OPPE_CASE)).rejects.toThrow("own_case_not_found");
  });
  it("ouvre une seule fiche personnelle avec coordonnées, sans prix ni accord Oppe",async () => {
    const first=(await importOwn(id(70))).rows[0].work;
    expect((await importOwn(id(70))).rows[0].work).toBe(first);
    expect((await db.query("SELECT source,case_id FROM marketplace_binder_works WHERE id=$1",[first])).rows).toEqual([{source:"workshop_platform",case_id:id(70)}]);
    expect((await db.query("SELECT state FROM marketplace_case_matches WHERE case_id=$1",[id(70)])).rows).toEqual([{state:"selected"}]);
    expect((await db.query("SELECT id FROM marketplace_quotes WHERE case_id=$1",[id(70)])).rows).toHaveLength(0);
    expect((await db.query("SELECT id FROM marketplace_events WHERE case_id=$1 AND event_type='workshop_own_case_imported'",[id(70)])).rows).toHaveLength(1);
  });
  it("conserve l’accès à une fiche existante après résiliation et refuse la nouvelle création",async () => {
    await seedOwn(71); await db.query("UPDATE recipe_rights SET eligible=false WHERE binder_id=$1",[BINDER_A]);
    await expect(importOwn(id(70))).resolves.toBeTruthy();
    await expect(importOwn(id(71))).rejects.toThrow("workshop_subscription_required");
    expect((await db.query("SELECT state FROM marketplace_case_matches WHERE case_id=$1",[id(71)])).rows).toEqual([{state:"invited"}]);
    await db.query("UPDATE recipe_rights SET eligible=true WHERE binder_id=$1",[BINDER_A]);
  });
  it("annule aussi la sélection si l’import échoue et laisse une reprise possible",async () => {
    await seedOwn(72);
    await expect(importOwn(id(72),BINDER_A,ADMIN,"")).rejects.toThrow("invalid_case_import");
    expect((await db.query("SELECT state FROM marketplace_case_matches WHERE case_id=$1",[id(72)])).rows).toEqual([{state:"invited"}]);
    expect((await db.query("SELECT id FROM marketplace_binder_works WHERE case_id=$1",[id(72)])).rows).toHaveLength(0);
    await expect(importOwn(id(72))).resolves.toBeTruthy();
  });
  it("ne rouvre pas un refus et ne vole pas une affectation existante",async () => {
    await seedOwn(73,"declined"); await seedOwn(74);
    await db.query("INSERT INTO marketplace_case_matches(case_id,binder_id,state) VALUES($1,$2,'selected')",[id(74),BINDER_B]);
    await expect(importOwn(id(73))).rejects.toThrow("own_case_not_available");
    await expect(importOwn(id(74))).rejects.toThrow("own_case_not_available");
  });
});
