# Recette #54 — parcours aller-retour complet (2 octobre 2026)

Recette **hébergée** : base Supabase de recette `qwfhebtxeubfmvvdsqdt` (jamais la production), application locale (Vite, port 8095 ; instance 8096 avec `MARKETPLACE_BRAND_OVERRIDE=FINE_BINDERY` pour l'espace client en anglais), clé Resend vidée (aucun e-mail possible). Comptes de test existants (`example.invalid` / `.test`), sessions ouvertes côté serveur par lien magique d'administration de la recette : aucun mot de passe saisi, aucun compte créé. Dossiers fictifs `RL-QA-K1` à `K4` (série `RL-QA-J*` : premiers essais, conservés).

Ce qui est **simulé** : le paiement Stripe (ligne `marketplace_commercial_proposal_payments` avec identifiants `cs_QA_SIMULE_*` / `pi_QA_SIMULE_*`) et les deux étiquettes (PDF fictifs « QA ETIQUETTE FICTIVE — NE PAS EXPEDIER », coûts saisis 4,69 € TTC d'après le comparateur Sendcloud). Aucune étiquette n'a été achetée, aucun transporteur appelé.

## Base
- `01-precheck-*` : qwf à 97 migrations, aucune étiquette ni tarif, propositions toutes `manual`.
- `02-apply-result.json` : `20261002090000` appliquée en une transaction (98), verrou d'automatisation fermé. `03-reorder-eligibility.result.json` : correction d'ordre de la règle d'éligibilité (défaut trouvé en recette, voir plus bas), texte de migration enregistré mis à jour. `migration.sha256` = fichier du dépôt.
- `11-fixtures-k.*` : clonage des dossiers QA (ingestion `marketplace_ingest_dossier`), atelier `QA ATELIER B` retenu.

## Résultats
| Preuve | Contenu | Résultat |
|---|---|---|
| `30-hosted-scenarios-rollback.sql` / `30-hosted-results.jsonl` | Refus et reprises sur qwf, transaction annulée : plan figé, produit immuable, Fine Bindery refusé, verrou fermé/ouverture justifiée/fermeture, existant, annulation sans remboursement présumé, remplacement explicite, PDF obligatoire, déficit reconnu (169 cts, prix client 135 € inchangé), suivi dédupliqué, détail privé refusé, accès atelier, privilèges navigateur | **30/30** |
| `31-post-state.json` | Après annulation : verrou fermé, aucun historique d'ouverture, étiquettes K1 intactes | conforme |
| `40-realpg-concurrency.*` | PostgreSQL 17 réel, sessions concurrentes : course plan/accord atelier, double réservation manuelle, double confirmation, double réservation automatique, verrou refermé | **6/6** (+ schéma) |
| `21-phase-a` | Choix avant l'accord, MR bureau/mobile, FB bureau/mobile en anglais, adresse invalide, colis hors limites, autre atelier, accord de réception | 23/25 ¹ |
| `22-phase-b` | Propositions opérateur avec/sans forfait, refus motivé, TVA France, ligne distincte avant l'accord, plan figé, acceptation | 13/14 ¹ |
| `23-phase-c` | Paiement absent, étiquettes manuelles (double clic : 1 réservation), téléchargements par lien signé (client aller, atelier retour), journal, « livré » ≠ reçu, réception avec écart + photo + incident sans exposition au client, retour prêt, adresse reconfirmée, frais 9,38 € TTC, clôture ; remise en main propre sans étiquette | **24/24** |
| `24-phase-d` | Ouverture du verrou sans preuves refusée, verrou resté fermé, autre client sans accès, espace atelier anglais, K3 sans supplément | **8/8** |

¹ Écarts : avertissement React « state update on a component that hasn't mounted yet », intermittent (une fois sur deux sur le même dossier), émis en mode développement seulement, sans effet visible ; et une lecture trop précoce sur K2 dont l'enregistrement est prouvé par les phases B et C.

## Défauts trouvés et corrigés pendant la recette
1. Colis hors limites annoncé comme « correspond au forfait, sous réserve de l'accord de l'atelier » : la règle testait l'accord atelier avant le colis et les adresses. Ordre corrigé (SQL et TS), appliqué sur qwf.
2. « Prochaine étape » en tête de page affichait « Aucune action requise » quand le client devait déposer son colis : bandeau d'action ajouté.
3. Résumé « figurera sur la proposition » après acceptation : verdict masqué après l'accord.
4. Saisie d'étiquette retour proposée avant « retour prêt » et adresse reconfirmée : masquée (la base refusait déjà).
5. Dossier historique accepté sans plan : invitation à choisir un mode sans formulaire possible ; panneau masqué.
6. Import de la fiche ouvrage seulement via « Créer un devis » : accès direct au journal de réception ajouté pour l'atelier retenu.

## Non couvert ici
Fournisseur réel (achat, annulation, webhook Sendcloud) : voir `docs/book-roundtrip-operations.md` § 7. Production : aucune opération.
