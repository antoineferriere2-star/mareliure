# Atelier fictif hors des compteurs — 8 octobre 2026

L'accord reçu porte sur la recommandation concernant l'atelier explicitement fictif **« TEST GTM CLAUDE - Atelier fictif » uniquement**. Les ateliers « h » et « ok » restent inchangés.

## Modification effectuée

Une seule ligne de `marketplace_binders` est passée de `is_demo=false` à `is_demo=true`, par l'opérateur de base authentifié, en transaction. La ligne complète a été sauvegardée avant l'écriture et comparée dans la transaction ; toute dérive aurait annulé l'opération. La relecture confirme que seul le marqueur et l'horodatage automatique éventuel ont changé. Rien n'a été supprimé.

Le code de main `0bcea1f` n'utilise ce marqueur que pour écarter les ateliers des compteurs d'onboarding du Pilotage et afficher un badge démo dans l'ancienne liste admin. Il ne modifie pas l'éligibilité à la sélection, la gratuité, les accès, les devis, les ouvrages ou les factures.

## Vérifications

- Une seule ligne cible avant et après ; autres ateliers identiques, notamment « h » et « ok ».
- Quatre abonnements gratuits historiques toujours enregistrés, avec leurs états et droits inchangés. Les neuf empreintes protégées hors table ateliers sont identiques, ainsi que les dossiers et les paramètres d'offres.
- Calcul du Pilotage sur production : **3 ateliers validés et 3 gratuits historiques**. Lecture de 20 requêtes et calcul des 12 combinaisons marque/période réussis ; quatre dossiers clos toujours comptés (3 Ma Reliure / 1 Fine Bindery).
- A/B/C et onboarding restent ouverts ; transport automatique fermé, aucune étiquette réservée dans le calcul relu. Aucun e-mail, paiement, achat d'étiquette ou expédition déclenché par cette opération.
- Sauvegarde de ligne privée : `D:/CodexProjects/oppe-model-operation/workshop-demo-20261008-before-verified.json`, SHA-256 `764ef784dd6bae2101e59a2b5796517673ccfcdf1f0f81dece97f577149be9c0`. Preuves, garde-fous SQL et résultat de transaction : `workshop-demo-20261008-*`, hors Git ; ne jamais publier les lignes détaillées ou les secrets.

## Version applicative conservée

PR109, PR110 et PR111 fusionnées ; source `0bcea1f55eb649dce04bd72cc71ab3e1026f7521`, CI main [verte](https://github.com/antoineferriere2-star/mareliure/actions/runs/37820269261), 3 744 tests / 306 fichiers. Worker `946331ac-570b-4d51-b2f5-412f40cd23bd` à 100 %, runtime et 25 bindings comparés à la version précédente et identiques. Retour arrière applicatif `07408f9e-d0b4-45c0-a5f8-e54637269f9e`. Production : 120 migrations.

Ce marquage n'ajoute ni code ni migration et ne nécessite aucun déploiement. Les contrôles visuels du dernier déploiement ont été rapportés par son auteur ; Codex ne les a pas reproduits. La réception réelle des nouvelles alertes e-mail reste à vérifier au prochain événement ; aucune réception de recette n'est revendiquée.
