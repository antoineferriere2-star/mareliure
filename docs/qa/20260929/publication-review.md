# Intégration locale — preuves séparées des deux PR

Ces sections conservent les rapports de chaque branche. Aucun résultat combiné n’est déduit des CI individuelles. Voir le plan de publication coordonnée pour les contrôles de cette intégration.

## PR #51 — paiements

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


---

## PR #52 — logistique

# PR #52 — journal traduit et avis de publication

## Avis : favorable au suivi logistique manuel

Le blocage de traduction/contrôle du journal Fine Bindery est levé. Avis limité au suivi manuel par ouvrage, avec photos privées et déclaration finale de l'atelier, **sous réserve de la CI complète verte du HEAD final**. Aucune fusion ni publication autorisée par cet avis. Les limitations historiques des rapports précédents doivent être lues avec les compléments ci-dessous.

## Traduction et navigateur

`LogisticsPanel` utilise la langue de l'espace atelier. Le dictionnaire typé `logisticsCopy` contient intégralement **EN/FR/DE/IT/ES** : événements, modes, distinction livraison transporteur/réception physique, état constaté, preuves, confidentialité, erreurs, chargement, boutons et déclaration finale. Les dates suivent la langue sélectionnée. Le sélecteur de photo a un libellé localisé, sans dépendre du texte natif du navigateur. Les descriptions, références et noms de transporteurs saisis par l'atelier ne sont pas traduits.

Chromium Playwright isolé, application locale de #52, Auth/SQL/Storage du seul projet **qwfhebtxeubfmvvdsqdt**. Compte atelier QA A réel, ouvrage Fine Bindery `89dd8e53-1d1f-4061-a62f-6aeead6dcc43`. Journal colis déjà achevé par les contrôles mobiles lors de la recette précédente ; aucune migration rejouée.

Dans chacune des cinq langues, bureau 1 440 × 1 000 et mobile 390 × 844 :

- historique et attribution finale affichés dans la langue choisie ; aucun retour français inattendu dans les libellés du journal ;
- note sans description refusée avec une validation traduite ;
- changement de langue par le menu mobile : texte libre conservé, message d'erreur retraduit ;
- date affichée comparée au `dateTime` du serveur dans la locale choisie ;
- aucun débordement horizontal mesuré, contrôles utilisables et captures relues.

Preuve : `journal-i18n-evidence.json`. Captures `journal-*-mobile.png` et `journal-it-desktop.png`. Les captures longues du panneau peuvent inclure l'en-tête et la navigation fixes à leur position de capture ; les contrôles ont aussi été utilisés dans le viewport réel.

## Défaut de reprise réellement reproduit et corrigé

Après le refus d'un SVG, un PNG était bien enregistré mais l'erreur locale « Photo non confirmée » restait visible. La nouvelle tentative efface désormais l'erreur précédente ; un nouvel échec peut toujours l'afficher. Aucun changement des droits, de la RPC ou de Storage.

Reprise contrôlée en espagnol sur mobile, avec un **PNG distinct** :

| Étape | Associations SQL du constat | Objets Storage du constat | Affichage |
|---|---:|---:|---|
| Avant | 1 | 1 | Une photo |
| SVG refusé | 1 | 1 | Erreur traduite |
| PNG valide après refus | 2 | 2 | Deux photos, aucun message d'erreur, envoi terminé |

Les inventaires sont lus réellement dans la RPC et l'API Storage. Preuve : `journal-photo-retry-evidence.json`. Ce constat est distinct des incidents de course et de l'objet isolé antérieur, qui restent conservés et documentés séparément.

## Matrice consolidée

| Contrôle | Résultat et preuve |
|---|---|
| Auth réelle, autre atelier, anonyme, membre désactivé, accès direct SQL/Storage | Réussi — rapport hébergé principal |
| URL privée et expiration après 60 s | Réussi — rapport hébergé principal |
| Aller/réception avec écart/incident/retour/remise finale, colis et main propre, deux marques sur mobile | Réussi — `mobile-transitions-evidence.json` |
| Deux événements concurrents, version périmée, retry sans doublon | Réussi — rapport hébergé principal |
| Huit fichiers distincts, deux ajouts sur dernière place, SQL/Storage/deux onglets | Réussi après correction — `last-slot-concurrency.md` (8/8) |
| Interruption avant SQL, réponse perdue après SQL, reprises concurrentes | Réussi après correction — `photo-recovery-current-evidence.json` |
| Journal Fine Bindery EN/FR/DE/IT/ES bureau/mobile, validation et dates | Réussi — présent complément |
| Refus puis reprise photo : erreur et stockage cohérents | Réussi après correction — présent complément |
| Types régénérés depuis le test et report limité à #52 | Réussi — `../../hosted-qa-results-20260929.md` |
| Panne du nettoyage Storage lui-même | Test unitaire réussi ; panne hébergée non injectée |
| Worker publié et appareils Safari/iOS réels | Non testés |

Le bandeau de QA A (`draft`) est cohérent : clients/ouvrages propres autorisés, projets réseau soumis à approbation séparée. Ses textes ont déjà été clarifiés dans les cinq langues. Le droit réseau refusé n'empêche pas le journal d'un ouvrage propre.

## Limites résiduelles et publication ultérieure

- Suivi manuel d'un aller-retour par ouvrage. Pas d'achat d'étiquette, d'intégration transporteur, de tarif, d'assurance ou de preuve de livraison certifiée ; la remise finale est une déclaration de l'atelier, pas du client.
- URLs signées utilisables jusqu'à expiration après révocation ; pas d'antivirus ni de réencodage des images. Originaux réservés aux accès autorisés. Si le résultat SQL est ambigu et non vérifiable, l'objet est conservé pour reprise ; aucune suppression aveugle.
- Traduction du **journal**, pas certification de l'ensemble des anciennes pages métier. Les contenus libres restent dans leur langue. Chromium mobile émulé, pas un essai sur chaque appareil physique.
- Aucun Worker déployé pendant la recette. La future publication nécessite précontrôle/sauvegarde autorisés, migration `20260928130000` et smoke test après déploiement. Si #51 est retenue aussi : `0900 → 1100 → 1300`. Les conflits de types/handoff entre les branches doivent être relus, sans importer un circuit payant par inadvertance.
- Les échecs initiaux et anciens objets isolés de QA sont conservés dans les preuves. Ils ne sont pas présentés comme de nouveaux échecs des correctifs.

La fiche Sendcloud reste une préparation d'essai, sans prix ni couverture confirmés. Aucune production touchée, migration supplémentaire, fusion, publication ou opération payante.
