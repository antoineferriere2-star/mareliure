/**
 * Alertes d'activité envoyées à l'équipe (contact@oppe.fr), en plus des alertes de paiement.
 *
 * Demande du 8 octobre 2026 : être prévenu d'un nouveau livre confié, d'un client qui ouvre son
 * espace, d'un message adressé à l'équipe et des étapes d'un atelier (inscription, paiement en
 * ligne activé, abonnement). Chaque alerte porte une clé d'idempotence : un webhook rejoué ou un
 * double clic n'envoie rien deux fois. Aucune n'est bloquante (voir `notifyAdmin`).
 *
 * Contenu minimal : référence, marque, nom d'atelier, jamais le texte d'un message ni les
 * coordonnées d'un client — le détail se lit dans l'admin, derrière l'authentification.
 */
import type { Supa } from "@/build/services/adminAuth.server";
import type { MessageAudience } from "@/marketplace/messaging/audience";
import type { SenderRole } from "@/marketplace/messaging/conversation";
import { commercialOriginOf } from "@/marketplace/cases/commercialOrigin";
import { logOperationalError } from "@/build/services/operationalLog.server";
import { adminWorkshopUrl, notifyAdmin } from "./adminAlerts.server";

/** Une alerte ne fait jamais échouer l'action qui la déclenche, même si sa propre lecture échoue. */
async function bestEffort<T>(name: string, fallback: T, run: () => Promise<T>): Promise<T> {
  try { return await run(); } catch (err) { logOperationalError(`admin-alert.${name}-failed`, err, {}); return fallback; }
}

const BRAND_NAMES: Record<string, string> = { MA_RELIURE: "Ma Reliure", FINE_BINDERY: "Fine Bindery" };
const brandName = (brand: string | null | undefined) => BRAND_NAMES[brand ?? ""] ?? "Ma Reliure";

/** Nouveau livre confié : appelé une seule fois, à la création du Dossier par la Mission. */
export async function alertNewCase(sb: Supa, dossierId: string): Promise<boolean> {
  return bestEffort("new-case", false, async () => {
    const { data } = await sb.from("marketplace_cases").select("id, reference, brand, acquisition_origin").eq("dossier_id", dossierId).maybeSingle();
    if (!data) {
      // L'ingestion peut échouer sans faire échouer la Mission : la demande existe quand même.
      return notifyAdmin({ heading: "Nouvelle demande reçue", ctaUrl: "https://mareliure.fr/admin/leads", ctaLabel: "Voir les dossiers",
        intro: "Un visiteur vient de confier un livre, mais son dossier n'est pas encore rattaché. Il apparaîtra dans l'admin au prochain chargement.",
        idempotencyKey: `new-case-${dossierId}` });
    }
    const ownClient = commercialOriginOf(data.acquisition_origin as string | null) === "workshop_client";
    return notifyAdmin({
      caseId: data.id,
      heading: `Nouveau livre confié — ${data.reference}`,
      intro: `${brandName(data.brand)} : une nouvelle demande vient d'arriver${ownClient ? " par le lien d'un atelier" : ""}. Elle attend d'être qualifiée.`,
      idempotencyKey: `new-case-${dossierId}`,
    });
  });
}

/** Un client rattache le dossier à son compte : il peut désormais suivre et payer en ligne. */
export async function alertCustomerSpaceOpened(sb: Supa, caseIds: string[]): Promise<void> {
  return bestEffort("customer-space", undefined, async () => {
    if (!caseIds.length) return;
    const { data } = await sb.from("marketplace_cases").select("id, reference, brand").in("id", caseIds);
    for (const row of data ?? []) {
      await notifyAdmin({
        caseId: row.id,
        heading: `Espace client ouvert — ${row.reference}`,
        intro: `Le client de ${row.reference} (${brandName(row.brand)}) a créé son compte et retrouvé son dossier.`,
        idempotencyKey: `customer-space-${row.id}`,
      });
    }
  });
}

/**
 * Canaux qui s'adressent à l'équipe : le client écrit à OPPE (concierge, ou fil partagé quand OPPE vend),
 * l'atelier écrit à la plateforme. Jamais l'échange direct entre un atelier et son propre client.
 */
function addressedToTeam(senderRole: SenderRole, audience: MessageAudience, ownClient: boolean): boolean {
  if (senderRole === "customer") return audience === "customer_concierge" || (audience === "shared" && !ownClient);
  if (senderRole === "binder") return audience === "workshop_platform";
  return false;
}

