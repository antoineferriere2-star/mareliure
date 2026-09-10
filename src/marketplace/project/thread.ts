/**
 * Le fil d'un projet : une conversation, pas trois messageries.
 *
 * Le client, l'atelier retenu et Ma Reliure écrivent au même endroit. Chacun y
 * est nommé clairement — « Vous », le nom de l'atelier, « Ma Reliure » — et
 * personne n'y lit les coordonnées de l'autre. Ce module est pur : il décide
 * des libellés, des non-lus et de l'action attendue à partir de lignes déjà
 * autorisées par le serveur.
 */
import type { ProjectDecision } from "./decisions";

export const AUTHOR_ROLES = ["customer", "binder", "admin"] as const;
export type AuthorRole = (typeof AUTHOR_ROLES)[number];

export const UPDATE_TYPES = [
  "RECEIVED",
  "IN_PROGRESS",
  "DETAIL",
  "FINISHED",
  "BEFORE_RETURN",
] as const;
export type UpdateType = (typeof UPDATE_TYPES)[number];

export const UPDATE_TYPE_LABELS: Record<UpdateType, string> = {
  RECEIVED: "Réception",
  IN_PROGRESS: "En cours",
  DETAIL: "Détail",
  FINISHED: "Terminé",
  BEFORE_RETURN: "Avant le retour",
};

export const MESSAGE_MAX_LENGTH = 5_000;

/** Ce qu'un fil accepte comme fichier. Le bucket et le serveur appliquent la même liste. */
export const PROJECT_FILE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;
export type ProjectFileMimeType = (typeof PROJECT_FILE_MIME_TYPES)[number];
export const PROJECT_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const PROJECT_FILES_PER_ITEM = 6;

export interface ThreadFile {
  id: string;
  url: string | null;
  mimeType: string;
}

export interface ThreadMessage {
  id: string;
  authorRole: AuthorRole;
  authorLabel: string;
  mine: boolean;
  kind: "message" | "update";
  updateType: UpdateType | null;
  body: string;
  important: boolean;
  createdAt: string;
  /** Retiré : le texte n'est plus renvoyé aux parties, seulement à Ma Reliure. */
  deleted: boolean;
  files: ThreadFile[];
}

/**
 * Comment nommer l'auteur d'un message pour celui qui le lit.
 *
 * Jamais un prénom ou une adresse : le client lit le nom de l'atelier,
 * l'atelier lit « Client », tout le monde lit « Ma Reliure ».
 */
export function authorLabel(input: {
  authorRole: AuthorRole;
  authorUserId: string | null;
  viewerUserId: string;
  binderName: string | null;
}): string {
  if (input.authorUserId !== null && input.authorUserId === input.viewerUserId) return "Vous";
  switch (input.authorRole) {
    case "admin":
      return "Ma Reliure";
    case "binder":
      return input.binderName ?? "L'atelier";
    case "customer":
      return "Client";
  }
}

/** Les messages d'autrui, non retirés, arrivés après la dernière lecture. */
export function countUnread(
  items: readonly { authorUserId: string | null; createdAt: string; deleted: boolean }[],
  viewerUserId: string,
  lastReadAt: string | null,
): number {
  const since = lastReadAt ? new Date(lastReadAt).getTime() : Number.NEGATIVE_INFINITY;
  return items.filter(
    (item) =>
      !item.deleted &&
      item.authorUserId !== viewerUserId &&
      new Date(item.createdAt).getTime() > since,
  ).length;
}

export interface CustomerAction {
  kind: "decision";
  decisionId: string;
  title: string;
  detail: string;
  cta: string;
}

/**
 * Ce que le client doit faire maintenant, s'il doit faire quelque chose.
 *
 * La plus ancienne question ouverte d'abord : c'est celle qui retient
 * l'atelier depuis le plus longtemps.
 */
export function customerActionFor(
  decisions: readonly Pick<
    ProjectDecision,
    "id" | "status" | "question" | "createdAt" | "createdByRole"
  >[],
): CustomerAction | null {
  const open = decisions
    .filter((decision) => decision.status === "OPEN")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (open.length === 0) return null;
  const first = open[0];
  const asker =
    first.createdByRole === "admin" ? "Ma Reliure vous demande" : "L'atelier vous demande";
  return {
    kind: "decision",
    decisionId: first.id,
    title: "Votre réponse est attendue",
    detail:
      open.length > 1
        ? `${asker} : ${first.question} (et ${open.length - 1} autre${open.length > 2 ? "s" : ""} question${open.length > 2 ? "s" : ""})`
        : `${asker} : ${first.question}`,
    cta: "Répondre",
  };
}

/** La dernière chose arrivée sur un projet, pour « Dernière nouvelle ». */
export function lastActivityAt(dates: readonly (string | null | undefined)[]): string | null {
  const present = dates.filter((date): date is string => typeof date === "string");
  if (present.length === 0) return null;
  return present.reduce((latest, current) => (current > latest ? current : latest));
}
