// Phase A : choix avant l'accord (client MR/FB, bureau/mobile), accord de réception de l'atelier.
const H = require("./harness.cjs");
const { FX } = H;
const J = (r) => FX[r].id;

async function fillOrganized(p, { postal = "75011", weight = "480" } = {}) {
  await p.getByLabel(/Expédition organisée/).check();
  await p.getByLabel("Nom et prénom").first().fill("QA Client Fictif");
  await p.getByLabel("Adresse", { exact: true }).first().fill("1 rue de la Recette");
  await p.getByLabel("Code postal").first().fill(postal);
  await p.getByLabel("Ville").first().fill("Paris");
  await p.getByLabel("Téléphone (pour le transporteur)").fill("+33 6 00 00 00 00");
  await p.getByLabel("Poids (g)").fill(weight);
  await p.getByLabel("Longueur (cm)").fill("34");
  await p.getByLabel("Largeur (cm)").fill("24");
  await p.getByLabel("Épaisseur (cm)").fill("6");
  await p.getByLabel("Description (titre, édition, état)").fill("QA roman broché courant, couverture souple");
  await p.getByLabel("Valeur déclarée (€)").fill("30");
  await p.getByLabel(/J'ai lu ces conditions/).check();
}

(async () => {
  const browser = await H.chromium.launch();
  // 1. Client Ma Reliure, bureau : expédition organisée, code postal invalide puis corrigé.
  let { ctx, p, errors } = await H.open(browser, "customer", "MA_RELIURE", false);
  let v = await H.visit(p, `/mes-livres/${J("RL-QA-J1")}`, "Acheminement du livre");
  await H.editIfSaved(p, "Mode d'acheminement", "Votre choix", "Modifier");
  v = await H.state(p);
  H.record("MR bureau J1 : section acheminement et prochaine action", await H.has(p, "Mode d'acheminement"));
  H.record("MR bureau J1 : prix et deux trajets annoncés avant l'accord", v.text.includes("Transport aller-retour 15 € TTC") && v.text.includes("Deux trajets inclus"));
  H.record("MR bureau J1 : conditions sans promesse d'assurance", v.text.includes("Il n'inclut aucune assurance") && v.text.includes("ne voyagent pas par ce forfait"));
  await fillOrganized(p, { postal: "7501" });
  await p.getByRole("button", { name: "Enregistrer" }).click();
  await p.getByText("Vérifiez les champs").waitFor({ timeout: 30000 }).catch(() => undefined);
  v = await H.state(p);
  H.record("MR J1 : adresse invalide refusée avec un message compréhensible", v.text.includes("Vérifiez les champs : adresse, code postal à 5 chiffres"));
  await p.getByLabel("Code postal").first().fill("75011");
  await p.getByRole("button", { name: "Enregistrer" }).click();
  await H.has(p, "Votre choix", 90000);
  v = await H.state(p);
  H.record("MR J1 : plan enregistré, en attente de l'accord atelier", await H.has(p, "Votre envoi correspond au forfait, sous réserve de l'accord de l'atelier", 20000) && await H.has(p, "L'atelier vérifie qu'il peut recevoir votre livre", 5000));
  H.record("MR bureau J1 : aucun débordement, aucune erreur console", v.overflow <= 0 && errors.length === 0, `débordement ${v.overflow}px ; ${errors.join(" | ")}`);
  await H.shot(p, "A1-MR-bureau-J1-plan-enregistre");
  // Colis hors limites.
  v = await H.visit(p, `/mes-livres/${J("RL-QA-J3")}`, "Acheminement du livre");
  await H.editIfSaved(p, "Mode d'acheminement", "Votre choix", "Modifier");
  await fillOrganized(p, { weight: "900" });
  await p.getByRole("button", { name: "Enregistrer" }).click();
  await H.has(p, "Votre choix", 90000);
  v = await H.state(p);
  H.record("MR J3 : colis hors limites → traitement adapté annoncé, aucun supplément", await H.has(p, "Colis au-delà de 500 g ou 35 × 25 × 8 cm : le forfait ne s'applique pas", 20000));
  await H.shot(p, "A3-MR-bureau-J3-hors-limites");
  await ctx.close();

  // 2. Client Ma Reliure, mobile : remise en main propre.
  ({ ctx, p, errors } = await H.open(browser, "customer", "MA_RELIURE", true));
  v = await H.visit(p, `/mes-livres/${J("RL-QA-J2")}`, "Acheminement du livre");
  await H.editIfSaved(p, "Mode d'acheminement", "Votre choix", "Modifier");
  await p.getByLabel(/Remise en main propre/).check();
  H.record("MR mobile J2 : aucun champ d'adresse ni de colis en main propre", (await p.getByLabel("Poids (g)").count()) === 0);
  await p.getByLabel("Description (titre, édition, état)").fill("QA livre de famille, reliure fatiguée");
  await p.getByLabel("Valeur déclarée (€)").fill("50");
  await p.getByLabel(/J'ai lu ces conditions/).check();
  await p.getByRole("button", { name: "Enregistrer" }).click();
  await H.has(p, "Votre choix", 90000);
  v = await H.state(p);
  H.record("MR mobile J2 : remise en main propre enregistrée", v.text.includes("Remise en main propre") && v.text.includes("L'atelier vérifie qu'il peut recevoir votre livre"));
  H.record("MR mobile J2 : aucun débordement à 390 px", v.overflow <= 0 && errors.length === 0, `débordement ${v.overflow}px ; ${errors.join(" | ")}`);
  await H.shot(p, "A2-MR-mobile-J2-main-propre");
  await ctx.close();

  // 3. Client Fine Bindery, mobile et bureau : anglais, pas de forfait organisé.
  for (const mobile of [true, false]) {
    ({ ctx, p, errors } = await H.open(browser, "fbCustomer", "FINE_BINDERY", mobile));
    v = await H.visit(p, `/mes-livres/${J("RL-QA-J4")}`, "Getting your book there and back");
    const device = mobile ? "mobile" : "bureau";
    if (mobile) await H.editIfSaved(p, "How your book travels", "Your choice", "Edit");
    H.record(`FB ${device} J4 : section en anglais, sans forfait organisé`, await H.has(p, "Getting your book there and back", 30000) && (await H.has(p, "How your book travels", 5000) || await H.has(p, "Your choice", 5000)));
    H.record(`FB ${device} J4 : l'expédition organisée n'est pas proposée`, !v.text.includes("Organised shipping —"));
    if (mobile) {
      await p.getByLabel(/Hand delivery/).check();
      await p.getByLabel("Description (title, edition, condition)").fill("QA family bible, worn binding");
      await p.getByLabel("Declared value (€)").fill("80");
      await p.getByLabel(/I have read these terms/).check();
      await p.getByRole("button", { name: "Save" }).click();
      await H.has(p, "Your choice", 90000);
      v = await H.state(p);
      H.record("FB mobile J4 : remise en main propre enregistrée, texte anglais", await H.has(p, "The workshop is checking it can receive your book", 20000));
    }
    H.record(`FB ${device} J4 : aucun texte français dans la section, aucun débordement`, !/Acheminement du livre|Enregistrer/.test(v.text) && v.overflow <= 0 && errors.length === 0, `débordement ${v.overflow}px ; ${errors.join(" | ")}`);
    await H.shot(p, `A4-FB-${device}-J4`);
    await ctx.close();
  }

  // 4. Atelier non concerné (brouillon) : rien n'est révélé.
  ({ ctx, p } = await H.open(browser, "draftWorkshop", "MA_RELIURE", false));
  await H.visit(p, `/atelier/cases/${J("RL-QA-J1")}`);
  await p.waitForTimeout(5000); v = await H.state(p);
  H.record("Autre atelier : ni plan ni adresse du dossier J1", !v.text.includes("Réception du livre") && !v.text.includes("rue de la Recette"));
  await H.shot(p, "A5-autre-atelier-J1");
  await ctx.close();

  // 5. Atelier retenu, bureau puis mobile : accord de réception.
  for (const [ref, mobile] of [["RL-QA-J1", false], ["RL-QA-J3", false], ["RL-QA-J2", true]]) {
    ({ ctx, p, errors } = await H.open(browser, "workshop", "MA_RELIURE", mobile));
    v = await H.visit(p, `/atelier/cases/${J(ref)}`, "Réception du livre");
    H.record(`Atelier ${ref} : plan visible sans l'adresse du client`, v.text.includes("Réception du livre") && !v.text.includes("rue de la Recette") && !v.text.includes("+33 6 00"));
    await p.getByLabel("Nom de l'atelier ou du destinataire").fill("QA ATELIER B");
    await p.getByLabel("Adresse", { exact: true }).fill("3 rue des Relieurs");
    await p.getByLabel("Code postal").fill("69002");
    await p.getByLabel("Ville").fill("Lyon");
    await p.getByRole("button", { name: "J'accepte de recevoir ce livre" }).click();
    await p.getByText("Vous avez accepté la réception.").waitFor({ timeout: 30000 }).catch(() => undefined);
    v = await H.state(p);
    H.record(`Atelier ${mobile ? "mobile" : "bureau"} ${ref} : réception acceptée`, v.text.includes("Vous avez accepté la réception.") && v.overflow <= 0, `débordement ${v.overflow}px ; ${errors.join(" | ")}`);
    await H.shot(p, `A6-atelier-${mobile ? "mobile" : "bureau"}-${ref}`);
    await ctx.close();
  }

  // 6. Client J1 : l'accord de l'atelier est visible.
  ({ ctx, p } = await H.open(browser, "customer", "MA_RELIURE", false));
  v = await H.visit(p, `/mes-livres/${J("RL-QA-J1")}`, "Votre choix");
  H.record("MR J1 : accord atelier visible, proposition attendue", v.text.includes("L'atelier a accepté la réception. La proposition arrive.") && v.text.includes("le transport aller-retour figurera sur la proposition"));
  await ctx.close();
  await browser.close();
  H.save("21-phase-a.results.jsonl");
})().catch((e) => { console.error(e); H.save("21-phase-a.results.jsonl"); process.exit(1); });
