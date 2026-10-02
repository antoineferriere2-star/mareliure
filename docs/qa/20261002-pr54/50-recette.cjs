// Recette complète #54 sur le BUILD DE PRODUCTION (wrangler dev local, base qwf) : deux marques,
// trois rôles, bureau et mobile. Dossiers fictifs RL-QA-L1..L5. Paiement Stripe et étiquettes SIMULÉS.
// Chaque vérification attend son texte (expectText) ; une absence n'est vérifiée qu'après un repère positif.
const fs = require("fs");
const H = require("./harness.cjs");
const id = (ref) => H.FX[ref].id;
const PNG = `${__dirname}/qa-photo.png`;

const L = {
  fr: { organized: /Expédition organisée/, hand: /Remise en main propre/, name: "Nom et prénom", line1: "Adresse", postal: "Code postal", city: "Ville",
    country: "Pays", phone: "Téléphone (pour le transporteur)", weight: "Poids (g)", length: "Longueur (cm)", width: "Largeur (cm)", height: "Épaisseur (cm)",
    description: "Description (titre, édition, état)", value: "Valeur déclarée (€)", accept: /J'ai lu ces conditions/, save: "Enregistrer",
    pending: "Votre envoi correspond au forfait, sous réserve de l'accord de l'atelier.", invalid: "Vérifiez les champs",
    agreed: "L'atelier a accepté la réception. La proposition arrive.", outside: "Une adresse est hors France métropolitaine",
    over: "Colis au-delà de 500 g ou 35 × 25 × 8 cm", line: "Transport aller-retour", ttc: "15,00 € TTC", acceptProposal: "Accepter la proposition",
    pay: "Réglez la proposition pour lancer l'acheminement.", locked: "Ces informations sont figées par la proposition en cours",
    drop: "Imprimez l'étiquette aller", download: "Télécharger l'étiquette aller (PDF)", packaging: "Bien emballer un livre",
    transit: "L'atelier confirmera lui-même sa réception", received: "Réception physique confirmée par l’atelier", incident: "Incident signalé",
    confirm: "Je confirme cette adresse", returning: "Le retour est en préparation.", done: "L'atelier a déclaré la remise de votre livre.",
    finalStep: "Livraison finale déclarée par l’atelier", reception: "3 rue des Relieurs", choose: "Mode d'acheminement", summary: "Votre choix" },
  en: { organized: /Organised shipping/, hand: /Hand delivery/, name: "Full name", line1: "Address", postal: "Postcode", city: "City",
    country: "Country", phone: "Phone (for the carrier)", weight: "Weight (g)", length: "Length (cm)", width: "Width (cm)", height: "Thickness (cm)",
    description: "Description (title, edition, condition)", value: "Declared value (€)", accept: /I have read these terms/, save: "Save",
    pending: "Your parcel fits the flat fee, subject to the workshop's agreement.", invalid: "Please check the fields",
    agreed: "The workshop has agreed to receive the book. Your proposal is on its way.", outside: "An address is outside mainland France",
    over: "Parcel over 500 g", line: "Round-trip shipping", ttc: "incl. tax", acceptProposal: "Accept proposal",
    pay: "Pay the proposal to start shipping.", locked: "These details are fixed by the current proposal",
    drop: "Print the outbound label", download: "Download the outbound label (PDF)", packaging: "Packing a book safely",
    transit: "The workshop will confirm receipt itself", received: "Physically received by the workshop", incident: "Transport incident reported",
    confirm: "I confirm this address", returning: "The return is being prepared.", done: "The workshop has declared your book handed back.",
    finalStep: "Final delivery declared by the workshop", reception: "3 rue des Relieurs", choose: "How your book travels", summary: "Your choice" },
};

