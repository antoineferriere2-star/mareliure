import type { BrowserContext, Route } from "@playwright/test";
import { fromJSON, toCrossJSON } from "seroval";
import { bookbindingPlaybookSchema } from "../../src/build/playbooks/bookbindingPlaybookSchema";
import { generateProjectBrief } from "../../src/build/engine/brief";
import { buildVisitorProjectSummary } from "../../src/build/engine/visitorSummary";
import type { Answers } from "../../src/build/schema/answers";

export const CASE = "51000000-0000-4000-8000-000000000001";
const USER = "51000000-0000-4000-8000-000000000002";
const PROPOSAL = "51000000-0000-4000-8000-000000000003";
const SESSION = "51000000-0000-4000-8000-000000000004";
const AT = "2026-10-15T10:00:00.000Z";
export type Language = "fr" | "en";
export const schema = bookbindingPlaybookSchema;
export const answers: Answers = {
  intention: "reparer",
  titre: "Livre de recette — synthetic book",
  auteur: "QA",
  annee: "2000",
  nature: "livre_courant",
  hauteur: 21,
  largeur: 14,
  epaisseur: 3,
  etat: ["couverture_usee"],
  valeurRaisons: ["sentimentale"],
  valeurFinanciere: "lt_100",
  budget: "150_250",
  delai: "pas_urgent",
  name: "Camille Recette",
  email: "camille@example.invalid",
  phone: "0612345678",
  localisation: { zip: "75011", city_state: "Paris", country: "France" },
  consentement: true,
};
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7XcAAAAASUVORK5CYII=",
  "base64",
);