export async function alertTeamMessage(sb: Supa, caseId: string, messageId: string, senderRole: SenderRole, audience: MessageAudience): Promise<boolean> {
  return bestEffort("team-message", false, async () => {
    if (senderRole === "admin") return false;
    const { data } = await sb.from("marketplace_cases").select("reference, acquisition_origin").eq("id", caseId).maybeSingle();
    if (!addressedToTeam(senderRole, audience, commercialOriginOf(data?.acquisition_origin as string | null | undefined) === "workshop_client")) return false;
    const reference = (data?.reference as string | undefined) ?? caseId.slice(0, 8);
    const from = senderRole === "customer" ? "du client" : "de l'atelier";
    return notifyAdmin({
      caseId,
      heading: `Nouveau message ${from} — ${reference}`,
      intro: `Un message ${from} vous attend sur le dossier ${reference}.`,
      ctaLabel: "Lire le message",
      idempotencyKey: `team-message-${messageId}`,
    });
  });
}

export async function alertWorkshopJoined(binderId: string, workshopName: string, via: "self_registration" | "invitation"): Promise<boolean> {
  return notifyAdmin({
    ctaUrl: adminWorkshopUrl(binderId),
    ctaLabel: "Voir l'atelier",
    heading: via === "self_registration" ? `Nouvel atelier inscrit — ${workshopName}` : `Atelier invité activé — ${workshopName}`,
    intro: via === "self_registration"
      ? `${workshopName} a créé son compte atelier. Il attend votre validation avant de recevoir des dossiers.`
      : `${workshopName} a accepté son invitation : un nouveau membre a accès à l'espace atelier.`,
    idempotencyKey: `workshop-joined-${via}-${binderId}`,
  });
}

/** Paiement en ligne (C) : alerte seulement au passage de « inactif » à « actif ». */
export async function alertWorkshopPaymentsActivated(binderId: string, workshopName: string, wasEnabled: boolean, isEnabled: boolean): Promise<boolean> {
  if (wasEnabled || !isEnabled) return false;
  return notifyAdmin({
    ctaUrl: adminWorkshopUrl(binderId),
    ctaLabel: "Voir l'atelier",
    heading: `Paiement en ligne activé — ${workshopName}`,
    intro: `Stripe a activé l'encaissement en ligne pour ${workshopName} : l'atelier peut désormais faire payer ses clients (retenue OPPE 3 %).`,
    idempotencyKey: `workshop-connect-active-${binderId}`,
  });
}

const PAYING = new Set(["active", "trialing"]);
const LATE = new Set(["past_due", "unpaid"]);

/** Abonnement B : souscription, impayé et résiliation, une alerte par transition et par abonnement. */
export async function alertWorkshopSubscriptionChange(input: {
  binderId: string; workshopName: string; subscriptionId: string; previous: string | null; next: string;
}): Promise<boolean> {
  const { binderId, workshopName, subscriptionId, previous, next } = input;
  let heading: string | null = null;
  let intro = "";
  if (PAYING.has(next) && !PAYING.has(previous ?? "")) {
    heading = `Abonnement souscrit — ${workshopName}`;
    intro = `${workshopName} a souscrit l'abonnement atelier (15 € HT / mois) et son premier paiement est confirmé.`;
  } else if (LATE.has(next) && !LATE.has(previous ?? "")) {
    heading = `Abonnement impayé — ${workshopName}`;
    intro = `Le paiement de l'abonnement de ${workshopName} a échoué. Stripe relance automatiquement ; un contact peut aider.`;
  } else if (next === "canceled" && previous !== "canceled") {
    heading = `Abonnement résilié — ${workshopName}`;
    intro = `L'abonnement de ${workshopName} est résilié.`;
  }
  if (!heading) return false;
  return notifyAdmin({ ctaUrl: adminWorkshopUrl(binderId), ctaLabel: "Voir l'atelier", heading, intro,
    idempotencyKey: `workshop-subscription-${subscriptionId}-${next}` });
}


async function workshopName(sb: Supa, binderId: string): Promise<string> {
  const { data } = await sb.from("marketplace_binders").select("workshop_name, display_name").eq("id", binderId).maybeSingle();
  return (data?.workshop_name as string | undefined) || (data?.display_name as string | undefined) || "Atelier";
}

/** Statut d'abonnement lu avant la synchronisation, pour n'alerter que sur une transition. */
export async function readWorkshopSubscriptionStatus(sb: Supa, binderId: string): Promise<string | null> {
  return bestEffort("subscription-read", null, async () => {
    const { data } = await sb.from("marketplace_binder_subscriptions").select("status").eq("binder_id", binderId).maybeSingle();
    return (data?.status as string | undefined) ?? null;
  });
}

export async function alertWorkshopSubscriptionSynced(sb: Supa, binderId: string, subscriptionId: string, previous: string | null): Promise<boolean> {
  return bestEffort("subscription", false, async () => {
    const next = await readWorkshopSubscriptionStatus(sb, binderId);
    if (!next) return false;
    return alertWorkshopSubscriptionChange({ binderId, workshopName: await workshopName(sb, binderId), subscriptionId, previous, next });
  });
}

export async function alertInvitedWorkshopJoined(sb: Supa, binderId: string): Promise<boolean> {
  return bestEffort("workshop-invitation", false, async () => alertWorkshopJoined(binderId, await workshopName(sb, binderId), "invitation"));
}
