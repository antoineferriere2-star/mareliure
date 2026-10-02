// Phase C : paiement SIMULÉ en base (aucun Stripe), étiquettes manuelles fictives, journal atelier,
// retour, clôture ; remise en main propre sans étiquette. Recette qwf uniquement.
const fs = require("fs");
const H = require("./harness.cjs");
const J = (r) => H.FX[r].id;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
fs.writeFileSync(`${__dirname}/qa-photo.png`, PNG);

function simulatePayment(ref) {
  // Paiement simulé : identifiants Stripe fictifs explicites, montant = TTC figé de la proposition acceptée.
  return H.sqlText(`INSERT INTO public.marketplace_commercial_proposal_payments(proposal_id,stripe_checkout_session_id,stripe_payment_intent_id,paid_at,amount_paid_cents,paid_currency)
    SELECT id,'cs_QA_SIMULE_${ref.replace("J", "K")}','pi_QA_SIMULE_${ref.replace("J", "K")}',now(),customer_total_ttc_cents,'eur' FROM public.marketplace_commercial_proposals
    WHERE case_id='${J(ref)}' AND accepted_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.marketplace_commercial_proposal_payments y WHERE y.proposal_id=marketplace_commercial_proposals.id)
    RETURNING jsonb_build_object('ref','${ref}','amount',amount_paid_cents);`, "rw");
}
async function journal(p, action, fields = {}) {
  const journalBox = p.locator("section[aria-label='Logistique de l’ouvrage']");
  await journalBox.getByLabel("Action").selectOption({ label: action });
  if (fields.mode) await journalBox.getByLabel("Mode").selectOption({ label: fields.mode });
  if (fields.carrier) await journalBox.getByLabel(/^Transporteur/).fill(fields.carrier);
  if (fields.tracking) await journalBox.getByLabel(/^Numéro de suivi/).fill(fields.tracking);
  if (fields.condition) await journalBox.getByLabel("État à la réception").selectOption({ label: fields.condition });
  if (fields.description) await journalBox.getByLabel(/^Description/).fill(fields.description);
  if (fields.proof) await journalBox.getByLabel(/^Référence de preuve/).fill(fields.proof);
  await journalBox.getByRole("button", { name: "Enregistrer la déclaration" }).click();
  await p.waitForTimeout(3000);
}
async function uploadManualLabel(p, direction, file, tracking, cost, double = false) {
  const leg = p.locator("details", { hasText: "Déposer une étiquette achetée manuellement" }).first();
  await leg.locator("summary").click();
  await leg.locator("input[type=file]").setInputFiles(file);
  await leg.getByLabel("N° de suivi").fill(tracking);
  await leg.getByLabel("Coût réel TTC (€)").fill(cost);
  const button = leg.getByRole("button", { name: "Enregistrer l'étiquette" });
  if (double) await Promise.all([button.click(), button.click({ force: true }).catch(() => undefined)]);
  else await button.click();
}
async function opensSignedPdf(p, buttonName) {
  const request = p.waitForRequest((r) => r.url().includes("/storage/v1/object/sign/round-trip-labels-private/"), { timeout: 60000 }).then(() => true, () => false);
  await p.getByRole("button", { name: buttonName }).click();
  return request;
}

