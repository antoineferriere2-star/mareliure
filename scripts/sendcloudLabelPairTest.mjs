// Paire d'étiquettes de test Sendcloud, même requête que le site (POST /api/v3/shipments/announce).
//   node scripts/sendcloudLabelPairTest.mjs            → devis, récapitulatif, achat après saisie de ACHETER
//   node scripts/sendcloudLabelPairTest.mjs --annuler  → annule les deux envois du dernier achat
// Les clés sont saisies masquées, jamais écrites ni affichées (longueur + 4 derniers caractères seulement).
// Aucun colis n'est déposé : les étiquettes servent au contrôle, puis s'annulent.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "sendcloud-test-labels");
const STATE = join(OUT, "dernier-achat.json");
const BASE = "https://panel.sendcloud.sc/api/v3";

function ask(label, masked = true) {
  return new Promise((resolve) => {
    process.stdout.write(label);
    const stdin = process.stdin;
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding("utf8");
    let value = "";
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") { stdin.setRawMode(false); stdin.pause(); stdin.off("data", onData); process.stdout.write("\n"); return resolve(value.trim()); }
        if (ch === "\u0003") process.exit(1);
        if (ch === "\u0008" || ch === "\u007f") { if (value) { value = value.slice(0, -1); process.stdout.write("\b \b"); } continue; }
        value += ch; process.stdout.write(masked ? "*" : ch);
      }
    };
    stdin.on("data", onData);
  });
}
const describe = (k) => `${k.length} caractères, se termine par …${k.slice(-4)}`;

const pub = await ask("Clé publique Sendcloud (clic droit ou Ctrl+V pour coller) : ");
const sec = await ask("Clé confidentielle Sendcloud : ");
console.log(`Clé publique : ${describe(pub)}\nClé confidentielle : ${describe(sec)}`);
if (!pub || !sec) { console.log("Une clé est vide : rien n'est envoyé."); process.exit(1); }
const auth = `Basic ${Buffer.from(`${pub}:${sec}`).toString("base64")}`;
const call = (path, init = {}) => fetch(`${BASE}${path}`, { ...init,
  headers: { Authorization: auth, Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}) } });

// ---------- Annulation ----------
if (process.argv.includes("--annuler")) {
  if (!existsSync(STATE)) { console.log(`Aucun achat enregistré (${STATE}).`); process.exit(1); }
  const bought = JSON.parse(readFileSync(STATE, "utf8"));
  for (const leg of bought.legs) {
    const path = leg.kind === "return" ? `/returns/${encodeURIComponent(leg.shipmentId)}/cancel` : `/shipments/${encodeURIComponent(leg.shipmentId)}/cancel`;
    const res = await call(path, { method: "POST" });
    const text = await res.text();
    console.log(`${leg.direction} ${leg.shipmentId} — HTTP ${res.status} ${res.status === 200 ? "annulé" : res.status === 202 ? "annulation en file" : text.slice(0, 200)}`);
  }
  process.exit(0);
}

// ---------- Parties (adresses publiques de l'atelier et d'Oppe) ----------
const PARCEL = { weight: { value: "500", unit: "g" }, dimensions: { length: "350", width: "250", height: "80", unit: "mm" } };
const phone = await ask("Téléphone de contact à mettre sur les deux étiquettes (ex. 0612345678) : ", false);
if (!/^\+?[0-9 .]{9,16}$/.test(phone)) { console.log("Téléphone invalide : rien n'est envoyé."); process.exit(1); }
const EMAIL = "contact@oppe.fr"; // pas l'e-mail de l'atelier : aucune notification transporteur chez Justine pour un test
const OPPE = { name: "Antoine Ferrière", company_name: "Oppe", address_line_1: "705 route du Montclair", postal_code: "24160",
  city: "Clermont-d'Excideuil", country_code: "FR", email: EMAIL, phone_number: phone };
