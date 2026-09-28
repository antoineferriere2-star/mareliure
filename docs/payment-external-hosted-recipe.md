# Recette externe PR #51 — instance jetable uniquement

## État des preuves au 28 septembre 2026

Pas de référence/URL/clé ou connexion PostgreSQL de recette configurée dans cet environnement. Seule une configuration de production existe ; elle n'est pas utilisée. Aucun accès Stripe nécessaire au circuit externe. Aucune migration distante exécutée, aucun type annoncé comme régénéré. `types.ts` contient encore les signatures préparées manuellement dans la PR.

Preuves exécutables locales : `npx vitest run src/marketplace/commercial/paymentCircuitMigration.test.ts src/marketplace/commercial/externalSettlement.recipe.test.ts`. Les 19 cas passent sur PostgreSQL/PGlite éphémère. La première suite vérifie la compatibilité des deux origines ; la seconde applique huit migrations réelles dans l'ordre puis exerce les RPC devis/facture/avoir et journal. Le schéma environnant est minimal : cela ne valide ni JWT Supabase, ni PostgREST, ni livraison HTTP du PDF.

## Préparation et ordre des migrations

1. Fournir un projet Supabase de recette explicitement identifié et jetable, avec Auth et Storage, sans données personnelles réelles. Interdire la référence production `qwfhebtxeubfmvvdsqdt`. Ne pas réutiliser `.env.production.mareliure` pour ce travail.
2. Utiliser une base au niveau du main parent de la PR, construite avec toutes les migrations antérieures du dépôt (pas avec les stubs PGlite). Vérifier `select version from supabase_migrations.schema_migrations order by version;` et l'absence des deux versions 20260928. Si 0900 d'une version antérieure de PR #51 a déjà été appliquée, reconstruire cette instance jetable : ne pas masquer la divergence par une réparation de l'historique.
3. Avant 0900, contrôler les doublons qui empêcheraient l'index unique :

```sql
select metadata->>'payment_intent_id', count(*)
from public.marketplace_events
where event_type = 'CUSTOMER_PAYMENT_SUCCEEDED'
  and metadata->>'payment_intent_id' is not null
group by 1 having count(*) > 1;
```

4. Appliquer la version corrigée `20260928090000_marketplace_payment_circuits.sql`, puis `20260928110000_own_client_external_settlement.sql`, chacune en transaction. Vérifier leur enregistrement dans l'historique. Aucune nouvelle migration de tarification ni Stripe.
5. Vérifier les tables `marketplace_case_payment_circuits`, `marketplace_own_client_agreements`, `marketplace_external_settlements`, leurs RLS/grants et index ; lire `pg_get_functiondef('public.marketplace_snapshot_payment_circuit()'::regprocedure)` : le contrôle porte sur `NEW.payment_circuit`, pas sur la qualification du dossier.
6. Générer depuis **cette instance test**, après les deux migrations, vers un fichier intermédiaire :

```powershell
if (!$env:SUPABASE_TEST_PROJECT_REF -or $env:SUPABASE_TEST_PROJECT_REF -eq 'qwfhebtxeubfmvvdsqdt') { throw 'Projet de recette requis' }
npx supabase gen types typescript --project-id $env:SUPABASE_TEST_PROJECT_REF --schema public > output/types.recipe.ts
git diff --no-index -- src/integrations/supabase/types.ts output/types.recipe.ts
```

Contrôler nouvelles tables, colonnes snapshots/circuit, RPC et statut `partial`. Expliquer toute autre différence avant remplacement de `types.ts`, puis relancer TypeScript. Ne pas remplacer le fichier par une sortie CLI vide/en erreur. Les types générés et ce diff sont encore **non disponibles**.

## Données exactes et actions via session Auth

Configurer un serveur de recette avec l'URL et les clés de cette seule instance ; aucune clé Stripe live ni Worker production. Utiliser deux sessions navigateur neuves, chacune connectée par Supabase Auth à un membre actif d'un atelier différent. Créer les comptes dans Auth test (mots de passe générés hors dépôt), puis l'atelier A `QA EXTERNE A` et B `QA EXTERNE B`. Conserver les UUID réels retournés dans le rapport, sans les inventer. Répéter l'accès atelier sur les contextes de marque Ma Reliure et Fine Bindery.