async function customerPlan(p, t, { mode = "organized", postal = "75011", country = "FR", weight = "480" }) {
  await H.has(p, t.choose, 90000);
  const edit = p.getByRole("button", { name: t === L.fr ? "Modifier" : "Edit", exact: true });
  if (await edit.count()) await edit.click();
  await p.getByLabel(mode === "organized" ? t.organized : t.hand).check();
  if (mode === "organized") {
    await p.getByLabel(t.name).first().fill("QA Client Fictif");
    await p.getByLabel(t.line1, { exact: true }).first().fill("1 rue de la Recette");
    await p.getByLabel(t.postal).first().fill(postal);
    await p.getByLabel(t.city).first().fill(country === "FR" ? "Paris" : "Bruxelles");
    await p.getByLabel(t.country).first().selectOption(country);
    await p.getByLabel(t.phone).fill("+33 6 00 00 00 00");
    await p.getByLabel(t.weight).fill(weight);
    await p.getByLabel(t.length).fill("34"); await p.getByLabel(t.width).fill("24"); await p.getByLabel(t.height).fill("6");
  }
  await p.getByLabel(t.description).fill("QA livre courant fictif");
  await p.getByLabel(t.value).fill("30");
  await p.getByLabel(t.accept).check();
  await p.getByRole("button", { name: t.save, exact: true }).click();
}
async function workshopAccept(p, ref, tag) {
  await H.visit(p, `/atelier/cases/${id(ref)}`, "Réception du livre");
  await H.expectText(p, `${tag} atelier : plan lisible`, "Réception du livre");
  const v = await H.state(p);
  H.record(`${tag} atelier : adresse et téléphone du client masqués`, !v.text.includes("1 rue de la Recette") && !v.text.includes("+33 6 00"));
  await p.getByLabel("Nom de l'atelier ou du destinataire").fill("QA ATELIER B");
  await p.getByLabel("Adresse", { exact: true }).fill("3 rue des Relieurs");
  await p.getByLabel("Code postal").fill("69002");
  await p.getByLabel("Ville").fill("Lyon");
  await p.getByRole("button", { name: "J'accepte de recevoir ce livre" }).click();
  await H.expectText(p, `${tag} atelier : réception acceptée`, "Vous avez accepté la réception.");
}
async function adminPropose(p, ref, offer, tag) {
  await H.visit(p, `/marketplace/cases/${id(ref)}`, "Acheminement du livre");
  await H.has(p, "Proposition commerciale", 60000);
  await p.getByLabel("Transport").selectOption(offer);
  await p.getByRole("button", { name: /Créer la proposition|Nouvelle version/ }).click();
}
async function adminTax(p, tag) {
  await p.getByPlaceholder("FR").first().fill("FR");
  await p.getByRole("button", { name: "Appliquer TVA France 20 % (automatique)" }).click();
  await H.expectText(p, `${tag} opérateur : TVA France 20 % validée`, "Automatique — TVA France standard 20 %");
}
function simulatePayment(ref) {
  return H.sqlText(`INSERT INTO public.marketplace_commercial_proposal_payments(proposal_id,stripe_checkout_session_id,stripe_payment_intent_id,paid_at,amount_paid_cents,paid_currency)
    SELECT id,'cs_QA_SIMULE_${id(ref)}','pi_QA_SIMULE_${id(ref)}',now(),customer_total_ttc_cents,'eur' FROM public.marketplace_commercial_proposals p
    WHERE case_id='${id(ref)}' AND accepted_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.marketplace_commercial_proposal_payments y WHERE y.proposal_id=p.id)
    RETURNING amount_paid_cents;`, "rw");
}
async function uploadLabel(p, file, tracking, cost, double = false) {
  const box = p.locator("details", { hasText: "Déposer une étiquette achetée manuellement" }).first();
  await box.locator("summary").click();
  await box.locator("input[type=file]").setInputFiles(file);
  await box.getByLabel("N° de suivi").fill(tracking);
  await box.getByLabel("Coût réel TTC (€)").fill(cost);
  const button = box.getByRole("button", { name: "Enregistrer l'étiquette" });
  // Vrai double clic : deux clics synchrones avant tout nouveau rendu ; l'idempotence est côté serveur.
  if (double) await button.evaluate((b) => { b.click(); b.click(); });
  else await button.click();
}
async function journal(p, action, fields = {}) {
  const box = p.locator("section[aria-label='Logistique de l’ouvrage']");
  const before = await box.locator("ol > li").count();
  await box.getByLabel("Action").selectOption({ label: action });
  if (fields.mode) await box.getByLabel("Mode").selectOption({ label: fields.mode });
  if (fields.carrier) await box.getByLabel(/^Transporteur/).fill(fields.carrier);
  if (fields.tracking) await box.getByLabel(/^Numéro de suivi/).fill(fields.tracking);
  if (fields.condition) await box.getByLabel("État à la réception").selectOption({ label: fields.condition });
  if (fields.description) await box.getByLabel(/^Description/).fill(fields.description);
  if (fields.proof) await box.getByLabel(/^Référence de preuve/).fill(fields.proof);
  await box.getByRole("button", { name: "Enregistrer la déclaration" }).click();
  // Attente fiable : l'historique compte une entrée de plus.
  await p.waitForFunction(([n]) => document.querySelectorAll("section[aria-label='Logistique de l’ouvrage'] ol > li").length > n, [before], { timeout: 60000 });
}
async function signedPdf(p, buttonName) {
  const request = p.waitForRequest((r) => r.url().includes("/storage/v1/object/sign/round-trip-labels-private/"), { timeout: 60000 }).then(() => true, () => false);
  await p.getByRole("button", { name: buttonName }).click();
  return request;
}
async function openWork(p, ref) {
  await H.visit(p, `/atelier/cases/${id(ref)}`, "Réception du livre");
  await p.getByRole("button", { name: "Ouvrir la fiche ouvrage et le journal de réception" }).click();
  await H.has(p, "Trajet et réception de l’ouvrage", 90000);
}
async function noErrors(errors, overflow, label) { H.record(label, errors.length === 0 && overflow <= 0, `erreurs=${errors.length} débordement=${overflow}px ${errors.join(" | ").slice(0, 200)}`); }

