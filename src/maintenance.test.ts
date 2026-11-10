import { describe, expect, it } from "vitest";
import { maintenanceEnabled, maintenanceResponse, staysOpenDuringMaintenance } from "./maintenance";

const on = { MAINTENANCE_MODE: "public" };
const req = (path: string, method = "GET") => new Request(`https://mareliure.fr${path}`, { method });

describe("pause des sites publics", () => {
  it("désactivée par défaut : rien ne change", () => {
    expect(maintenanceEnabled({})).toBe(false);
    expect(maintenanceEnabled(undefined)).toBe(false);
    expect(maintenanceResponse(req("/"), {}, false)).toBeNull();
  });

  it("activée : les pages publiques répondent 503 avec Retry-After, sans indexation de la page de pause", async () => {
    for (const path of ["/", "/reliure-de-livres", "/tarifs", "/en", "/ateliers/ferriere", "/m/abc123", "/contact", "/page-inconnue"]) {
      const response = maintenanceResponse(req(path), on, false);
      expect(response?.status, path).toBe(503);
      expect(response?.headers.get("retry-after")).toBe("3600");
    }
    const html = await maintenanceResponse(req("/"), on, false)!.text();
    expect(html).toContain('content="noindex"');
    expect(html).toContain("Nous revenons très vite");
  });

  it("restent ouverts : espaces connectés, connexion, API, webhooks, fichiers, pages légales", () => {
    for (const path of [
      "/admin", "/admin/leads/aebb2c92", "/atelier", "/atelier/leads/x", "/mes-livres", "/portal/x", "/auth",
      "/activer-mon-atelier", "/invitation-atelier/tok", "/reglement-atelier/tok", "/project-summary/tok",
      "/api/marketplace/stripe-webhook", "/api/marketplace/sendcloud-webhook", "/api/public/payments/webhook",
      "/_serverFn/abc", "/assets/index-1.js", "/icons/mareliure/favicon.svg", "/favicon.ico",
      "/robots.txt", "/sitemap.xml", "/conditions-generales-de-vente", "/mentions-legales", "/terms-of-sale", "/privacy-policy",
    ]) {
      expect(staysOpenDuringMaintenance(path), path).toBe(true);
      expect(maintenanceResponse(req(path), on, false), path).toBeNull();
    }
  });

  it("une page qui commence comme un espace ouvert n'y échappe pas pour autant", () => {
    expect(staysOpenDuringMaintenance("/ateliers/ferriere")).toBe(false);
    expect(staysOpenDuringMaintenance("/authentique")).toBe(false);
  });

  it("Fine Bindery : page en anglais ; HEAD sans corps", async () => {
    expect(await maintenanceResponse(req("/en"), on, true)!.text()).toContain("We'll be back shortly");
    expect(maintenanceResponse(req("/", "HEAD"), on, false)!.body).toBeNull();
  });
});

describe("pause : variable lue comme le reste de l'application", () => {
  it("en production, Nitro ne passe pas env : la variable vient de process.env", () => {
    expect(maintenanceEnabled(undefined, { MAINTENANCE_MODE: "public" })).toBe(true);
    expect(maintenanceEnabled(undefined, {})).toBe(false);
    expect(maintenanceEnabled(undefined, { MAINTENANCE_MODE: "off" })).toBe(false);
  });
});