Créer depuis l'espace A un contact propre `QA client externe`, sans dossier réseau ni ouvrage importé ; adresse `QA fictif`, code postal `00000`, ville `QA`, pays `FR`. Atelier fictif : forme `QA`, SIREN `000000000`, SIRET `00000000000000`, même adresse. Ces valeurs sont exclusivement des fixtures techniques, sans portée fiscale. Devise EUR, régime franchise, mention `Mention de recette uniquement`. Devis `QA travaux`, quantité 1, prix 100,00 €, TVA 0, aucun acompte, date 2026-09-28, validité et échéance 2026-10-28. Employer une boîte de test contrôlée pour l'envoi ; aucun destinataire réel.

| Étape dans l'application | Donnée / résultat attendu |
| --- | --- |
| `/atelier/devis/nouveau`, créer puis envoyer | Total 100,00 EUR ; statut envoyé, envoi reçu dans la boîte de test |
| Ouvrir détail devis | Atelier vendeur, règlement direct, frais plateforme 0 ; aucun Checkout |
| Accord | Référence `QA accord écrit du client` ; version `own-external-v1`, montant 10000, acteur A et date conservés |
| Modification concurrente avant accord | Modifier le devis dans un second onglet : l'ancienne confirmation doit échouer, puis réussir après relecture |
| Créer puis émettre facture | Date/prestation 2026-09-28, échéance 2026-10-28, client particulier ; vendeur et montant identiques à l'accord |
| Télécharger facture PDF | Réponse 200, PDF lisible, vendeur/numéro/client/100,00 EUR/mention identiques ; conserver le fichier dans les preuves |
| Règlement 40,00 | Justificatif `Justificatif QA 10` ; net 4000, statut partiel |
| Retry exact / double justificatif | Même requête rejouée : une seule ligne ; nouvelle clé et même justificatif : refus |
| Règlement 70,00 | `Justificatif QA 12` : refus dépassement, net inchangé |
| Règlement 60,00 | `Justificatif QA 13` : net 10000, payé |
| Remboursement 30,00 puis 80,00 | `Justificatif QA 14` : net 7000 ; `Justificatif QA 15` : refus dépassement |
| Remboursement 70,00 | `Justificatif QA 16` : net 0, aucune opération bancaire |
| Ouvrir litige | `Justificatif QA 17` ; règlement 10,00 refusé |
| Clôturer litige | `Justificatif QA 19` ; seconde clôture refusée |
| Règlement 10,00 | `Justificatif QA 21` : net 1000 |
| Avoir intégral | Motif `QA annulation` ; télécharger PDF avoir 100,00 ; net encaissé reste 1000, nouvelles recettes refusées |
| Remboursement 10,00 | `Justificatif QA 23` : net 0, journal conservé |

## Droits et compatibilité réseau

- Avec session B puis sans session : ouvrir les URL du devis, facture et PDF de A, appeler les mêmes fonctions serveur. Aucun document/journal de A ne doit être retourné. Tester aussi membre désactivé. Une réponse HTTP 200 contenant une erreur n'est pas un accès autorisé : contrôler le contenu.
- Depuis PostgREST avec JWT anon puis membre A : écritures directes dans accords/journal/classification et appels RPC réservés service refusés ; le parcours authentifié de l'application reste fonctionnel car il résout l'atelier côté serveur. Aucune clé service dans le navigateur.
- Déclarer payé sans journal, modifier/supprimer un événement, changer vendeur/montant après accord : refus ; mêmes valeurs et nombre de lignes après tentative.
- Créer **en recette seulement** un dossier Ma Reliure puis un Fine Bindery par leurs parcours publics. Pour chacun : proposition commerciale historique brouillon → proposée → acceptée, montant inchangé, `payment_circuit=legacy_resale`, qualification séparée `review_required`. Ne pas payer par Stripe. Vérifier aussi un dossier qualifié `network_sale` avant proposition : sa qualification ne change pas le contrat de revente et ne génère aucun frais cible.
- Conserver un contrat de revente accepté avant 0900, comparer ses montants et termes après migrations. L'ajout des colonnes metadata ne doit pas réécrire ses données métier. Une tentative de contrat cible dans la table commerciale est refusée.

## Gate restant

Consigner UUID de fixtures, versions de migrations, captures, PDF, réponses Auth/HTTP, diff types et résultats des étapes. Ne pas effacer l'historique immuable pour nettoyer : détruire uniquement l'instance jetable selon son processus dédié. Aucun nettoyage en production.

**Impossible actuellement faute d'instance test accessible :** connexion membre réelle, envoi du devis, fonctionnement PostgREST/RLS avec vrais JWT, PDF via HTTP et Storage, chaîne réseau complète hébergée, génération des types. Les tests locaux passent mais ne remplacent pas ces contrôles. Carte 3 %, commission 25 %, conciergerie payante et abonnement restent fermés ; aucune création de Price.
