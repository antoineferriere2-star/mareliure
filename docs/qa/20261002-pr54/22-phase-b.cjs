// Phase B : propositions de l'opérateur (avec / sans forfait), refus explicites, fiscalité, acceptation client.
const H = require("./harness.cjs");
const J = (r) => H.FX[r].id;

async function createProposal(p, offer) {
  await p.getByLabel("Transport").selectOption(offer);
  await p.getByRole("button", { name: /Créer la proposition|Nouvelle version/ }).click();
}
async function validateFranceTax(p) {
  await p.getByPlaceholder("FR").first().fill("FR");
  await p.getByRole("button", { name: "Appliquer TVA France 20 % (automatique)" }).click();
  await H.has(p, "Automatique — TVA France standard 20 %", 60000);
}

(async () => {
  const browser = await H.chromium.launch();
  let { ctx, p, errors } = await H.open(browser, "admin", "MA_RELIURE", false);
  // Colis hors limites : le forfait est refusé avec une raison lisible, la proposition manuelle reste possible.
  await H.visit(p, `/marketplace/cases/${J("RL-QA-J3")}`, "Acheminement du livre");
  H.record("Opérateur K3 : traitement adapté signalé (colis hors plafond)", await H.has(p, "Colis hors plafond (500 g, 35 × 25 × 8 cm) : traitement adapté.", 60000));
  await createProposal(p, "book_round_trip_fr");
  H.record("Opérateur K3 : forfait refusé avec la raison métier", await H.has(p, "Colis emballé au-delà de 500 g ou 35 × 25 × 8 cm : traitement adapté.", 60000));
  await createProposal(p, "manual");
  H.record("Opérateur K3 : proposition sans forfait créée (traitement manuel)", await H.has(p, "v1 ·", 60000));
  await H.shot(p, "B1-operateur-K3-refus-forfait");

  // Parcours organisé : forfait aller-retour sur la proposition, fiscalité France 20 %.
  await H.visit(p, `/marketplace/cases/${J("RL-QA-J1")}`, "Acheminement du livre");
  H.record("Opérateur K1 : plan complet et éligibilité visibles", await H.has(p, "Éligible au forfait « Transport aller-retour — 15 € TTC ».", 60000) && await H.has(p, "1 rue de la Recette", 5000));
  await createProposal(p, "book_round_trip_fr");
  H.record("Opérateur K1 : proposition avec ligne transport explicite", await H.has(p, "+ Transport aller-retour — 15 € TTC (12,50 € HT)", 60000));
  await validateFranceTax(p);
  let v = await H.state(p);
  H.record("Opérateur K1 : fiscalité France 20 % validée, aucune erreur console", errors.length === 0, errors.join(" | "));
  await H.shot(p, "B2-operateur-K1-proposition-forfait");

  // Remise en main propre : proposition sans transport.
  await H.visit(p, `/marketplace/cases/${J("RL-QA-J2")}`, "Acheminement du livre");
  H.record("Opérateur K2 : main propre, pas de forfait", await H.has(p, "Le client n'a pas choisi l'expédition organisée.", 60000));
  await createProposal(p, "manual");
  await H.has(p, "v1 ·", 60000);
  await validateFranceTax(p);
  await ctx.close();

  // Client K1 (bureau) : la ligne distincte avant l'accord, puis acceptation et verrou du plan.
  ({ ctx, p, errors } = await H.open(browser, "customer", "MA_RELIURE", false));
  await H.visit(p, `/mes-livres/${J("RL-QA-J1")}`, "Votre proposition");
  H.record("Client K1 : « Transport aller-retour » en ligne distincte, 15,00 € TTC, avant l'accord",
    await H.has(p, "Transport aller-retour", 60000) && await H.has(p, "15,00 € TTC", 5000) && await H.has(p, "Accepter la proposition", 5000));
  H.record("Client K1 : plan figé pendant l'offre", await H.has(p, "Ces informations sont figées par la proposition en cours", 30000)
    && (await p.getByRole("button", { name: "Modifier", exact: true }).count()) === 0);
  await H.shot(p, "B3-client-K1-proposition-avant-accord");
  await p.getByRole("button", { name: "Accepter la proposition" }).first().click();
  H.record("Client K1 : proposition acceptée, prochaine action = paiement", await H.has(p, "Réglez la proposition pour lancer l'acheminement.", 60000));
  v = await H.state(p);
  H.record("Client K1 : aucun débordement ni erreur console", v.overflow <= 0 && errors.length === 0, `débordement ${v.overflow}px ; ${errors.join(" | ")}`);
  await ctx.close();

  // Client K2 (mobile) : acceptation sans transport.
  ({ ctx, p, errors } = await H.open(browser, "customer", "MA_RELIURE", true));
  await H.visit(p, `/mes-livres/${J("RL-QA-J2")}`, "Votre proposition");
  H.record("Client K2 mobile : aucune ligne transport sur la proposition", !(await H.has(p, "Transport aller-retour", 5000)));
  await p.getByRole("button", { name: "Accepter la proposition" }).first().click();
  H.record("Client K2 mobile : acceptée", await H.has(p, "Réglez la proposition pour lancer l'acheminement.", 60000));
  v = await H.state(p);
  H.record("Client K2 mobile : aucun débordement", v.overflow <= 0, `débordement ${v.overflow}px ; ${errors.join(" | ")}`);
  await H.shot(p, "B4-client-K2-mobile-acceptee");
  await ctx.close();
  await browser.close();
  H.save("22-phase-b.results.jsonl");
})().catch((e) => { console.error(e); H.save("22-phase-b.results.jsonl"); process.exit(1); });
