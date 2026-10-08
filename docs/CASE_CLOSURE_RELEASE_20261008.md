# Classement sans suite et statuts admin — 8 octobre 2026

## Résultat en production

Les PR [#106](https://github.com/antoineferriere2-star/mareliure/pull/106) et [#107](https://github.com/antoineferriere2-star/mareliure/pull/107) sont fusionnées et publiées. Source applicative : `7c006a479f4825a58e2ae3e5da43730300aa0237` (main après #107). Worker actif à 100 % : `07408f9e-d0b4-45c0-a5f8-e54637269f9e`, déploiement `556d01e8-234b-4b07-aa32-10e792b204f8`. Retour arrière applicatif : `005b597d-0792-47a8-b63f-082799a6cbc4`. Les migrations additives restent en place en cas de retour arrière du Worker.

La décision explicite du propriétaire limite le classement à RL-005 à RL-009, avec le motif « Dossier de test interne ». Les garde-fous restent applicables.

| Dossier | Résultat | Trace |
| --- | --- | --- |
| RL-005 | Annulé | Un événement, motif demandé, ancien statut under_review |
| RL-007 | Annulé | Un événement, motif demandé, ancien statut under_review |
| RL-008 (Fine Bindery) | Annulé | Un événement, motif demandé, ancien statut under_review |
| RL-009 | Annulé | Un événement, motif demandé, ancien statut pricing |
| RL-006 | Conservé à matching | Une proposition existante interdit le classement ; aucun événement de clôture |
| RL-003, RL-004, RL-010 | Inchangés | Exclus de l'autorisation |

Le classement a utilisé la fonction SQL canonique, en transaction, par l'opérateur de base authentifié `postgres`. Les événements portent `execution_source=database_operator` et un acteur nul ; aucune identité admin ou session web n'a été fabriquée. Les quatre dossiers ont été comparés à leur état observé avant écriture ; motif, ancien statut et événement ont été relus ensuite. Aucune suppression, aucun e-mail client, paiement réel ou achat d'étiquette.

Le calcul réel du Pilotage compte maintenant quatre clos pour les deux marques réunies : trois Ma Reliure, un Fine Bindery. Douze combinaisons marque/période ont été recalculées avec le code déployé à partir des données de production en lecture seule. Aucun statut inconnu n'est compté comme clos.

## Corrections de revue

- Le bouton « Classer sans suite » exige un motif de 5 à 300 caractères, un rôle admin, un statut interne (under_review, pricing, matching), et l'absence de sollicitation d'atelier comme de proposition.
- Statut et événement sont écrits atomiquement : un échec de journalisation annule aussi la modification du statut. Le verrou du dossier et les gardes sur les invitations/propositions empêchent une invitation concurrente de contourner le contrôle.
- Le Pilotage et la liste admin partagent les étapes actuelles. Pricing est « Prix à valider », seul cancelled est « Clos / sans suite », un statut inconnu reste « Autre ».
- La réparation des invitations ignore les dossiers annulés, les liens déjà présents et les dossiers verrouillés pendant une clôture. Le tri ignore aussi les dossiers annulés sans tri antérieur. Sans cette correction #107, la nouvelle garde pouvait faire échouer une lecture admin.

Deux migrations appliquées : `20261008100000_case_closure_atomic.sql` (#106) et `20261008110000_closed_case_reconciliation.sql` (#107). Production : **120 migrations**. Ces migrations n'ont pas modifié les données métier ; les clôtures ont été une opération explicite distincte après publication et contrôles HTTP réussis. La migration #106 a été appliquée avant sa fusion à cause d'une erreur de répertoire dans l'outillage, signalée pendant l'exécution ; ses contrôles ont confirmé l'absence de modification métier. #106 a ensuite été fusionnée, #107 répétée puis fusionnée avant application, et le Worker n'a été activé qu'après les deux.

## Vérifications et sauvegardes

- CI complète [#107](https://github.com/antoineferriere2-star/mareliure/actions/runs/37772616039), sur `560847e9b9acb594bd85050cdf4e7dc2dae1c64e` : **3 733 tests / 304 fichiers**, 19 garde-fous de publication, typage, lint et build réussis. CI main [7c006a4](https://github.com/antoineferriere2-star/mareliure/actions/runs/37772977493) également verte. Le premier passage de #107 a révélé trois faux clients sans filtre neq ; ils ont été corrigés et un test d'exclusion ajouté.
- Tests ciblés locaux : 11 recettes SQL, 4 tests de routage/tri, 12 tests de statuts et Pilotage réussis. Typage et lint propres ; 19 avertissements de lint préexistants.
- Sur PostgreSQL natif restauré : quatre classements autorisés et refus de RL-006, puis deux conflits réellement concurrents. Clôture d'abord : invitation refusée ; invitation d'abord : clôture refusée après attente du verrou. La recette fonctionnelle a été annulée en transaction ; les conflits n'ont touché que la copie locale.
- Sauvegarde complète avant #106 : 1 347 621 octets, 1 801 entrées, SHA-256 `e18edb4bb93d3878f3c9713c71163da53706852d9b971368bff295b9729872f4`.
- Sauvegarde fraîche après #106 et avant #107 : 1 353 429 octets, 1 807 entrées, SHA-256 `599c012cf96c24380d444ed366c7751dfd7ec0eb33b40288d52188e7dfd7d726`.
- Chaque migration répétée sur sa copie restaurée. L'environnement PostgreSQL local ne dispose pas de Supabase Vault et ne reprend pas la propriété des event triggers Supabase : 14 erreurs de restauration identifiées sur ces seuls objets, aucune erreur métier inattendue. Les 15 empreintes de tables protégées étaient identiques avant/après migration ; cette limite n'est pas présentée comme une restauration complète de Vault.
- Le bundle de production a été construit sur `1e6af43` ; le seul changement ensuite dans `560847e` concerne un fichier de test. L'identité du code applicatif et des migrations avec le merge `7c006a4` a été vérifiée. Bundle client limité au projet Supabase production, contrôle d'interopérabilité serveur réussi.
- Runtime et **25 bindings** du Worker précédent conservés, dont les trois secrets Sendcloud ; aucune exception QA. Routage assets de #103 conservé, racine Fine Bindery redirigée en 301 vers /en.
- **41 contrôles HTTP de production réussis** : 27 contrôles d'offres/routes/refus, dont clôture, onboarding Connect, tarif transport et achat sans authentification ; 14 contrôles de signatures Stripe et de redirection HTTPS. Refus Sendcloud sans signature ou avec signature invalide en 401. Aucun débit ni écriture métier issus de ces sondes.
- Après les classements : dix empreintes financières identiques, propositions et invitations inchangées, dossiers exclus inchangés, un événement conforme pour chacun des quatre dossiers classés. Lecture de 20 requêtes du Pilotage et calcul de 12 combinaisons réussis.

Computer Use n'a pas démarré malgré la récupération prévue. **Aucune recette visuelle connectée ni succès HTTP authentifié n'est revendiqué**. Le bouton est vérifié par le code, les tests, le build et son refus HTTP sans authentification ; les classements et le calcul du Pilotage sont vérifiés directement en production.

## Offres et transport conservés

A/B/C et l'onboarding Connect restent ouverts. Les quatre ateliers historiques restent gratuits. TVA et décision administrative existantes conservées ; aucun avis comptable ou juridique prétendu. Aucun document historique modifié.

Le transport automatique reste **fermé**, paramètres et preuves antérieurs inchangés, zéro réservation d'étiquette. La présente opération n'a réalisé aucune expédition physique. Les limites et prérequis restent dans [la passation Sendcloud](SENDCLOUD_WIRING_20261007.md) et [la validation de tarif](SENDCLOUD_RATE_APPROVAL_20261007.md).

Preuves privées et archives : `D:/CodexProjects/oppe-model-operation/closure-pr106-*` et `closure-pr107-*`. Les états détaillés et secrets restent hors Git.