async function organizedJourney(browser, ref, brand, customer, lang, tag) {
  const t = L[lang];
  const code = `QA-${id(ref).slice(0, 8)}`; // unique par dossier : la référence fournisseur est unique en base
  // A. Client bureau : adresse invalide puis plan valide.
  let { ctx, p, errors } = await H.open(browser, customer, brand, false);
  await H.visit(p, `/mes-livres/${id(ref)}`, t.choose);
  await H.expectText(p, `${tag} client : forfait annoncé avec ses deux trajets`, lang === "fr" ? "Deux trajets inclus" : "Both journeys within mainland France");
  await customerPlan(p, t, { postal: "7501" });
  await H.expectText(p, `${tag} client : code postal invalide refusé, message lisible`, t.invalid);
  await p.getByLabel(t.postal).first().fill("75011");
  await p.getByRole("button", { name: t.save, exact: true }).click();
  await H.expectText(p, `${tag} client : plan enregistré, attente de l'atelier`, t.pending);
  await noErrors(errors, (await H.state(p)).overflow, `${tag} client bureau : sans erreur ni débordement`);
  await H.shot(p, `${tag}-1-client-plan`);
  await ctx.close();
  // B. Atelier : accord de réception.
  ({ ctx, p } = await H.open(browser, "workshop", "MA_RELIURE", false));
  await workshopAccept(p, ref, tag);
  await ctx.close();
  // C. Opérateur : proposition avec forfait, TVA.
  ({ ctx, p, errors } = await H.open(browser, "admin", "MA_RELIURE", false));
  await adminPropose(p, ref, "book_round_trip_fr", tag);
  await H.expectText(p, `${tag} opérateur : proposition avec ligne transport explicite`, "+ Transport aller-retour — 15 € TTC (12,50 € HT)");
  await adminTax(p, tag);
  await ctx.close();
  // D. Client mobile : ligne distincte avant l'accord, plan figé, acceptation.
  ({ ctx, p, errors } = await H.open(browser, customer, brand, true));
  await H.visit(p, `/mes-livres/${id(ref)}`, t.line);
  await H.expectText(p, `${tag} client : ligne « ${t.line} » avant l'accord`, t.line);
  await H.expectText(p, `${tag} client : montant TTC du forfait affiché`, t.ttc);
  await H.expectText(p, `${tag} client : plan figé pendant l'offre`, t.locked);
  await p.getByRole("button", { name: t.acceptProposal }).first().click();
  await H.expectText(p, `${tag} client : acceptée, prochaine action paiement`, t.pay);
  await noErrors(errors, (await H.state(p)).overflow, `${tag} client mobile : sans erreur ni débordement`);
  await H.shot(p, `${tag}-2-client-mobile-acceptee`);
  await ctx.close();
  // E. Paiement simulé, étiquette aller (double clic).
  H.record(`${tag} paiement Stripe simulé en base`, /^\d+$/.test(simulatePayment(ref)));
  ({ ctx, p } = await H.open(browser, "admin", "MA_RELIURE", false));
  await H.visit(p, `/marketplace/cases/${id(ref)}`, "Acheminement du livre");
  await H.has(p, "Déposer une étiquette achetée manuellement", 60000);
  await uploadLabel(p, `${__dirname}/qa-label-outbound.pdf`, `${code}-ALLER`, "4,69", true);
  await H.expectText(p, `${tag} opérateur : étiquette aller enregistrée`, `${code}-ALLER`);
  const jobs = H.sqlText(`SELECT count(*) FROM public.marketplace_round_trip_label_jobs WHERE case_id='${id(ref)}' AND direction='outbound';`);
  H.record(`${tag} double clic : une seule réservation aller`, jobs === "1", `réservations=${jobs}`);
  await ctx.close();
  // F. Client mobile : bandeau, étiquette privée, emballage.
  ({ ctx, p, errors } = await H.open(browser, customer, brand, true));
  await H.visit(p, `/mes-livres/${id(ref)}`, t.drop);
  await H.expectText(p, `${tag} client : action « déposer le colis » en tête et dans la section`, t.drop);
  H.record(`${tag} client : bandeau d'action en tête de page`, (await p.getByText(t.drop).count()) >= 2);
  await H.expectText(p, `${tag} client : conseils d'emballage`, t.packaging);
  H.record(`${tag} client : étiquette aller par lien signé privé`, await signedPdf(p, t.download));
  await ctx.close();
  // G. Atelier : journal aller, livré selon transporteur.
  ({ ctx, p } = await H.open(browser, "workshop", "MA_RELIURE", false));
  await openWork(p, ref);
  await H.expectText(p, `${tag} atelier : fiche ouvrage avec transport aller-retour`, `${code}-ALLER`);
  await H.expectText(p, `${tag} atelier : provenance de la bonne marque`, brand === "FINE_BINDERY" ? "Projet apporté par Fine Bindery" : "Projet apporté par Ma Reliure");
  await journal(p, "Aller vers l’atelier", { mode: "Colis suivi", carrier: "Mondial Relay", tracking: `${code}-ALLER` });
  await journal(p, "Livré selon le transporteur — déclaration atelier", { proof: `QA scan transporteur ${tag}` });
  await ctx.close();
  ({ ctx, p } = await H.open(browser, customer, brand, false));
  await H.visit(p, `/mes-livres/${id(ref)}`, t.transit);
  await H.expectText(p, `${tag} client : « livré » transporteur ≠ reçu`, t.transit);
  await ctx.close();
  // H. Atelier : réception avec écart, photo privée, incident, retour prêt.
  ({ ctx, p } = await H.open(browser, "workshop", "MA_RELIURE", true));
  await openWork(p, ref);
  await H.expectText(p, `${tag} atelier mobile : retour non déclarable avant réception`, "Le retour se déclare après la réception physique");
  await journal(p, "Réception physique constatée à l’atelier", { condition: "Écart constaté — description obligatoire", description: "QA coin légèrement frotté à réception" });
  await p.locator("section[aria-label='Logistique de l’ouvrage'] input[type=file]").first().setInputFiles(PNG);
  await p.waitForFunction(() => document.querySelectorAll("section[aria-label='Logistique de l’ouvrage'] img").length >= 1, null, { timeout: 60000 }).catch(() => undefined);
  H.record(`${tag} atelier : photo privée jointe au constat`, (await p.locator("section[aria-label='Logistique de l’ouvrage'] img").count()) >= 1);
  await journal(p, "Incident", { description: "QA incident fictif : étiquette décollée" });
  await p.getByLabel("Poids (g)").fill("450"); await p.getByLabel("Longueur (cm)").fill("34");
  await p.getByLabel("Largeur (cm)").fill("24"); await p.getByLabel("Épaisseur (cm)").fill("6");
  await p.getByRole("button", { name: "Déclarer le retour prêt" }).click();
  await H.expectText(p, `${tag} atelier : retour prêt, attente de l'adresse client`, "En attente de la confirmation de l'adresse de retour");
  await noErrors([], (await H.state(p)).overflow, `${tag} atelier mobile : sans débordement`);
  await H.shot(p, `${tag}-3-atelier-mobile-retour-pret`);
  await ctx.close();
  // I. Client : réception et incident sans notes internes, confirmation d'adresse.
  ({ ctx, p, errors } = await H.open(browser, customer, brand, false));
  await H.visit(p, `/mes-livres/${id(ref)}`, t.confirm);
  await H.expectText(p, `${tag} client : réception confirmée par l'atelier`, t.received);
  await H.expectText(p, `${tag} client : incident signalé`, t.incident);
  const v = await H.state(p);
  H.record(`${tag} client : aucune note, photo ni preuve de l'atelier exposée`, !v.text.includes("coin légèrement frotté") && !v.text.includes("étiquette décollée") && !v.text.includes("QA scan transporteur"));
  await p.getByRole("button", { name: t.confirm }).click();
  await H.expectText(p, `${tag} client : adresse de retour confirmée`, t.returning);
  await ctx.close();
  // J. Opérateur : étiquette retour, frais réels.
  ({ ctx, p } = await H.open(browser, "admin", "MA_RELIURE", false));
  await H.visit(p, `/marketplace/cases/${id(ref)}`, "Acheminement du livre");
  await H.has(p, "Déposer une étiquette achetée manuellement", 60000);
  await uploadLabel(p, `${__dirname}/qa-label-return.pdf`, `${code}-RETOUR`, "4,69");
  await H.expectText(p, `${tag} opérateur : étiquette retour, frais réels 9,38 € TTC`, "9,38");
  await H.shot(p, `${tag}-4-operateur-deux-etiquettes`);
  await ctx.close();
  // K. Atelier : étiquette retour privée, journal retour, remise finale.
  ({ ctx, p } = await H.open(browser, "workshop", "MA_RELIURE", false));
  await openWork(p, ref);
  await H.has(p, `${code}-RETOUR`, 60000);
  H.record(`${tag} atelier : étiquette retour par lien signé privé`, await signedPdf(p, "Télécharger l'étiquette retour (PDF)"));
  await openWork(p, ref);
  await journal(p, "Retour vers le client", { mode: "Colis suivi", carrier: "Mondial Relay", tracking: `${code}-RETOUR` });
  await journal(p, "Remise finale déclarée par l’atelier", { proof: `QA remise déclarée ${tag}` });
  await H.expectText(p, `${tag} atelier : remise finale journalisée`, `QA remise déclarée ${tag}`);
  await ctx.close();
  // L. Client mobile : clôture.
  ({ ctx, p, errors } = await H.open(browser, customer, brand, true));
  await H.visit(p, `/mes-livres/${id(ref)}`, t.done);
  await H.expectText(p, `${tag} client mobile : dossier clos`, t.done);
  await H.expectText(p, `${tag} client mobile : remise déclarée par l'atelier dans l'historique`, t.finalStep);
  await noErrors(errors, (await H.state(p)).overflow, `${tag} client mobile : sans erreur ni débordement`);
  await H.shot(p, `${tag}-5-client-mobile-clos`);
  await ctx.close();
}