const ATELIER = { name: "J. et F. Ferrière", company_name: "Reliure Dorure Ferrière", address_line_1: "9 rue Pothier", postal_code: "45000",
  city: "Orléans", country_code: "FR", email: EMAIL, phone_number: phone };

// ---------- Devis réel des deux trajets ----------
async function options(from, to, extra = {}) {
  const res = await call("/shipping-options", { method: "POST", body: JSON.stringify({
    from_address: { country_code: "FR", postal_code: from.postal_code }, to_address: { country_code: "FR", postal_code: to.postal_code },
    calculate_quotes: true, parcels: [PARCEL], ...extra }) });
  if (!res.ok) { console.log(`Devis refusé — HTTP ${res.status} ${(await res.text()).slice(0, 300)}`); process.exit(1); }
  return ((await res.json()).data ?? []).map((o) => ({ code: o.code, name: o.name ?? o.code,
    price: o.quotes?.[0]?.price?.total?.value ?? null, currency: o.quotes?.[0]?.price?.total?.currency ?? null,
    returns: Boolean(o.functionalities?.returns), servicePoint: Boolean(o.requirements?.is_service_point_required) }));
}
const cheapest = (list) => list.filter((o) => o.price !== null && o.currency === "EUR" && !o.servicePoint)
  .sort((a, b) => Number(a.price) - Number(b.price))[0];

