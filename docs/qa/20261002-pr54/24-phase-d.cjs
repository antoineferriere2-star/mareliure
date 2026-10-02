// Phase D : refus visibles et langues. Aucune ouverture réelle du verrou d'automatisation.
const H = require("./harness.cjs");
const J = (r) => H.FX[r].id;

(async () => {
  const browser = await H.chromium.launch();
  // Opérateur : ouverture de l'achat automatique sans preuves → refus lisible, verrou resté fermé.
  let { ctx, p } = await H.open(browser, "admin", "MA_RELIURE", false);
  await H.visit(p, `/marketplace/cases/${J("RL-QA-J1")}`, "Acheminement du livre");
  await p.getByText(/Achat automatique : fermé/).click();
  H.record("Opérateur : verrou fermé et clés fournisseur absentes affichés", await H.has(p, "clés fournisseur absentes", 30000));
  await p.getByRole("button", { name: "Ouvrir l'achat automatique" }).click();
  H.record("Opérateur : ouverture sans preuves refusée avec un message clair", await H.has(p, "Chaque preuve d'ouverture doit être renseignée", 30000));
  H.record("Verrou toujours fermé en base", H.sqlText("SELECT enabled FROM public.marketplace_round_trip_automation WHERE id;") === "f");
  H.record("Aucun bouton d'achat automatique tant que le verrou est fermé", (await p.getByRole("button", { name: /Acheter l'étiquette automatiquement/ }).count()) === 0);
  await H.shot(p, "D1-operateur-verrou-refus");
  await ctx.close();

  // Un autre client ne voit rien du dossier K1.
  ({ ctx, p } = await H.open(browser, "fbCustomer", "MA_RELIURE", false));
  await H.visit(p, `/mes-livres/${J("RL-QA-J1")}`);
  await p.waitForTimeout(8000);
  let v = await H.state(p);
  H.record("Autre client : ni adresse, ni étiquette, ni suivi du dossier K1", !v.text.includes("rue de la Recette") && !v.text.includes("QA-K1-ALLER") && !v.text.includes("Acheminement du livre"));
  await ctx.close();

  // Espace atelier en anglais (langue Fine Bindery de l'espace) : panneau aller-retour traduit.
  ({ ctx, p } = await H.open(browser, "workshop", "FINE_BINDERY", true));
  await H.visit(p, `/atelier/cases/${J("RL-QA-J1")}`, "Réception du livre");
  await p.getByRole("button", { name: "Ouvrir la fiche ouvrage et le journal de réception" }).click();
  H.record("Atelier, espace en anglais : panneau aller-retour traduit", await H.has(p, "Round-trip shipping", 90000) && await H.has(p, "Outbound (customer → workshop)", 5000));
  v = await H.state(p);
  H.record("Atelier anglais mobile : aucun débordement", v.overflow <= 0, `débordement ${v.overflow}px`);
  await H.shot(p, "D2-atelier-anglais-mobile");
  await ctx.close();

  // Client K3 (colis hors limites, proposition sans forfait) : aucune ligne transport, aucun supplément.
  ({ ctx, p } = await H.open(browser, "customer", "MA_RELIURE", false));
  await H.visit(p, `/mes-livres/${J("RL-QA-J3")}`, "Acheminement du livre");
  v = await H.state(p);
  H.record("Client K3 : traitement adapté, pas de ligne transport ni supplément", await H.has(p, "le forfait ne s'applique pas", 30000) && !v.text.includes("Transport aller-retour —"));
  await ctx.close();
  await browser.close();
  H.save("24-phase-d.results.jsonl");
})().catch((e) => { console.error(e); H.save("24-phase-d.results.jsonl"); process.exit(1); });
