/**
 * Intégrité et archives : l'atelier vérifie et exporte SES pièces ; l'administration voit tous les
 * émetteurs (ateliers et OPPE) et prépare le modèle d'attestation, qui n'est jamais montré aux ateliers.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin, assertAdmin } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { requireBinderId } from "./binderQuotes.server";
import { attestationDraft, binderIssuer, exportIssuerArchive, listIssuers, verifyIssuer } from "./issuerLedger.server";

const period = z.object({
  year: z.number().int().min(2026).max(2100),
  month: z.number().int().min(1).max(12).nullable(),
}).strict();
const issuer = z.string().regex(/^(oppe|binder:[0-9a-f-]{36})$/);

async function workshop(userId: string) {
  const sb = await admin();
  return { sb, issuer: binderIssuer(await requireBinderId(sb, userId)) };
}
const unavailable = (what: string) => (error: unknown) => {
  console.error(JSON.stringify({ event: "issuer_ledger_failed", what, error: String(error) }));
  fail(500, `${what} n'a pas pu aboutir. Réessayez dans un instant ; si cela persiste, contactez Ma Reliure.`);
};

export const verifyMyLedger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sb, issuer: key } = await workshop(context.userId);
    return verifyIssuer(sb, key).catch(unavailable("La vérification"));
  });

export const exportMyLedger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => period.parse(data))
  .handler(async ({ context, data }) => {
    const { sb, issuer: key } = await workshop(context.userId);
    return exportIssuerArchive(sb, key, data, context.userId).catch(unavailable("L'export"));
  });

export const listLedgerIssuers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    return listIssuers(await admin());
  });

export const verifyLedgerIssuer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ issuer }).strict().parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    return verifyIssuer(await admin(), data.issuer).catch(unavailable("La vérification"));
  });

export const exportLedgerIssuer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => period.extend({ issuer }).strict().parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    return exportIssuerArchive(await admin(), data.issuer, { year: data.year, month: data.month }, context.userId)
      .catch(unavailable("L'export"));
  });

/** Modèle d'attestation : administration seulement, marqué brouillon à valider. */
export const getAttestationDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ issuer }).strict().parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    return attestationDraft(await admin(), data.issuer, context.userId);
  });
