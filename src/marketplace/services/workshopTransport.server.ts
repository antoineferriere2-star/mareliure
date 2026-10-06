import type { SupabaseClient } from "@supabase/supabase-js";
import type { Supa } from "@/build/services/adminAuth.server";
import { fail } from "@/build/services/serverError";
import { frMainlandPostal } from "@/marketplace/shipping/logisticsPlan";
import { fetchSendcloudShippingOptions } from "@/marketplace/shipping/sendcloudProvider.server";
import type { workshopTransportOptionsInput } from "@/marketplace/works/workshopTransport";
import type { z } from "zod";

/** All authority comes from the authenticated workshop and an issued invoice of this work. */
export async function workshopTransportOptions(sb: Supa, binderId: string, input: z.infer<typeof workshopTransportOptionsInput>) {
  const raw = sb as unknown as SupabaseClient;
  const work = await raw.from("marketplace_binder_works").select("source").eq("id", input.workId).eq("binder_id", binderId).maybeSingle();
  if (work.error || !work.data || !["mon_client", "workshop_platform"].includes(work.data.source)) fail(404, "Ouvrage client propre introuvable.");
  const invoice = await raw.from("marketplace_binder_invoices").select("quote_id").eq("id", input.invoiceId).eq("binder_id", binderId).eq("status", "issued").maybeSingle();
  if (invoice.error || !invoice.data) fail(404, "Facture de commande introuvable.");
  const quote = await raw.from("marketplace_binder_quotes").select("id").eq("id", invoice.data.quote_id).eq("binder_id", binderId).eq("work_id", input.workId).maybeSingle();
  if (quote.error || !quote.data) fail(404, "Facture de commande introuvable.");
  if (!frMainlandPostal(input.fromAddress.countryCode, input.fromAddress.postalCode) || !frMainlandPostal(input.toAddress.countryCode, input.toAddress.postalCode))
    return { available: false, reason: "outside_qualified_area" as const, options: [] };
  const publicKey = process.env.SENDCLOUD_PUBLIC_KEY, secretKey = process.env.SENDCLOUD_SECRET_KEY;
  if (!publicKey || !secretKey) return { available: false, reason: "provider_unconfigured" as const, options: [] };
  const options = await fetchSendcloudShippingOptions({ publicKey, secretKey }, {
    fromCountry: input.fromAddress.countryCode, fromPostalCode: input.fromAddress.postalCode,
    toCountry: input.toAddress.countryCode, toPostalCode: input.toAddress.postalCode,
    weightGrams: input.parcel.weightGrams, dimensionsMm: [input.parcel.lengthMm, input.parcel.widthMm, input.parcel.heightMm],
  });
  if (options === "unavailable") return { available: false, reason: "provider_unavailable" as const, options: [] };
  return { available: true, reason: null, options: options.filter(o => o.currency?.toUpperCase() === "EUR" && o.priceCents !== null && o.priceCents >= 0 && !o.servicePointRequired), queriedAt: new Date().toISOString() };
}
