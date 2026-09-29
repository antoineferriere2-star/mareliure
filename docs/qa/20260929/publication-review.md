# PR #51 — avis de publication après recette navigateur

## Avis : favorable au premier circuit externe uniquement

Le blocage de recette navigateur de l'accord client est levé. Cet avis concerne **client propre → règlement direct à l'atelier déclaré avec justificatif**, sans encaissement par la plateforme. Il ne vaut ni autorisation de fusion/déploiement, ni ouverture des circuits payants encore verrouillés. La CI complète du HEAD final doit être verte.

## Preuve de l'accord client réel dans le navigateur

Chromium Playwright isolé, application locale de #51, Supabase **qwfhebtxeubfmvvdsqdt** uniquement. Aucun appel de recette à la production. Deux nouvelles fixtures dérivées des demandes publiques QA déjà soumises ont été créées pour ne jamais réinitialiser les propositions acceptées lors de la recette HTTP précédente. Les comptes clients Auth de recette et l'atelier B sont réutilisés.

| Marque | Nouveau dossier QA | Proposition |
|---|---|---|
| Ma Reliure | `593d860e-8049-4bac-b2d3-01bc119f089e` | `0900bc09-30fe-4f10-835b-b586c11e7725` |
| Fine Bindery | `466d2ec6-efad-4943-90da-469d9ecf7ad8` | `7d628ecc-2717-4f59-839f-4e4531683e65` |

Pour chacune, sous sa configuration de marque :

1. Connexion réelle du client par e-mail/mot de passe ; ouverture du dossier et de la proposition non acceptée.
2. Contrôle du montant affiché (fixture : 100 € HT, 120 € TTC), du bouton d'accord et de la mise en page en 1 440 px et 390 px.
3. **Clic navigateur sur Accepter la proposition / Accept proposal**, sans appel HTTP de substitution pour l'acceptation de ces nouvelles propositions.
4. Vérification SQL du statut `accepted`, de la date et de `payment_circuit = legacy_resale`.
5. Attente du libellé final daté « Proposition acceptée le… / Proposal accepted on… », puis du bouton de paiement historique, sans le cliquer. Le libellé temporaire « Enregistrement… » n'est pas utilisé comme preuve d'accord affiché.
6. Rechargement : confirmation toujours visible, aucun bouton d'accord, mêmes conditions contractuelles.
7. Connexion séparée de l'atelier B sélectionné ; consultation effective du dossier par sa route atelier et référence vérifiée à l'écran.

**Réussi pour les deux marques**, avant/après sur bureau et mobile, sans débordement horizontal. Preuves structurées : `agreement-browser-MA_RELIURE.json`, `agreement-browser-FINE_BINDERY.json`. Captures finales : `agreement-mr-mobile-accepted.png`, `agreement-fb-mobile-accepted.png`.

Ce contrôle vérifie la **non-régression du parcours réseau historique**. Il n'ajoute pas une signature client au circuit externe, dans lequel l'atelier référence un accord obtenu hors plateforme.

## Contrôles acquis et limites

- Recette hébergée du circuit externe, droits inter-ateliers, règlements/remboursements déclarés, litige, avoir intégral : rapport principal et compléments conservés.
- Avoir réellement téléchargé par bouton, fichier et refus vérifiés : `final-payments-recipe.md`.
- Les contrats acceptés précédemment ne sont ni réouverts ni modifiés. Les montants ci-dessus sont des fixtures, pas une grille commerciale.
- Le parcours depuis un profil Fine Bindery publié, les vrais e-mails de devis/connexion et leur délivrabilité ne sont pas attestés par cette recette. Les comptes QA étaient vérifiés et la connexion utilise un mot de passe.
- Le résumé narratif du playbook historique Fine Bindery reste français dans cette fixture et son lien absolu historique désigne Ma Reliure. Ce sont des limites préexistantes distinctes de #51 ; les champs structurés et l'accord testé sont en anglais.
- Carte à 3 %, commission réseau à 25 %, conciergerie payante, abonnement, catalogue/Connect Stripe et remboursements bancaires ne sont pas activés ni validés ici. Aucun paiement, envoi d'e-mail réel ou achat de transport n'a été déclenché.
- Aucun Worker n'a été publié. Le smoke test du Worker cible et les opérations de production restent à effectuer **après une autorisation distincte**.

## Conditions de publication ultérieure

Revue et CI complète verte, sauvegarde/précontrôle de production autorisés séparément, migrations `20260928090000` puis `20260928110000` dans cet ordre, types conformes et smoke test après déploiement autorisé. La qualification réseau reste séparée du contrat `legacy_resale` ; aucune activation commerciale complémentaire n'est incluse. Si #52 est également retenue, sa migration `20260928130000` vient après les deux précédentes.

Aucune de ces opérations de production n'a été exécutée dans cette mission.