(async () => {
  const browser = await H.chromium.launch();
  await organizedJourney(browser, "RL-QA-L1", "MA_RELIURE", "customer", "fr", "L1");
  await organizedJourney(browser, "RL-QA-L4", "FINE_BINDERY", "fbCustomer", "en", "L4");

  // L2 Ma Reliure mobile : remise en main propre, aucune étiquette.
  let { ctx, p, errors } = await H.open(browser, "customer", "MA_RELIURE", true);
  await H.visit(p, `/mes-livres/${id("RL-QA-L2")}`, L.fr.choose);
  await customerPlan(p, L.fr, { mode: "hand" });
  await H.expectText(p, "L2 client mobile : main propre enregistrée", "L'atelier vérifie qu'il peut recevoir votre livre.");
  await noErrors(errors, (await H.state(p)).overflow, "L2 client mobile : sans erreur ni débordement");
  await ctx.close();
  ({ ctx, p } = await H.open(browser, "workshop", "MA_RELIURE", true));
  await workshopAccept(p, "RL-QA-L2", "L2");
  await ctx.close();
  ({ ctx, p } = await H.open(browser, "admin", "MA_RELIURE", false));
  await adminPropose(p, "RL-QA-L2", "manual", "L2");
  await H.has(p, "v1 ·", 60000);
  await adminTax(p, "L2");
  await ctx.close();
  ({ ctx, p } = await H.open(browser, "customer", "MA_RELIURE", false));
  await H.visit(p, `/mes-livres/${id("RL-QA-L2")}`, L.fr.acceptProposal);
  await p.getByRole("button", { name: L.fr.acceptProposal }).first().click();
  await H.expectText(p, "L2 client : acceptée sans ligne transport", L.fr.pay);
  H.record("L2 client : aucune ligne transport", !(await H.state(p)).text.includes("Transport aller-retour"));
  await ctx.close();
  simulatePayment("RL-QA-L2");
  ({ ctx, p } = await H.open(browser, "customer", "MA_RELIURE", false));
  await H.visit(p, `/mes-livres/${id("RL-QA-L2")}`, L.fr.reception);
  await H.expectText(p, "L2 client : adresse de réception de l'atelier après accord", L.fr.reception);
  H.record("L2 client : aucune étiquette en main propre", (await p.getByRole("button", { name: L.fr.download }).count()) === 0);
  await ctx.close();
  ({ ctx, p } = await H.open(browser, "workshop", "MA_RELIURE", false));
  await openWork(p, "RL-QA-L2");
  await journal(p, "Aller vers l’atelier", { mode: "Remise en main propre" });
  await journal(p, "Réception physique constatée à l’atelier", { condition: "Conforme au constat attendu" });
  await journal(p, "Retour vers le client", { mode: "Remise en main propre" });
  await journal(p, "Remise finale déclarée par l’atelier", { proof: "QA remise en main propre L2" });
  await H.expectText(p, "L2 atelier : main propre journalisée jusqu'à la remise", "QA remise en main propre L2");
  await ctx.close();
  ({ ctx, p } = await H.open(browser, "customer", "MA_RELIURE", true));
  await H.visit(p, `/mes-livres/${id("RL-QA-L2")}`, L.fr.done);
  await H.expectText(p, "L2 client mobile : clôture visible", L.fr.done);
  await ctx.close();

  // L3 Ma Reliure : colis hors limites → traitement adapté, refus motivé, proposition sans forfait.
  ({ ctx, p } = await H.open(browser, "customer", "MA_RELIURE", false));
  await H.visit(p, `/mes-livres/${id("RL-QA-L3")}`, L.fr.choose);
  await customerPlan(p, L.fr, { weight: "900" });
  await H.expectText(p, "L3 client : colis hors limites annoncé avant tout accord, aucun supplément", L.fr.over);
  await ctx.close();
  ({ ctx, p } = await H.open(browser, "admin", "MA_RELIURE", false));
  await adminPropose(p, "RL-QA-L3", "book_round_trip_fr", "L3");
  await H.expectText(p, "L3 opérateur : forfait refusé, raison métier", "Colis emballé au-delà de 500 g ou 35 × 25 × 8 cm : traitement adapté.");
  await ctx.close();

  // L5 Fine Bindery : adresse en Belgique → hors métropole, traitement manuel clair.
  ({ ctx, p, errors } = await H.open(browser, "fbCustomer", "FINE_BINDERY", true));
  await H.visit(p, `/mes-livres/${id("RL-QA-L5")}`, L.en.choose);
  await customerPlan(p, L.en, { postal: "1000", country: "BE" });
  await H.expectText(p, "L5 client FB mobile : hors métropole, devis distinct annoncé", L.en.outside);
  await noErrors(errors, (await H.state(p)).overflow, "L5 client FB mobile : sans erreur ni débordement");
  await H.shot(p, "L5-client-fb-belgique");
  await ctx.close();
  ({ ctx, p } = await H.open(browser, "workshop", "MA_RELIURE", false));
  await workshopAccept(p, "RL-QA-L5", "L5");
  await ctx.close();
  ({ ctx, p } = await H.open(browser, "admin", "MA_RELIURE", false));
  await adminPropose(p, "RL-QA-L5", "book_round_trip_fr", "L5");
  await H.expectText(p, "L5 opérateur : forfait refusé hors métropole", "Une adresse est hors France métropolitaine");
  await ctx.close();

  // Accès et verrou.
  ({ ctx, p } = await H.open(browser, "draftWorkshop", "MA_RELIURE", false));
  await H.visit(p, `/atelier/cases/${id("RL-QA-L1")}`);
  await p.waitForLoadState("networkidle").catch(() => undefined);
  await H.has(p, "Ma Reliure", 30000);
  let v = await H.state(p);
  H.record("Autre atelier : ni plan, ni adresse, ni étiquette de L1", !v.text.includes("Réception du livre") && !v.text.includes("rue de la Recette") && !v.text.includes("QA-L1"));
  await ctx.close();
  ({ ctx, p } = await H.open(browser, "fbCustomer", "MA_RELIURE", false));
  await H.visit(p, `/mes-livres/${id("RL-QA-L1")}`);
  await p.waitForLoadState("networkidle").catch(() => undefined);
  await H.has(p, "Mes livres", 30000);
  v = await H.state(p);
  H.record("Autre client : rien du dossier L1", !v.text.includes("rue de la Recette") && !v.text.includes("QA-L1-ALLER") && !v.text.includes("Acheminement du livre"));
  await ctx.close();
  ({ ctx, p } = await H.open(browser, "admin", "MA_RELIURE", false));
  await H.visit(p, `/marketplace/cases/${id("RL-QA-L1")}`, "Acheminement du livre");
  await p.getByText(/Achat automatique : fermé/).click();
  await p.getByRole("button", { name: "Ouvrir l'achat automatique" }).click();
  await H.expectText(p, "Opérateur : ouverture du verrou sans preuves refusée", "Chaque preuve d'ouverture doit être renseignée");
  H.record("Verrou toujours fermé en base", H.sqlText("SELECT enabled FROM public.marketplace_round_trip_automation WHERE id;") === "f");
  await ctx.close();
  ({ ctx, p } = await H.open(browser, "workshop", "FINE_BINDERY", true));
  await H.visit(p, `/atelier/cases/${id("RL-QA-L4")}`, "Réception du livre");
  await p.getByRole("button", { name: "Ouvrir la fiche ouvrage et le journal de réception" }).click();
  await H.expectText(p, "Atelier, espace anglais : panneau aller-retour traduit", "Round-trip shipping");
  await ctx.close();
  await browser.close();
  H.save("50-recette.results.jsonl");
})().catch((e) => { console.error(e); H.save("50-recette.results.jsonl"); process.exit(1); });
