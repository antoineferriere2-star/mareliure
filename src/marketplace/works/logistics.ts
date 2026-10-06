import { z } from "zod";
import { parcelInput, receptionInput } from "@/marketplace/shipping/logisticsPlan";

export const logisticsKinds = [
  "outbound",
  "carrier_delivered",
  "received",
  "return",
  "completed",
  "incident",
  "note",
] as const;
export type LogisticsKind = (typeof logisticsKinds)[number];
export const logisticsLabels: Record<LogisticsKind, string> = {
  outbound: "Aller vers l’atelier",
  carrier_delivered: "Livré selon le transporteur — déclaration atelier",
  received: "Réception physique constatée à l’atelier",
  return: "Retour vers le client",
  completed: "Remise finale déclarée par l’atelier",
  incident: "Incident",
  note: "Note complémentaire / correction",
};
export const logisticsDetails = z
  .object({
    mode: z.enum(["parcel", "hand"]).optional(),
    carrier: z.string().trim().max(120).optional(),
    tracking: z.string().trim().max(200).optional(),
    condition: z.enum(["consistent", "difference"]).optional(),
    description: z.string().trim().max(2000).optional(),
    proof: z.string().trim().max(500).optional(),
    invoiceId: z.string().uuid().optional(),
    payer: z.enum(["customer", "workshop"]).optional(),
    transportCostCents: z.number().int().min(0).max(100_000_000).optional(),
    coverageEvidence: z.string().trim().min(1).max(1000).optional(),
    fromAddress: receptionInput.optional(),
    toAddress: receptionInput.optional(),
    parcel: parcelInput.optional(),
  })
  .strict();
export const logisticsAppend = z
  .object({
    workId: z.string().uuid(),
    id: z.string().uuid(),
    version: z.number().int().min(0),
    kind: z.enum(logisticsKinds),
    details: logisticsDetails,
  })
  .strict();
export interface LogisticsEvent {
  id: string;
  sequence: number;
  kind: LogisticsKind;
  created_at: string;
  actor_id: string;
  details: z.infer<typeof logisticsDetails>;
  photos: { id: string; path: string; url?: string }[];
  labels?: { id: string; url?: string }[];
}
export interface LogisticsJournal {
  events: LogisticsEvent[];
}
export function logisticsActions(events: LogisticsEvent[]): LogisticsKind[] {
  const state = [...events]
    .reverse()
    .find((e) => !["note", "incident", "carrier_delivered"].includes(e.kind));
  const actions: LogisticsKind[] = ["incident", "note"];
  if (!state) actions.unshift("outbound");
  if (state?.kind === "outbound") actions.unshift("received");
  if (state?.kind === "received") actions.unshift("return");
  if (state?.kind === "return") actions.unshift("completed");
  if (state && ["outbound", "return"].includes(state.kind) && state.details.mode === "parcel")
    actions.push("carrier_delivered");
  return actions;
}
export function photoMime(bytes: Uint8Array): string | null {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)) return "image/png";
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}
