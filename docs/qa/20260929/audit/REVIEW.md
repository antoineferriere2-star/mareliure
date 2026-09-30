# Réponse à l'audit contradictoire — 29 septembre 2026

L'avis précédent ne couvrait pas les deux régressions. Il ne constitue plus un feu vert. Aucune production modifiée.

## Correctifs #51

- Confirmé : le bouton de refus d'un devis accepté contredisait le trigger d'immutabilité. Transition retirée côté UI et serveur ; accord conservé, indication explicite d'annulation documentée et d'avoir après facture. Aucun trigger d'immutabilité affaibli.
- Confirmé : acompte et statut expiré bloqués par le déclencheur d'accord. Reproduction hébergée avant correctif : `hosted-before.json`. Le contrat externe exige maintenant un devis envoyé, valide à la date de Paris et sans acompte. L'acceptation historique des brouillons, expirés et devis avec acompte reste possible, sans `agreement_version` et donc sans accès au journal externe. Un devis simplement affiché expiré par sa date est aussi exclu du nouveau circuit. Aucun paiement supplémentaire activé.
- Le contrat est rechargé après changement de statut : passer de brouillon à envoyé propose effectivement la référence d'accord requise.
- Recette SQL locale : matrice de 24 variantes sur les six migrations historiques de main puis sur 0900/1100, plus trois états terminaux UI. Les acceptations historiques réussissent sur main ; les refus après accord passaient sur main et sont volontairement interdits désormais. Passage `accepted → invoiced` possible, retour arrière ensuite refusé. La recette existante couvre la véritable émission de facture et l'avoir.
- Recette hébergée : 24 variantes, Auth atelier réelle via fonctions HTTP, contrôle SQL direct complémentaire du refus immuable. Résultats et UUID fictifs dans `hosted-matrix.json`. Une fixture supplémentaire a été créée lors d'un premier essai HTTP avant que Vite soit joignable ; aucune donnée existante supprimée.

Sur le seul test `qwfhebtxeubfmvvdsqdt`, remplacement transactionnel de deux fonctions avec conservation contrôlée des empreintes de tous les accords acceptés et de l'historique des migrations. `test-only-function-patch.sql` n'est PAS un script de production. Aucun rejeu de 0900/1100, aucune modification de leur historique hébergé. Pour une base neuve/production non migrée, utiliser le fichier 1100 corrigé dans l'ordre documenté. Les signatures et tables ne changent pas : aucun nouveau type n'est requis.

## Autres constats

| Constat | Réponse | Portée |
|---|---|---|
| Suivi client après paiement | Confirmé par lecture du code | Les étapes postérieures existent dans `cases/state.ts` mais aucun appel applicatif ne pilote leur progression. #52 est un journal atelier, pas un suivi client. Ne pas promettre ce dernier. |
| Photo Worker 4–5 Mo | Risque non vérifié avant essai Worker | Le décodage `atob`/boucle était réel. Correctif et preuves relèvent de #52. |
| Webhook synchrone main | Confirmé dans le code ; incident de production non vérifié | #51 utilise `constructEventAsync`. Aucune consultation ni opération Stripe. |
| Découpage Stripe | Possible si #51 demeure bloquée | Extraire ensemble signature asynchrone, rapprochement/idempotence et tests ; vérifier les dépendances SQL de l'index unique. Un cherry-pick partiel sans revue n'est pas un correctif sûr. Pas de nouvelle PR Stripe ni activation à ce stade. |
| Journal limité aux clients propres | Confirmé, conforme à la décision | Ne pas élargir aux factures historiques/réseau/acompte par opportunité. |
| Référence de justificatif unique | Confirmé, intentionnel | Deux règlements distincts nécessitent deux références de reçus distinctes, pas deux fois « Espèces ». L'erreur serveur mentionne l'unicité. Ne pas relâcher la déduplication. |
| Webhook après huit échecs | Confirmé | Le 500 conserve l'échec rejouable ; commentaire 200 corrigé. Prévoir alerte et examen manuel, aucune fausse confirmation. |
| Doublons PaymentIntent | Aucun au précédent contrôle en lecture seule | Observation datée, pas garantie permanente ; contrôle à refaire avant migration. |
| Correctif récapitulatif dans #51 / ancienne PR docs | Confirmé | Petit correctif issu de la recette deux marques conservé ; ne pas fermer #38 sans instruction. #50 hors assemblage tant qu'elle n'est pas retenue. |
| CGV, vendeur, transport | Points contractuels/éditoriaux à examiner | Distinguer revente historique OPPE SAS et atelier vendeur de ses travaux. Faire examiner les CGV provisoires, identification du vendeur à l'accord et preuve de version acceptée. Le journal manuel ne vend ni transport ni assurance. Aucune conclusion juridique ou garantie inventée. |
| Fine Bindery, langues et canal concierge | Confirmé pour les contenus historiques | Un canal de messages ne constitue pas une conciergerie facturée. Ne pas annoncer tout le parcours traduit ni une nouvelle offre payante. |

## Gates encore à compléter

Contrôle visuel, tests complets/CI des nouveaux HEAD, essai Worker #52, nouvel assemblage avec `npm ci` et CI propre, mise à jour du plan. Tant que ces preuves manquent, aucun avis final « prêt » n'est émis.

Complément exécuté : navigateur Chromium bureau/mobile sur Ma Reliure ET Fine Bindery (trois scénarios chacun : acompte, expiré, accord externe). Pas de débordement horizontal de page ; refus absent après accord. Deux émissions de factures historiques vérifiées sur qwf par RPC : acompte et expiré, règlement externe ensuite refusé. Types régénérés depuis qwf : dix membres pertinents identiques (tables/RPC), aucune signature changée. Les anciens écarts Métré/test ne remplacent pas types.ts.

Annulation avant facture : aucun nouvel état d'annulation n'est inventé. L'écran explique la conservation de l'accord et de l'échange avec le client. Après émission, l'avoir existant reste la voie documentaire ; il ne rembourse pas le compte bancaire. Un suivi d'annulation avant facture pourra être spécifié séparément.

Diagnostic local : un premier passage complet a donné 3 139/3 140 avec un timeout du scan PDF (5 s, lecture froide du bundle Windows). Le même fichier isolé passe en 0,48 s ; aucun seuil modifié. Résultat du second passage complet et CI à consigner ci-dessous.

Second passage complet : 230 fichiers, 3 140 tests réussis, 134,48 s, maxWorkers=1, sans hausse de timeout. La fixture du contrat neuf utilise une date future relative pour rester valide lors des exécutions ultérieures. La CI Ubuntu/Node 24 reste exigée sur le commit final.

Build générique #51 réussi. Il ne constitue pas un artefact de production. TypeScript et lint livrable réussis (17 avertissements existants) ; fixture datée revalidée séparément après passage à CURRENT_DATE + 30.
