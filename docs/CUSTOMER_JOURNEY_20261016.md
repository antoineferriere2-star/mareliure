# Recette locale du parcours client — 16 octobre 2026

**Quatre parcours réussis** : français et anglais, chacun sur bureau (iframe 1 280 px) et mobile (iframe **375 px réels**, mesurés dans la fenêtre du cadre). Base : `origin/main 8737677a30a65a33611346c33087383fa26416d4`.

## Parcours exercé

Chaque scénario remplit les étapes visibles du vrai Playbook Reliure, ajoute une image synthétique, soumet la demande et vérifie son récapitulatif. Il ouvre ensuite l'espace client, choisit le livre et lit la proposition. La fiche d'acheminement refuse un téléphone vide puis le numéro américain `+12025550123`, affiche le message localisé exigeant un téléphone français, puis accepte `0612345678`. Enfin, une réponse simulée après paiement affiche « En préparation » / « Being prepared » sans téléchargement ; la réponse suivante affiche suivi et bouton de téléchargement de l'étiquette aller.

Le test vérifie le dépôt des réponses, la consultation du dossier, le refus avant enregistrement de la fiche, le succès après correction du téléphone, les deux états d'étiquette, la largeur réelle du cadre et l'absence de débordement horizontal à l'état final. La disponibilité de l'étiquette est attestée par le bouton et le suivi ; aucun badge littéral « Prête » n'est inventé.

## Exécution et isolation

```sh
npm ci
npx playwright install chromium
npm run test:e2e:customer
```

Résultat local final : **4 tests réussis en 1,8 minute**, Chromium, un worker. `npm run typecheck` et le lint ciblé des fichiers ajoutés passent également. Le workflow `Local customer journey` exécute cette commande sur les PR concernées et conserve rapport, captures, traces d'échec et journal des appels simulés.

Le serveur Vite local utilise le mode `customer-e2e` et le port 8086. La configuration dédiée ne sélectionne aucun ancien test connecté à Supabase. Toutes les server functions sont interceptées dans Playwright, avec décodage Seroval des requêtes TanStack et sérialisation d'une véritable erreur RPC pour le refus du téléphone. Toute fonction inconnue ou requête externe imprévue fait échouer le scénario. La session Auth est synthétique ; l'écran client réel est rendu sans demander de lien de connexion.

Les identifiants, coordonnées `example.invalid`, image 1 pixel, PDF, suivi et montants affichés sont des **fixtures synthétiques réservées à cette recette**, sans valeur commerciale. L'état payé est fourni par le simulateur ; aucun bouton de paiement, d'achat d'étiquette, d'envoi de message ou de connexion par e-mail n'est activé. Le bouton PDF est vérifié à l'écran sans téléchargement réel. Aucun compte ni donnée de production n'est créé ou modifié.

Cette recette valide le comportement du navigateur face aux réponses simulées. Elle ne valide ni l'authentification réelle, ni les gardes d'accès serveur, ni la délivrance d'un e-mail, ni Stripe ou Sendcloud en production. La validation serveur du téléphone est simulée ; sa sécurité n'est pas déduite de ces tests UI. Le schéma, le moteur de résumé et les composants affichés sont ceux du dépôt.

## Textes à clarifier, sans modification des fichiers de transport

- Le refus de la fiche cite ensemble adresse, code postal, téléphone français, mesures et conditions, même si seul le téléphone est invalide. Il ne désigne pas le champ à corriger. Un message rattaché au téléphone aiderait le client ; le message anglais devrait également expliquer clairement l'exigence d'un numéro français.
- À la disponibilité de l'étiquette, le statut « En préparation » disparaît au profit du suivi et du bouton PDF. Une mention explicite « Étiquette prête » faciliterait la lecture du changement d'état. Le test vérifie les éléments réellement présents.
- Les termes « les plats » et « les cahiers » du récapitulatif restent spécialisés. « Les plats » est expliqué par « les deux faces de la couverture » ; une explication aussi courte pour « les cahiers » serait utile. Aucun changement éditorial n'est appliqué ici.

Les titres et noms de méthodes bilingues portant « recette » / « synthetic » / « QA » dans les captures sont des données de test, pas des défauts de traduction du produit.

## Captures jointes

Les 16 PNG proviennent de la dernière exécution réussie et montrent le cadre complet visible, après défilement vers l'étape contrôlée. Ils sont enregistrés dans Git pour rester consultables depuis la PR et déclarés dans `docs/content-assets.md`.

| Langue et largeur | Demande déposée | Erreur téléphone | En préparation | Étiquette disponible |
|---|---|---|---|---|
| FR — bureau 1 280 px | [Capture](customer-journey-20261016/desktop-fr-submitted.png) | [Capture](customer-journey-20261016/desktop-fr-phone-error.png) | [Capture](customer-journey-20261016/desktop-fr-label-preparing.png) | [Capture](customer-journey-20261016/desktop-fr-label-ready.png) |
| EN — bureau 1 280 px | [Capture](customer-journey-20261016/desktop-en-submitted.png) | [Capture](customer-journey-20261016/desktop-en-phone-error.png) | [Capture](customer-journey-20261016/desktop-en-label-preparing.png) | [Capture](customer-journey-20261016/desktop-en-label-ready.png) |
| FR — mobile 375 px | [Capture](customer-journey-20261016/mobile-375-fr-submitted.png) | [Capture](customer-journey-20261016/mobile-375-fr-phone-error.png) | [Capture](customer-journey-20261016/mobile-375-fr-label-preparing.png) | [Capture](customer-journey-20261016/mobile-375-fr-label-ready.png) |
| EN — mobile 375 px | [Capture](customer-journey-20261016/mobile-375-en-submitted.png) | [Capture](customer-journey-20261016/mobile-375-en-phone-error.png) | [Capture](customer-journey-20261016/mobile-375-en-label-preparing.png) | [Capture](customer-journey-20261016/mobile-375-en-label-ready.png) |

Inspection visuelle locale : étiquette FR et EN mobile, dépôt FR bureau, erreur EN bureau. Les autres captures sont conservées et les quatre parcours ont leurs assertions automatisées ; aucune inspection humaine exhaustive de chaque écran n'est prétendue.