(async () => {
  const browser = await H.chromium.launch();
  const alreadyPaid = H.sqlText(`SELECT count(*) FROM public.marketplace_commercial_proposal_payments y JOIN public.marketplace_commercial_proposals p ON p.id=y.proposal_id WHERE p.case_id='${J("RL-QA-J1")}';`) !== "0";
  // Paiement absent : aucune saisie d'étiquette proposée à l'opérateur (vérifié au premier passage).
  let { ctx, p, errors } = await H.open(browser, "admin", "MA_RELIURE", false);
  if (!alreadyPaid) {
  await H.visit(p, `/marketplace/cases/${J("RL-QA-J1")}`, "Acheminement du livre");
  await H.has(p, "Frais réellement facturés", 60000);
  H.record("Opérateur K1 sans paiement constaté : aucune saisie d'étiquette", (await p.getByText("Déposer une étiquette achetée manuellement").count()) === 0);
  }
  await ctx.close();

  H.record("Paiements simulés en base (K1 forfait, K2 main propre)", true, `${simulatePayment("RL-QA-J1")} ${simulatePayment("RL-QA-J2")}`.replace(/\s+/g, " "));

  // Opérateur : étiquette aller manuelle, double clic.
  ({ ctx, p, errors } = await H.open(browser, "admin", "MA_RELIURE", false));
  await H.visit(p, `/marketplace/cases/${J("RL-QA-J1")}`, "Acheminement du livre");
  await H.has(p, "Frais réellement facturés", 60000);
  if (!(await H.has(p, "QA-K1-ALLER-0001", 5000))) await uploadManualLabel(p, "outbound", `${__dirname}/qa-label-outbound.pdf`, "QA-K1-ALLER-0001", "4,69", true);
  H.record("Opérateur K1 : étiquette aller enregistrée", await H.has(p, "QA-K1-ALLER-0001", 60000));
  const jobs = JSON.parse(H.sqlText(`SELECT jsonb_build_object('jobs',count(*),'confirmed',count(*) FILTER (WHERE status='confirmed')) FROM public.marketplace_round_trip_label_jobs WHERE case_id='${J("RL-QA-J1")}' AND direction='outbound';`));
  H.record("Double clic : une seule réservation aller, confirmée", jobs.jobs === 1 && jobs.confirmed === 1, JSON.stringify(jobs));
  await H.shot(p, "C1-operateur-K1-etiquette-aller");
  await ctx.close();

  // Client mobile : étiquette aller privée, emballage, méthode.
  ({ ctx, p, errors } = await H.open(browser, "customer", "MA_RELIURE", true));
  await H.visit(p, `/mes-livres/${J("RL-QA-J1")}`, "Acheminement du livre");
  H.record("Client K1 mobile : prochaine action = déposer le colis", await H.has(p, "Imprimez l'étiquette aller", 60000));
  H.record("Client K1 mobile : méthode, suivi et emballage affichés", await H.has(p, "Dépôt en Point Relais Mondial Relay", 5000) && await H.has(p, "QA-K1-ALLER-0001", 5000) && await H.has(p, "Bien emballer un livre", 5000));
  await H.shot(p, "C2-client-K1-mobile-etiquette-aller");
  H.record("Client K1 : téléchargement de l'étiquette par lien signé privé", await opensSignedPdf(p, "Télécharger l'étiquette aller (PDF)"));
  await ctx.close();

  // Atelier : fiche ouvrage, journal aller, livré selon transporteur, réception avec écart, incident, photo.
  ({ ctx, p, errors } = await H.open(browser, "workshop", "MA_RELIURE", false));
  await H.visit(p, `/atelier/cases/${J("RL-QA-J1")}`, "Réception du livre");
  await p.getByRole("button", { name: "Ouvrir la fiche ouvrage et le journal de réception" }).click();
  H.record("Atelier K1 : fiche ouvrage ouverte avec transport aller-retour", await H.has(p, "Transport aller-retour", 90000) && await H.has(p, "QA-K1-ALLER-0001", 30000));
  H.record("Atelier K1 : rappel que « livré » ne vaut pas réception", await H.has(p, "ne suffit pas", 5000));
  await journal(p, "Aller vers l’atelier", { mode: "Colis suivi", carrier: "Mondial Relay", tracking: "QA-K1-ALLER-0001" });
  await journal(p, "Livré selon le transporteur — déclaration atelier", { proof: "QA scan transporteur 0001" });
  ctx.workUrl = p.url();
  await ctx.close();
  ({ ctx, p } = await H.open(browser, "customer", "MA_RELIURE", false));
  await H.visit(p, `/mes-livres/${J("RL-QA-J1")}`, "Acheminement du livre");
  H.record("Client K1 : livré selon le transporteur ≠ reçu (attente de l'atelier)", await H.has(p, "L'atelier confirmera lui-même sa réception", 60000));
  await ctx.close();
  ({ ctx, p, errors } = await H.open(browser, "workshop", "MA_RELIURE", false));
  await H.visit(p, `/atelier/cases/${J("RL-QA-J1")}`, "Réception du livre");
  await p.getByRole("button", { name: "Ouvrir la fiche ouvrage et le journal de réception" }).click();
  await H.has(p, "Transport aller-retour", 90000);
  H.record("Atelier K1 : retour non déclarable avant réception physique", await H.has(p, "Le retour se déclare après la réception physique", 10000));
  await journal(p, "Réception physique constatée à l’atelier", { condition: "Écart constaté — description obligatoire", description: "QA coin légèrement frotté à réception" });
  await p.locator("input[type=file]").first().setInputFiles(`${__dirname}/qa-photo.png`);
  await p.waitForTimeout(4000);
  await journal(p, "Incident", { description: "QA incident fictif : étiquette décollée" });
  H.record("Atelier K1 : réception, photo privée et incident enregistrés", await H.has(p, "QA coin légèrement frotté", 30000) && await H.has(p, "QA incident fictif", 10000) && (await p.locator("img[alt*='Photo']").count()) >= 1);
  await p.getByLabel("Poids (g)").fill("450"); await p.getByLabel("Longueur (cm)").fill("34");
  await p.getByLabel("Largeur (cm)").fill("24"); await p.getByLabel("Épaisseur (cm)").fill("6");
  await p.getByRole("button", { name: "Déclarer le retour prêt" }).click();
  H.record("Atelier K1 : retour déclaré prêt, adresse client attendue", await H.has(p, "En attente de la confirmation de l'adresse de retour", 60000));
  await H.shot(p, "C3-atelier-K1-journal-retour-pret");
  await ctx.close();

  // Client : réception et incident visibles sans les notes internes, confirmation d'adresse.
  ({ ctx, p, errors } = await H.open(browser, "customer", "MA_RELIURE", false));
  await H.visit(p, `/mes-livres/${J("RL-QA-J1")}`, "Acheminement du livre");
  H.record("Client K1 : réception confirmée et incident signalé dans le suivi", await H.has(p, "Réception physique confirmée par l’atelier", 60000) && await H.has(p, "Incident signalé", 5000));
  let v = await H.state(p);
  H.record("Client K1 : aucune note interne, photo ni preuve exposée", !v.text.includes("coin légèrement frotté") && !v.text.includes("étiquette décollée") && !v.text.includes("QA scan transporteur"));
  await p.getByRole("button", { name: "Je confirme cette adresse" }).click();
  H.record("Client K1 : adresse de retour confirmée", await H.has(p, "Le retour est en préparation.", 60000));
  await H.shot(p, "C4-client-K1-retour-confirme");
  await ctx.close();

  // Opérateur : étiquette retour manuelle ; total 9,38 € TTC sous les 15 € encaissés.
  ({ ctx, p } = await H.open(browser, "admin", "MA_RELIURE", false));
  await H.visit(p, `/marketplace/cases/${J("RL-QA-J1")}`, "Acheminement du livre");
  await H.has(p, "Retour (atelier → client)", 60000);
  if (!(await H.has(p, "QA-K1-RETOUR-0001", 5000))) await uploadManualLabel(p, "return", `${__dirname}/qa-label-return.pdf`, "QA-K1-RETOUR-0001", "4,69");
  H.record("Opérateur K1 : étiquette retour enregistrée, frais réels 9,38 € TTC", await H.has(p, "QA-K1-RETOUR-0001", 60000) && await H.has(p, "9,38", 10000));
  await H.shot(p, "C5-operateur-K1-deux-etiquettes");
  await ctx.close();

  // Atelier mobile : étiquette retour privée, journal retour et remise finale.
  ({ ctx, p, errors } = await H.open(browser, "workshop", "MA_RELIURE", true));
  await H.visit(p, `/atelier/cases/${J("RL-QA-J1")}`, "Réception du livre");
  await p.getByRole("button", { name: "Ouvrir la fiche ouvrage et le journal de réception" }).click();
  await H.has(p, "QA-K1-RETOUR-0001", 90000);
  H.record("Atelier K1 mobile : téléchargement de l'étiquette retour par lien signé", await opensSignedPdf(p, "Télécharger l'étiquette retour (PDF)"));
  await H.visit(p, new URL(p.url()).pathname.startsWith("/atelier/ouvrages") ? new URL(p.url()).pathname : `/atelier/cases/${J("RL-QA-J1")}`);
  if (!p.url().includes("/atelier/ouvrages")) { await p.getByRole("button", { name: "Ouvrir la fiche ouvrage et le journal de réception" }).click(); }
  await H.has(p, "Transport aller-retour", 90000);
  await journal(p, "Retour vers le client", { mode: "Colis suivi", carrier: "Mondial Relay", tracking: "QA-K1-RETOUR-0001" });
  await journal(p, "Remise finale déclarée par l’atelier", { proof: "QA remise déclarée 0001" });
  v = await H.state(p);
  H.record("Atelier K1 mobile : retour et remise finale journalisés, sans débordement", v.text.includes("QA remise déclarée 0001") && v.overflow <= 0, `débordement ${v.overflow}px ; ${errors.join(" | ")}`);
  await H.shot(p, "C6-atelier-K1-mobile-cloture");
  await ctx.close();
  ({ ctx, p, errors } = await H.open(browser, "customer", "MA_RELIURE", true));
  await H.visit(p, `/mes-livres/${J("RL-QA-J1")}`, "Acheminement du livre");
  H.record("Client K1 mobile : dossier clos, remise déclarée par l'atelier", await H.has(p, "L'atelier a déclaré la remise de votre livre.", 60000) && await H.has(p, "Livraison finale déclarée par l’atelier", 5000));
  v = await H.state(p);
  H.record("Client K1 mobile : aucun débordement ni erreur", v.overflow <= 0 && errors.length === 0, `débordement ${v.overflow}px ; ${errors.join(" | ")}`);
  await H.shot(p, "C7-client-K1-mobile-clos");
  await ctx.close();

  // Remise en main propre K2 : aucune étiquette, adresse de réception révélée après l'accord.
  ({ ctx, p } = await H.open(browser, "customer", "MA_RELIURE", false));
  await H.visit(p, `/mes-livres/${J("RL-QA-J2")}`, "Acheminement du livre");
  H.record("Client K2 : adresse de réception de l'atelier après accord, aucune étiquette", await H.has(p, "3 rue des Relieurs", 60000) && !(await H.has(p, "Télécharger l'étiquette", 3000)));
  await ctx.close();
  ({ ctx, p } = await H.open(browser, "workshop", "MA_RELIURE", false));
  await H.visit(p, `/atelier/cases/${J("RL-QA-J2")}`, "Réception du livre");
  await p.getByRole("button", { name: "Ouvrir la fiche ouvrage et le journal de réception" }).click();
  await H.has(p, "Trajet et réception", 90000);
  await journal(p, "Aller vers l’atelier", { mode: "Remise en main propre" });
  await journal(p, "Réception physique constatée à l’atelier", { condition: "Conforme au constat attendu" });
  await journal(p, "Retour vers le client", { mode: "Remise en main propre" });
  await journal(p, "Remise finale déclarée par l’atelier", { proof: "QA remise en main propre 0002" });
  H.record("Atelier K2 : main propre journalisée sans étiquette", await H.has(p, "QA remise en main propre 0002", 30000));
  await ctx.close();
  ({ ctx, p } = await H.open(browser, "customer", "MA_RELIURE", false));
  await H.visit(p, `/mes-livres/${J("RL-QA-J2")}`, "Acheminement du livre");
  H.record("Client K2 : clôture visible", await H.has(p, "L'atelier a déclaré la remise de votre livre.", 60000));
  await H.shot(p, "C8-client-K2-main-propre-clos");
  await ctx.close();
  await browser.close();
  H.save("23-phase-c.results.jsonl");
})().catch((e) => { console.error(e); H.save("23-phase-c.results.jsonl"); process.exit(1); });
