# Workers Paid et plafond CPU — préparation du 30 septembre

## État réel

Le passage à Workers Paid (5 USD/mois + usage) est autorisé. Le checkout a été ouvert sur le compte `04a831172950eda4a2d9b22435dc114d`, offre Workers Paid uniquement. **Activation non confirmée** : Cloudflare demande encore l'adresse/type de facturation et la finalisation dans sa page sécurisée. Aucun abonnement supplémentaire activé, aucune modification du Worker production. Aucune donnée bancaire dans ce dossier.

Une alerte **Billing Budget Alert** a été créée et vérifiée active : « Ma Reliure — consommation Cloudflare 10 USD », seuil 10 USD, destinataire propriétaire du compte. Elle concerne la consommation du compte, **ne suspend rien et ne plafonne pas la facture**. Pas de test de délivrabilité e-mail effectué. Le seuil ne doit pas être interprété comme un budget total comprenant forcément le forfait mensuel. [Documentation officielle](https://developers.cloudflare.com/billing/manage/budget-alerts/).

## Nouvel artefact CPU

Plafond préparé `limits.cpu_ms=1000`, soit 878,161 ms de marge sur le maximum observé 121,839 ms (environ 8,2 fois). Ce n'est pas un plafond de coût mensuel. Le Worker production en service n'a pas reçu ce réglage.

Le script `package-cpu1000.ps1` vérifie les empreintes de l'archive et du manifeste déjà examinés, les chemins ZIP, les 830 fichiers et l'absence d'octet supplémentaire. Il reconstruit une archive protégée ; **seul server/wrangler.json change**, ajout du plafond, aucun changement applicatif/dépendance/migration. Nom mareliure et compatibilité 2026-09-25 conservés. Aucune connexion réseau ni déploiement dans ce script ; sortie préexistante refusée.

- Source applicative ea09dba, préparation à partir de #53 `6781e9b3f5a89d0756d21978eb82b2f3bbc03e88` (diff produit vide).
- Archive protégée `worker-production-cpu1000.zip` : SHA256 **45C1DD7A13385E377504B667205A268FE8C7DF7BA2ACD6C5201B6A7E62AD85B2**.
- `artifact-cpu1000-manifest.json` : SHA256 **CFFAE4DA529D215309BF133BBAEB144B735A67C7D233AD886776296361EE3FF5**.
- 19 unités ciblées réussies, dont comparaison des 830 entrées et unicité du changement de configuration. L'archive antérieure reste conservée pour comparaison, ne pas la publier par erreur.

## Ce qui reste à exécuter après activation effective

1. Vérifier Workers Paid Current plan/Active dans le compte, sans confondre les plans DNS gratuits des deux domaines avec le forfait Workers. Lire en API la configuration CPU du Worker mareliure, sans la modifier. Contrôler le forfait appliqué et l'absence d'override CPU restrictif.
2. Déployer seulement `mareliure-ops-qa-20260930-paid`, qwf exclusivement, sans route/domaine production, previews désactivées, garde privé et plafond 1000 ms. Secrets qwf uniquement, aucun Stripe/Resend.
3. Via vraie server function et Auth atelier qwf, fichiers réels 4/5 Mio : envoi, reprise sans doublon, autre atelier/session absente et dépassement 5 Mio refusés. Espacer les invocations et relever leurs CPU GraphQL en microsecondes converties, pas les temps réseau. Comparer associations SQL, objets Storage et octets privés effectivement relus. Les règles huit photos et autres recettes validées restent conservées, pas refaites sans défaut.
4. Conserver version/config effective/métriques et résultats ; retirer uniquement Worker et données de recette créés ici, avec inventaire SQL/Storage avant/après. Ne pas effacer Auth géré.
5. Actualiser #53 et contrôler CI complète du HEAD final. **Ne pas présenter l'artefact préparé ni les tests Free antérieurs comme une nouvelle recette Paid réussie.**

## Déroulé futur de publication, toujours non autorisé

Les opérations ci-dessous restent conditionnées à une autorisation distincte :

1. Examiner HEAD/CI finaux, artefact CPU1000 et empreintes, migrations exactes ; vérifier main inchangé et fermer le brouillon après accord.
2. Fusion normale **#53 seule** ; clôturer #51/#52 sans double fusion, fast-forward main et comparaison de l'arbre.
3. Fenêtre coordonnée : garde HTTP quatre domaines/workers.dev/previews/alias, garde métier SQL et refus directs vérifiés, drain des écrivains. Auth/Storage gérés peuvent continuer, dérive suivie ; autre opérateur postgres/DDL interdit pendant la fenêtre.
4. Sauvegarde **fraîche sous gel**, DB + Storage, restauration isolée/comparaison, 96 relations /91 migrations ; reçu lié aux fichiers/snapshot moins de 30 minutes.
5. ValidateConnected READ ONLY, revue SQL, armer seulement le lanceur explicitement approuvé. Une seule transaction `20260928090000 → 20260928110000 corrigée → 20260928130000`, empreintes inchangées de publication-contract.mjs. Première erreur ou COMMIT incertain : inspection READ ONLY, aucun rejeu.
6. Postchecks 91 anciennes +3 =94, conservation métier/contrats de revente, contraintes/index/RLS/bucket privé, types Supabase et diff attendu. Dérive Auth/Storage : préserver leur état, arrêt pour examen du delta.
7. Déployer une seule fois depuis main le paquet CPU1000 approuvé, puis vérifier sa configuration effective. Smokes en lecture des deux marques/Auth/documents/PDF/journal/photos existants autorisés ; refus autre atelier/session absente. Aucun avoir/facture fictif ni règlement de recette en production.
8. Réouverture opérateur après contrôles, surveillance/reprise des webhooks naturels. Avant COMMIT rollback ; après COMMIT correction compatible ou restauration avec nouvelle décision/delta/RPO, jamais écrasement Auth/Storage.

Execute production toujours désactivé. Circuits payants et suivi client après paiement exclus. Incidents/recettes déjà validés non rouverts.

Lecture API après rafraîchissement OAuth normal : mareliure reste version `bdddc8b4-2d9a-4193-a477-87e7df682c70`, compatibilité 2026-09-25, aucun `limits` explicite (`null`). Le plafond suit donc le forfait réellement actif tant que le nouveau paquet n'est pas publié ; ne pas assimiler cette lecture à une activation Paid. Capture de l'alerte active dans evidence-final, sans données bancaires. La finalisation du checkout n'est pas confirmée, recette Paid non exécutée à ce stade.
