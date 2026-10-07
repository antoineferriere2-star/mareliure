// Devis Sendcloud en lecture seule : POST /shipping-options, calculate_quotes=true.
// Aucune étiquette créée. Les clés ne sont jamais écrites ni affichées (seulement longueur + 4 derniers caractères,
// déjà visibles dans l'écran Sendcloud).

function ask(label) {
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
        value += ch; process.stdout.write("*");
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

const who = await fetch("https://panel.sendcloud.sc/api/v2/user", { headers: { Authorization: auth, Accept: "application/json" } });
console.log(`\nContrôle d'authentification (GET /api/v2/user, lecture seule) — HTTP ${who.status}`);
if (!who.ok) { console.log((await who.text()).slice(0, 300)); process.exit(1); }

const trips = [
  ["Paris 75011 → Lyon 69002", "75011", "69002"],
  ["Lyon 69002 → Paris 75011", "69002", "75011"],
];
for (const [label, from, to] of trips) {
  const res = await fetch("https://panel.sendcloud.sc/api/v3/shipping-options", {
    method: "POST",
    headers: { Authorization: auth, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      from_address: { country_code: "FR", postal_code: from },
      to_address: { country_code: "FR", postal_code: to },
      calculate_quotes: true,
      parcels: [{ weight: { value: "500", unit: "g" }, dimensions: { length: "350", width: "250", height: "80", unit: "mm" } }],
    }),
  });
  console.log(`\n=== ${label} (500 g, 35×25×8 cm) — HTTP ${res.status}`);
  if (!res.ok) { console.log((await res.text()).slice(0, 300)); continue; }
  const body = await res.json();
  const rows = (body.data ?? []).map((o) => {
    const t = o.quotes?.[0]?.price?.total;
    return { code: o.code, transporteur: o.carrier?.name ?? o.carrier?.code, prix: t?.value ?? "ABSENT", devise: t?.currency ?? "",
      retour: Boolean(o.functionalities?.returns), relais_requis: Boolean(o.requirements?.is_service_point_required) };
  });
  console.log(`${rows.length} méthode(s), dont ${rows.filter((r) => r.prix === "ABSENT").length} sans prix`);
  console.table(rows.filter((r) => /mondial|colissimo|chrono/i.test(`${r.code} ${r.transporteur}`)).slice(0, 30));
}
