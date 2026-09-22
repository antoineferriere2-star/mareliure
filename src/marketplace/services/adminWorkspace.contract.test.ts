import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/marketplace/services/adminWorkspace.data.functions.ts"), "utf8");

describe("confidentialité de la supervision atelier", () => {
  it("autorise chaque endpoint via assertAdmin", () => {
    const endpoints = (source.match(/export const \w+ = createServerFn/g) ?? []).length;
    expect(endpoints).toBe(3);
    expect((source.match(/await assertAdmin\(context\.supabase, context\.userId\)/g) ?? []).length).toBe(endpoints);
  });

  it("ne sélectionne aucun contact personnel ni corps de message dans la fiche atelier", () => {
    const detail = source.slice(source.indexOf("getAdminWorkshopDetail"), source.indexOf("listAdminConversationPreviews"));
    expect(detail).not.toContain("marketplace_binder_clients");
    expect(detail).not.toContain("marketplace_messages");
    expect(detail).not.toMatch(/client_(name|email|phone)|sender_user_id|body/);
  });

  it("borne les conversations admin aux dossiers Ma Reliure", () => {
    const messages = source.slice(source.indexOf("listAdminConversationPreviews"));
    expect(messages).toContain('.eq("brand", "MA_RELIURE")');
    expect(messages).toContain('.in("case_id", ids)');
  });
});
