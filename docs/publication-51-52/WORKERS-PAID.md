# Workers Paid et publication coordonnée — 30 septembre 2026

## Statut final

**Prêt pour la décision d'exécution : les blocages opérationnels sont levés dans le périmètre règlement externe déclaré + journal atelier.** Workers Paid est actif, recette CPU réussie sur qwf, maintenance métier et lanceur déjà éprouvés. Ce constat **n'autorise aucune fusion, migration ou publication en production** ; Execute distant reste désactivé.

Compte `04a831172950eda4a2d9b22435dc114d` : souscription Workers Paid minimum **5 USD/mois + usage**, confirmation « subscription is active » puis bouton Current plan sur Paid. Aucune autre option payante sélectionnée. Les allocations restent partagées par les Workers du compte. Aucun renseignement bancaire ou adresse personnelle dans ce dossier.

Alerte **Billing Budget Alert** active : « Ma Reliure — consommation Cloudflare 10 USD », seuil 10 USD, destinataire propriétaire du compte. Elle concerne la consommation du compte ; **elle ne suspend rien et ne plafonne pas la facture**, ni ne garantit un budget total incluant le forfait mensuel. Pas de test de délivrabilité e-mail. [Documentation officielle](https://developers.cloudflare.com/billing/manage/budget-alerts/).

## CPU effectif et recette Paid

Production mareliure : version **bdddc8b4-2d9a-4193-a477-87e7df682c70** inchangée, API `limits=null` (aucun override). Avec le forfait Paid confirmé, le défaut CPU est **30 000 ms/requête**, déduit de la configuration et des [limites officielles](https://developers.cloudflare.com/workers/platform/limits/), pas d'une mesure de coupure du Worker public. Aucun déploiement/configuration de ce Worker effectué.

Worker temporaire **mareliure-ops-qa-20260930-paid**, version **48712b52-4439-4325-aaeb-a61f41d39dbc** après installation des secrets qwf. API `cpu_ms=1000` réellement confirmée ; aucune route/custom domain, previews fermées, garde privé, qwf exclusivement, aucun Stripe/Resend. Vraie server function du bundle représentatif, vraie Auth atelier de recette, vrais PNG de 4/5 Mio. Mesures Cloudflare GraphQL (microsecondes divisées par 1000), invocations espacées de quatre secondes :

| Scénario | Résultat applicatif | CPU | Marge /1 000 ms |
|---|---|---:|---:|
| Envoi 4 Mio | réussi | 52,671 ms | 947,329 ms |
| Envoi 5 Mio | réussi | 55,391 ms | 944,609 ms |
| Reprise 5 Mio | réussi, sans doublon | 67,331 ms | 932,669 ms |
| Autre atelier | refusé | 13,357 ms | 986,643 ms |
| Sans session | refusé | 14,999 ms | 985,001 ms |
| 5 Mio +1 octet | refusé | 82,370 ms | 917,630 ms |

Les six invocations sont attribuées sans ambiguïté à un point chacune (une requête/0 erreur Worker par point). Un septième point 0,738 ms est la santé, hors tableau. Réponses RPC HTTP200 : les refus sont prouvés par l'erreur applicative, pas classés comme succès à partir du statut HTTP. Aucune erreur de limite CPU. **Deux associations SQL et deux objets Storage**, téléchargement signé et octets exactement identiques aux sources. La reprise ne crée pas de troisième objet/association.

Le plafond préparé **1 000 ms** conserve une marge d'environ 12 fois le maximum Paid observé et 8,2 fois le maximum Free antérieur (121,839 ms). Ce sont des essais ponctuels, pas un percentile de charge ou un plafond de coût mensuel. Aucun contrôle de fichier/confidentialité/hash ou limite huit photos retiré. Les recettes huit photos, concurrence et expiration déjà validées restent conservées, sans être présentées comme rejouées ici.

## Nettoyage vérifié

Transaction qwf épinglée, contrôle des UUID/title de cette seule recette, verrous, triggers immuables restaurés dans la transaction ; contrôles de conservation des comptes avant/après : exactement -1 ouvrage/-1 incident/-2 associations. Deux objets correspondants supprimés via Storage, préfixe vide confirmé. Aucun autre atelier/dossier ni donnée historique supprimé, aucune migration/réconciliation exécutée. Sessions Auth gérées conservées volontairement.

Worker temporaire supprimé, absence API vérifiée. Preuves/config/version/CPU/conservation dans `evidence-final/qa-paid-*` et `workers-paid-confirmed.json`. Capture confirmation sans données bancaires incluse. Le problème de précontrôle des dates du collecteur PowerShell a été corrigé avant sa requête GraphQL ; aucun envoi photo rejoué pour ce problème.

## Nouvel artefact CPU

`limits.cpu_ms=1000` **préparé**, pas encore appliqué au Worker production. `package-cpu1000.ps1` vérifie les SHA archive/manifeste examinés, les chemins ZIP et les 830 fichiers. Seule **server/wrangler.json** change ; aucun changement applicatif/dépendance/migration, nom mareliure et compatibilité 2026-09-25 conservés. Sortie préexistante refusée. Aucun appel réseau ou déploiement dans le script.

- Source applicative ea09dba, préparation à partir de #53 `6781e9b3f5a89d0756d21978eb82b2f3bbc03e88`, diff produit vide.
- Archive protégée **worker-production-cpu1000.zip**, SHA256 **45C1DD7A13385E377504B667205A268FE8C7DF7BA2ACD6C5201B6A7E62AD85B2**.
- **artifact-cpu1000-manifest.json**, SHA256 **CFFAE4DA529D215309BF133BBAEB144B735A67C7D233AD886776296361EE3FF5**.
- 19 tests opérationnels ciblés réussis, dont comparaison des 830 entrées. CI complète du HEAD final à consigner dans la PR. L'ancienne archive reste une référence, **ne pas la publier par erreur**.

## Déroulé exact de publication future, toujours soumis à accord

1. Examiner HEAD/CI finaux, artefact CPU1000 et SHA, trois migrations exactes. Revérifier main inchangé ; toute dérive impose arrêt/nouvelle intégration. Décision explicite de publication et revue/armement du lanceur nécessaires.
2. Fusion normale **#53 seule**, fermeture administrative #51/#52 sans double merge ; fast-forward main et comparaison de l'arbre applicatif au manifeste.
3. Fenêtre coordonnée : garde HTTP quatre domaines/workers.dev/previews/alias, garde SQL métier, refus directs/webhooks vérifiés et drain. Auth/Storage peuvent continuer, dérive suivie ; aucun DDL/autre opérateur postgres pendant la fenêtre. Échec de couverture/lock : arrêt avant migration.
4. Sauvegarde **fraîche sous gel**, DB+Storage, restauration/comparaison isolée, 96 relations/91 entrées historiques. Reçu lié aux fichiers/snapshot et restauration de moins de 30 minutes. La répétition précédente ne remplace pas cette sauvegarde fraîche.
5. ValidateConnected READ ONLY, revue SQL, armer uniquement le lanceur explicitement approuvé. Une seule tentative transactionnelle **20260928090000 → 20260928110000 corrigée → 20260928130000**, SHA inchangés de publication-contract.mjs. Première erreur ou COMMIT incertain : gel maintenu, inspection READ ONLY, aucun rejeu.
6. Postchecks **91 anciennes +3 =94**, données et contrats de revente conservés, contraintes/index/RLS/bucket privé. Types depuis production/diff attendu. Dérive Auth/Storage après COMMIT : préserver état/preuves, arrêt pour examen du delta, pas de rollback/écrasement automatique.
7. Déployer **une seule fois depuis main** le paquet CPU1000 approuvé, vérifier version/config API effective. Smokes en lecture deux marques/Auth/devis/accords/PDF/journal/photos **existants autorisés**, refus autre atelier/session absente. Aucun avoir/facture fictif, accord client ni règlement de recette en production.
8. Réouverture opérateur après contrôles, surveillance/reprise webhooks naturels. Avant COMMIT rollback ; après COMMIT correction compatible, restauration uniquement par décision distincte + delta/RPO. Ne jamais écraser Auth/Storage post-snapshot.

Aucun encaissement commercial, prix Stripe, achat Sendcloud, fusion, migration ou mise en ligne dans cette mission. Carte 3 %, commission25 %, conciergerie payante, abonnement atelier et suivi client après paiement restent verrouillés/exclus. Délivrabilité e-mail, contenus libres historiques Fine Bindery, Safari/iOS physique et panne hébergée nettoyage Storage restent suivis sous les limites PLAN.md ; aucun nouvel audit ni réouverture de l'incident de connexion.