// Aller ordinaire, comme le site le 15/10 : Mondial Relay domicile (dépôt en relais, livraison à l'atelier).
// Les méthodes « Retour » (Chrono 2Shop Retour) sont refusées par Sendcloud sur ce compte (14 et 15/10).
const outOpts = await options(OPPE, ATELIER);
const outbound = cheapest(outOpts.filter((o) => /mondial/i.test(o.code) && !o.returns));
const backOpts = await options(ATELIER, OPPE);
const back = cheapest(backOpts.filter((o) => /mondial/i.test(o.code) && !o.returns));
if (!outbound || !back) {
  console.log("Méthode introuvable au devis : rien n'est acheté.");
  console.log("Aller (Mondial Relay) :", outOpts.filter((o) => /mondial/i.test(o.code)).map((o) => `${o.code} ${o.price ?? "—"} retour=${o.returns} relais=${o.servicePoint}`));
  console.log("Retour (Mondial Relay) :", backOpts.filter((o) => /mondial/i.test(o.code)).map((o) => `${o.code} ${o.price ?? "—"} relais=${o.servicePoint}`));
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const legs = [
  { direction: "aller", reference: `oppe-test-${stamp}-aller`, option: outbound, from: OPPE, to: ATELIER },
  { direction: "retour", reference: `oppe-test-${stamp}-retour`, option: back, from: ATELIER, to: OPPE },
];
console.log("\nRécapitulatif (colis 500 g, 35×25×8 cm, aucun dépôt prévu) :");
for (const l of legs) console.log(` ${l.direction.padEnd(6)} ${l.from.postal_code} → ${l.to.postal_code}  ${l.option.name} (${l.option.code})  ${l.option.price} € HT`);
console.log(` Total ≈ ${(Number(outbound.price) + Number(back.price)).toFixed(2)} € HT, débité par Sendcloud sur le moyen de paiement du compte.`);
const go = await ask("\nTapez ACHETER pour acheter ces deux étiquettes (autre chose = abandon) : ", false);
if (go.toUpperCase() !== "ACHETER") { console.log("Abandon : rien n'est acheté."); process.exit(0); }

// ---------- Achat, un trajet après l'autre ----------
mkdirSync(OUT, { recursive: true });
const done = [];
const refuse = (l, res, text) => {
  console.log(`\n${l.direction} : refusé — HTTP ${res.status}\n${text.slice(0, 600)}`);
  console.log(done.length ? "L'étiquette déjà achetée reste valable : annulez-la avec --annuler." : "Rien n'est acheté.");
};
for (const l of legs) {
  let leg, pdf = null;
  if (l.option.returns) {
    // Une méthode Retour passe par l'API des retours, pas par /shipments/announce (refus constaté le 14/10).
    // Format de l'exemple officiel des retours : numéro de rue à part, téléphone international.
    const intl = (p) => p.replace(/[ .]/g, "").replace(/^0/, "+33");
    const split = (a) => { const m = a.address_line_1.match(/^(\d+\S*)\s+(.+)$/);
      return { ...a, phone_number: intl(a.phone_number), ...(m ? { house_number: m[1], address_line_1: m[2] } : {}) }; };
    const body = { from_address: split(l.from), to_address: split(l.to),
      ship_with: { type: "shipping_option_code", shipping_option_code: l.option.code },
      weight: { value: 0.5, unit: "kg" }, dimensions: { length: 35, width: 25, height: 8, unit: "cm" },
      collo_count: 1, send_tracking_emails: false, external_reference: l.reference, delivery_option: "drop_off_point" };
    const res = await call("/returns/announce-synchronously", { method: "POST", body: JSON.stringify(body) });
    const text = await res.text();
    if (!res.ok) { refuse(l, res, text); break; }
    const created = JSON.parse(text);
    const v2 = await fetch(`https://panel.sendcloud.sc/api/v2/parcels/${created.parcel_id}`, { headers: { Authorization: auth, Accept: "application/json" } });
    const parcel = v2.ok ? (await v2.json()).parcel ?? {} : {};
    leg = { kind: "return", direction: l.direction, reference: l.reference, shipmentId: created.return_id, parcelId: created.parcel_id,
      carrier: parcel.carrier?.code ?? null, tracking: parcel.tracking_number ?? null, status: parcel.status?.message ?? null, method: l.option.code };
    const link = parcel.label?.label_printer ?? parcel.label?.normal_printer?.[0];
    if (link) { const r = await fetch(link, { headers: { Authorization: auth } }); if (r.ok) pdf = Buffer.from(await r.arrayBuffer()); }
  } else {
    const body = { external_reference_id: l.reference, from_address: l.from, to_address: l.to,
      ship_with: { type: "shipping_option_code", properties: { shipping_option_code: l.option.code } }, parcels: [PARCEL] };
    const res = await call("/shipments/announce", { method: "POST", body: JSON.stringify(body) });
    const text = await res.text();
    if (!res.ok) { refuse(l, res, text); break; }
    const shipment = JSON.parse(text).data ?? {};
    const parcel = shipment.parcels?.[0] ?? {};
    leg = { kind: "shipment", direction: l.direction, reference: l.reference, shipmentId: shipment.id, parcelId: parcel.id,
      carrier: shipment.carrier?.code, tracking: parcel.tracking_number, status: parcel.status?.code ?? null, method: l.option.code };
    pdf = shipment.label_file ? Buffer.from(shipment.label_file, "base64") : null;
    const link = parcel.documents?.find((d) => d.type === "label")?.link;
    if (!pdf && link) { const r = await fetch(link, { headers: { Authorization: auth } }); if (r.ok) pdf = Buffer.from(await r.arrayBuffer()); }
  }
  done.push(leg);
  writeFileSync(STATE, JSON.stringify({ boughtAt: new Date().toISOString(), legs: done }, null, 2));
  if (pdf) writeFileSync(join(OUT, `${l.reference}.pdf`), pdf);
  console.log(`\n${l.direction} : créé — envoi ${leg.shipmentId}, colis ${leg.parcelId}, ${leg.carrier}, suivi ${leg.tracking ?? "—"}, statut ${leg.status ?? "—"}, PDF ${pdf ? "enregistré" : "absent"}`);
}
console.log(`\nRésultat enregistré dans ${STATE}${done.length ? "\nPour annuler : node scripts/sendcloudLabelPairTest.mjs --annuler" : ""}`);
