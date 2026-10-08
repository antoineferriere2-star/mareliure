import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
const id=(n:number)=>`20000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
let db:PGlite;
beforeAll(async()=>{
  db=new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE public.user_roles(user_id uuid REFERENCES auth.users(id),role text);
    CREATE TABLE public.marketplace_cases(id uuid PRIMARY KEY,status text NOT NULL);
    CREATE TABLE public.marketplace_case_matches(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid REFERENCES marketplace_cases(id));
    CREATE TABLE public.marketplace_commercial_proposals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid REFERENCES marketplace_cases(id));
    CREATE TABLE public.marketplace_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),case_id uuid REFERENCES marketplace_cases(id),actor_user_id uuid REFERENCES auth.users(id),event_type text,metadata jsonb);
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role; INSERT INTO auth.users VALUES('${id(1)}'),('${id(2)}'); INSERT INTO user_roles VALUES('${id(1)}','admin'),('${id(2)}','customer');`);
  await db.exec(readFileSync(new URL('../../../supabase/migrations/20261008100000_case_closure_atomic.sql',import.meta.url),'utf8'));
},30000);
afterAll(async()=>{await db?.close();});
async function create(n:number,status="pricing"){await db.query("INSERT INTO marketplace_cases VALUES($1,$2)",[id(n),status]);return id(n);}
async function close(caseId:string,actor:string|null=id(1),reason="Dossier de test interne",expected:string|null=null){return (await db.query<{r:string}>("SELECT marketplace_close_case_without_follow_up($1,$2,$3,$4) r",[caseId,actor,reason,expected])).rows[0].r;}
async function state(caseId:string){return (await db.query<{status:string;events:number}>("SELECT status,(SELECT count(*)::int FROM marketplace_events WHERE case_id=c.id) events FROM marketplace_cases c WHERE id=$1",[caseId])).rows[0];}
describe("clôture SQL atomique",()=>{
  it.each(["under_review","pricing","matching"])("classe %s et journalise le motif dans la même transaction",async(status)=>{
    const caseId=await create(status==="under_review"?10:status==="pricing"?11:12,status);
    expect(await close(caseId,id(1),"  Dossier de test interne  ",status)).toBe("closed");
    expect(await state(caseId)).toEqual({status:"cancelled",events:1});
    const event=(await db.query<{actor_user_id:string;metadata:unknown}>("SELECT actor_user_id,metadata FROM marketplace_events WHERE case_id=$1",[caseId])).rows[0];
    expect(event).toEqual({actor_user_id:id(1),metadata:{reason:"Dossier de test interne",previous_status:status,execution_source:"admin_app"}});
  });
  it("un échec d'historique annule aussi le changement de statut",async()=>{
    const caseId=await create(20);
    await db.exec(`CREATE FUNCTION reject_closure_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'event_failure'; END $$;
      CREATE TRIGGER reject_event BEFORE INSERT ON marketplace_events FOR EACH ROW EXECUTE FUNCTION reject_closure_event();`);
    await expect(close(caseId)).rejects.toThrow("event_failure");
    expect(await state(caseId)).toEqual({status:"pricing",events:0});
    await db.exec("DROP TRIGGER reject_event ON marketplace_events; DROP FUNCTION reject_closure_event();");
  });
  it("refuse les invitations et les propositions, même en brouillon",async()=>{
    for(const [table,n] of [["marketplace_case_matches",30],["marketplace_commercial_proposals",31]] as const){const caseId=await create(n,"matching");await db.query(`INSERT INTO ${table}(case_id) VALUES($1)`,[caseId]);expect(await close(caseId)).toBe("engaged");expect(await state(caseId)).toEqual({status:"matching",events:0});}
  });
  it("refuse un statut changé, clos ou inconnu et ne duplique pas la trace",async()=>{
    const caseId=await create(40,"matching");expect(await close(caseId,id(1),"motif valable","under_review")).toBe("changed");expect(await state(caseId)).toEqual({status:"matching",events:0});
    expect(await close(caseId)).toBe("closed");expect(await close(caseId)).toBe("not_closable");expect((await state(caseId)).events).toBe(1);
    expect(await close(await create(41,"future"))).toBe("not_closable");expect(await close(id(999))).toBe("not_found");
  });
  it("refuse tout motif invalide et toute identité non admin",async()=>{
    const caseId=await create(50);for(const reason of [" ","test","x".repeat(301)])expect(await close(caseId,id(1),reason)).toBe("invalid_reason");
    await expect(close(caseId,id(2))).rejects.toThrow("admin_required");await expect(close(caseId,id(999))).rejects.toThrow("admin_required");expect(await state(caseId)).toEqual({status:"pricing",events:0});
  });
  it("un opérateur SQL garde une trace distincte, sans inventer une session admin",async()=>{
    const caseId=await create(60);expect(await close(caseId,null)).toBe("closed");
    const event=(await db.query<{actor_user_id:null;metadata:{execution_source:string}}>("SELECT actor_user_id,metadata FROM marketplace_events WHERE case_id=$1",[caseId])).rows[0];
    expect(event.actor_user_id).toBeNull();expect(event.metadata.execution_source).toBe("database_operator");
  });
  it("interdit une nouvelle invitation ou proposition vers un dossier annulé",async()=>{
    const caseId=await create(70);await close(caseId);
    for(const table of ["marketplace_case_matches","marketplace_commercial_proposals"]){await expect(db.query(`INSERT INTO ${table}(case_id) VALUES($1)`,[caseId])).rejects.toThrow("case_cancelled");}
    expect(await state(caseId)).toEqual({status:"cancelled",events:1});
  });
  it("retire l'exécution directe aux rôles publics et interdit l'acteur NULL via service_role",async()=>{
    const grants=(await db.query<{role:string;allowed:boolean}>(`SELECT r role,has_function_privilege(r,'marketplace_close_case_without_follow_up(uuid,uuid,text,text)','EXECUTE') allowed FROM unnest(ARRAY['anon','authenticated','service_role']) r`)).rows;
    expect(grants).toEqual([{role:"anon",allowed:false},{role:"authenticated",allowed:false},{role:"service_role",allowed:true}]);
    const caseId=await create(80);await db.exec("SET SESSION AUTHORIZATION service_role");
    await expect(close(caseId,null)).rejects.toThrow("admin_required");await db.exec("RESET SESSION AUTHORIZATION; RESET ROLE;");expect(await state(caseId)).toEqual({status:"pricing",events:0});
  });
});