export class CustomerScenario {
  submitted: Answers | null = null;
  signedIn = false;
  savedPlan = false;
  paid = false;
  labelReady = false;
  phoneRefusals = 0;
  readonly calls: { name: string; data: unknown }[] = [];
  readonly unexpected: string[] = [];
  readonly external: string[] = [];
  constructor(readonly language: Language) {}
  get brand() {
    return this.language === "fr" ? "MA_RELIURE" : "FINE_BINDERY";
  }
  get locale() {
    return this.language === "fr" ? "fr-FR" : "en-US";
  }
  get title() {
    return String(answers.titre);
  }
  get plan() {
    return this.savedPlan
      ? {
          caseId: CASE,
          version: 1,
          mode: "organized_round_trip",
          contact: {
            name: "Camille Recette",
            phone: "0612345678",
            line1: "1 rue de la Recette",
            line2: null,
            postalCode: "75011",
            city: "Paris",
            countryCode: "FR",
          },
          returnSameAddress: true,
          returnAddress: null,
          parcel: { weightGrams: 480, lengthMm: 340, widthMm: 240, heightMm: 60 },
          bookDescription: this.title,
          bookKind: "ordinary",
          declaredValueCents: 3000,
          conditionsAcceptedAt: AT,
          submittedBy: USER,
          submittedAt: AT,
          updatedAt: AT,
          workshop: null,
          returnReady: null,
          returnAddressConfirmedVersion: null,
        }
      : null;
  }
  logistics() {
    return {
      brand: this.brand,
      plan: this.plan,
      block: this.savedPlan ? "workshop_acceptance_required" : null,
      locked: this.paid,
      accepted: this.paid,
      paid: this.paid,
      offerKind: this.paid ? "book_round_trip_fr" : null,
      outbound: this.paid
        ? {
            state: this.labelReady ? "ready" : "preparing",
            carrier: this.labelReady ? "QA Carrier" : null,
            tracking: this.labelReady ? "SYNTHETIC-TRACKING" : null,
            method: this.labelReady ? "Méthode de recette / QA method" : null,
            downloadable: this.labelReady,
          }
        : null,
      return: null,
      carrierEvents: [],
      returnConfirmed: false,
      canConfirmReturnAddress: false,
      next: this.paid
        ? this.labelReady
          ? "drop_parcel"
          : "await_outbound_label"
        : this.savedPlan
          ? "await_workshop"
          : "choose_mode",
    };
  }
  caseView() {
    return {
      case: {
        id: CASE,
        reference: "QA-LOCAL",
        brand: this.brand,
        commercialOrigin: "oppe",
        status: this.paid ? "paid" : "pricing",
        createdAt: AT,
        projectType: this.language === "fr" ? "Réparation" : "Repair",
        customerPriceCents: 10000,
        priceIncludes: [],
        canAcceptProposal: false,
        paymentEligible: false,
        paidAt: this.paid ? AT : null,
        openDecisions: 0,
      },
      view: {
        title: this.title,
        reference: "QA-LOCAL",
        summary:
          this.language === "fr"
            ? "Réparer la couverture de ce livre."
            : "Repair this book's cover.",
        project: [],
        budgetAndTiming: [],
        missingInformation: [],
        constraints: [],
        photos: [],
        contact: null,
        area: null,
        heritage: false,
        manualReviewRequired: false,
      },
      // Synthetic UI fixture, never a commercial quote or a live payable amount.
      proposal: {
        id: PROPOSAL,
        pricingMode: "FIXED_PRICE",
        currency: "EUR",
        serviceCents: 10000,
        shippingCents: 1250,
        shippingOfferKind: "book_round_trip_fr",
        totalHtCents: 11250,
        vatRateBps: 2000,
        shippingVatRateBps: null,
        vatCents: 2250,
        totalTtcCents: 13500,
        estimateMinCents: null,
        estimateMaxCents: null,
        preparedAt: AT,
        confirmedAt: this.paid ? AT : null,
      },
      selectedBinder: null,
      shippingJourney: [],
      messagingChannel: this.language === "fr" ? "admin_customer" : "concierge",
    };
  }
  async install(context: BrowserContext) {
    await context.addInitScript(
      ({ user, at }) => {
        const encode = (v: unknown) => btoa(JSON.stringify(v)).replaceAll("=", "");
        const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user, email: "camille@example.invalid", exp: 4102444800, aud: "authenticated" })}.synthetic`;
        localStorage.setItem(
          "sb-customer-journey-auth-token",
          JSON.stringify({
            access_token: token,
            refresh_token: "synthetic-refresh",
            expires_at: 4102444800,
            expires_in: 3600,
            token_type: "bearer",
            user: {
              id: user,
              email: "camille@example.invalid",
              aud: "authenticated",
              role: "authenticated",
              created_at: at,
              app_metadata: {},
              user_metadata: {},
            },
          }),
        );
      },
      { user: USER, at: AT },
    );
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === "customer-journey.invalid" && url.pathname === "/auth/v1/user") {
        return this.json(route, {
          id: USER,
          email: "camille@example.invalid",
          aud: "authenticated",
          role: "authenticated",
          created_at: AT,
          app_metadata: {},
          user_metadata: {},
        });
      }
      if (url.origin !== "http://127.0.0.1:8086" && !["data:", "blob:"].includes(url.protocol)) {
        this.external.push(url.origin + url.pathname);
        return route.abort();
      }
      if (url.pathname === "/__customer-frame")
        return route.fulfill({
          contentType: "text/html",
          body: "<!doctype html><html><body style='margin:0'><iframe name='customer' title='Customer journey' style='display:block;border:0;height:950px'></iframe></body></html>",
        });
      if (url.pathname === "/api/public/build-runtime") return this.runtime(route);
      if (url.pathname.startsWith("/_serverFn/")) return this.rpc(route);
      if (url.pathname.startsWith("/api/")) {
        if (url.pathname === "/api/public/track-view") return this.json(route, { ok: true });
        this.unexpected.push(url.pathname);
        return route.abort();
      }
      return route.continue();
    });
  }
  private json(route: Route, data: unknown) {
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(data) });
  }
  private async runtime(route: Route) {
    const input = route.request().postDataJSON() as { action: string; answers?: Answers };
    this.calls.push({ name: input.action, data: input.answers });
    if (input.action === "start_session" || input.action === "resume_session")
      return this.json(route, {
        mission: {
          id: "local-mission",
          name: "QA bookbinding",
          status: "active",
          objective: null,
          playbook_id: "local-playbook",
          playbook_name: "Reliure",
          workspace_name: this.language === "fr" ? "Ma Reliure" : "Fine Bindery",
          branding: null,
          proposal: { defaultLocale: this.locale },
        },
        playbook_schema: schema,
        session: { id: SESSION, answers: {}, status: "in_progress" },
        session_secret: "synthetic-session-secret",
      });
    if (input.action === "save_session")
      return this.json(route, {
        session: { id: SESSION, answers: input.answers, status: "in_progress" },
      });
    if (input.action === "upload_project_photo")
      return this.json(route, {
        storagePath: `sessions/${SESSION}/synthetic-photo`,
        filename: "synthetic.png",
        mimeType: "image/png",
        sizeBytes: PNG.length,
      });
    if (input.action === "submit_session") {
      this.submitted = input.answers!;
      const brief = generateProjectBrief(schema, this.submitted, { name: "QA bookbinding" });
      const summary = buildVisitorProjectSummary(
        brief,
        {},
        {
          businessName: this.language === "fr" ? "Ma Reliure" : "Fine Bindery",
          locale: this.locale,
          measurementSystem: "metric",
          photos: [],
          submittedAt: AT,
        },
      );
      return this.json(route, {
        dossier: {
          id: CASE,
          status: "ready",
          summary: brief.projectSummary,
          content: brief,
          next_questions: [],
          visitor_summary: summary,
          emailSent: false,
          summaryUrl: null,
        },
      });
    }
    this.unexpected.push(input.action);
    return route.abort();
  }
  private async rpc(route: Route) {
    const request = route.request(),
      url = new URL(request.url());
    const meta = JSON.parse(
      Buffer.from(url.pathname.split("/").pop()!, "base64url").toString(),
    ) as { export: string };
    const name = meta.export.replace(/_createServerFn_handler$/, "");
    const payload =
      request.method() === "GET" ? url.searchParams.get("payload") : request.postData();
    const decoded = payload
      ? (fromJSON(JSON.parse(payload)) as { data?: Record<string, unknown> })
      : {};
    const data = decoded.data;
    this.calls.push({ name, data });
    let result: unknown;
    switch (name) {
      case "getRequestMarketplaceBrand":
        result = this.brand;
        break;
      case "getRequestFineBinderyLocale":
        result = this.language;
        break;
      case "listMyCustomerCases":
        result = [
          {
            id: CASE,
            commercialOrigin: "oppe",
            status: "pricing",
            title: this.title,
            projectType: null,
            createdAt: AT,
            thumbnailUrl: null,
            currency: "EUR",
            amountCents: 13500,
            amountIncludesTax: true,
            hasPrice: true,
            proposalAccepted: false,
            proposalAcceptable: false,
            paymentEligible: false,
            paid: false,
            unreadCount: 0,
            actionRequired: false,
          },
        ];
        break;
      case "getMyCustomerCase":
        result = this.caseView();
        break;
      case "getMyCaseLogistics":
        result = this.logistics();
        break;
      case "saveMyCaseLogistics": {
        const plan = data?.plan as { contact?: { phone?: string } };
        if (
          !/^(?:0[1-9]\d{8}|\+33[1-9]\d{8})$/.test(
            (plan?.contact?.phone ?? "").replace(/[ .()-]/g, ""),
          )
        ) {
          this.phoneRefusals++;
          return route.fulfill({
            contentType: "application/json",
            headers: { "x-tss-serialized": "true" },
            body: JSON.stringify(toCrossJSON({ error: new Error("invalid_input"), context: {} })),
          });
        }
        this.savedPlan = true;
        result = { ok: true };
        break;
      }
      case "listCaseMessages":
        result = { messages: [], lastReadAt: null, audience: "admin_customer", canWrite: true };
        break;
      case "listCaseDecisions":
        result = [];
        break;
      case "markConversationRead":
        result = { ok: true };
        break;
      case "getMyOppeDocuments":
        result = null;
        break;
      default:
        this.unexpected.push(name);
        return route.abort();
    }
    return this.json(route, { result, context: {} });
  }
}
