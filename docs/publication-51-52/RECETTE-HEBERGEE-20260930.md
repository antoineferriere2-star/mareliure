# Recette opérationnelle hébergée — 30 septembre 2026

## Décision proposée : publication bloquée

Le forfait Workers actif est **Free, 10 ms CPU par invocation**, confirmé dans le dashboard authentifié du compte `04a831172950eda4a2d9b22435dc114d`. Les photos passent fonctionnellement, mais leurs mesures CPU dépassent ce plafond. Aucun achat, changement de forfait ou modification de production n'a été effectué. Ne pas confondre la tolérance occasionnelle de Cloudflare et une capacité garantie.

Source applicative : `67c49ead28c3352e82551ff1cbc24c081dd9cf74`, PR #53. Aucun fichier applicatif ni migration modifié dans cette étape ; seuls les outils de préparation et preuves changent. Le build qwf a réussi et un scan de tous les fichiers JS/JSON/HTML produits n'a trouvé aucune référence à `hljxohondjvrkzqicexl`. Le paquet de production précédemment archivé reste inchangé ; le manifeste QA est distinct.

## Worker temporaire et CPU

Worker `mareliure-ops-qa-20260930`, domaine `mareliure-ops-qa-20260930.aferriere.workers.dev`, sans domaine personnalisé ni route de production. Les seuls secrets de service sont qwf ; deux secrets aléatoires protègent la recette et la lecture opérateur. Aucun Stripe/Resend. Le garde refuse une URL Supabase différente de qwf. `run_worker_first` protège aussi les assets. Compatibilité `2026-09-25` et `nodejs_compat`, comme le Worker existant.

Versions : création `9b4f7fd9-57e9-4d64-9e89-b3059250ad32` ; configuration corrigée `f0e1623b-0255-4524-b97a-07c2a203004d` ; maintenance `5b6d1a2d-261b-4b44-8b9b-85b94c199630` ; reprise et fermeture des previews `343c546f-f51a-4090-9a9a-cc1f88341bbf`.

Le premier passage était refusé pour `SUPABASE_PUBLISHABLE_KEY` absent : la clé qwf avait été configurée sous `SUPABASE_ANON_KEY`. Correction de configuration seulement ; 0 association et 0 objet avant reprise. L'échec est conservé dans `qa-cpu-config-failure.json`.

Le passage corrigé utilise la vraie server function du build, une session atelier qwf authentifiée et les vrais PNG de 4 194 304 et 5 242 880 octets. Deux associations SQL et deux objets Storage, téléchargement signé strictement identique aux octets source. Reprise 5 Mio sans doublon. Autre atelier, session absente et 5 Mio + 1 octet refusés dans l'enveloppe RPC (HTTP 200 avec erreur applicative, donc pas assimilés à une réussite).

Les métriques viennent de `workersInvocationsAdaptive`, pas de la durée du client. L'introspection officielle confirme **microsecondes**, converties ci-dessous en ms. La première fenêtre est échantillonnée (4 points dont santé pour 7 requêtes) : 76,187 ms, 34,905 ms et 33,993 ms pour les points applicatifs observés ; pas d'attribution précise inventée aux six scénarios rapprochés.

Pour distinguer les tailles, quatre reprises ont ensuite été espacées de quatre secondes, sans autres requêtes applicatives sur ce Worker :

| Reprise | CPU observé | Plafond | Marge |
|---|---:|---:|---:|
| 4 Mio A | 49,851 ms | 10 ms | -39,851 ms |
| 4 Mio B | 45,550 ms | 10 ms | -35,550 ms |
| 5 Mio A | 121,839 ms | 10 ms | -111,839 ms |
| 5 Mio B | 49,367 ms | 10 ms | -39,367 ms |

Quatre réponses applicatives réussies, aucun doublon ; ces reprises évitent déjà l'écriture Storage et dépassent néanmoins le plafond. Aucun percentile de charge n'est déduit de quatre mesures. Aucun changement de forfait proposé comme opération automatique. Une marge positive doit être démontrée après une optimisation du transport/traitement des photos ou une décision distincte de capacité. Tant que ce point n'est pas levé, le paquet actuel n'est pas recommandé pour publication.

Références : [limites Cloudflare](https://developers.cloudflare.com/workers/platform/limits/), [métriques GraphQL](https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/). La documentation explique la tolérance temporaire des isolates ; elle ne garantit pas les dépassements.

## Maintenance : preuve HTTP réussie, gel global non validé

Huit assertions hébergées réussies : GET client `/` et `/en`, POST server function et webhook retournent 503 ; `Retry-After: 300` et `no-store`. Le jeton opérateur ouvre seulement GET `/qa-health`. POST opérateur et GET non autorisé restent 503. Sans accès privé, 403. Ce contrôle couvre les chemins des deux marques sur le même bundle ; aucun domaine de production n'a été utilisé comme recette.

La première preview est 403 même avec le jeton actuel (elle ne contient pas ces secrets) ; la preview maintenance est 503 avec accès privé. Après `preview_urls:false`, les deux anciennes previews sont 404. Aucune alias de version n'a été créée. Les routes du Worker sont vides. Après désactivation du garde, santé 200 et même corps de webhook sans signature 400 : le webhook n'a pas été faussement acquitté pendant le gel, et redevient traitable. **Cela ne valide pas un événement Stripe signé ni le rejeu commercial** ; aucun appel Stripe effectué.

Transposition production : couvrir les quatre domaines, fermer les previews/alias historiques et l'accès direct non protégé, contrôler chaque entrée avant sauvegarde, puis rétablir exactement les réglages exportés. Un ancien Worker accessible directement contournerait une simple page de maintenance placée sur le domaine.

**Limite encore bloquante** : aucun gel global Supabase n'est prouvé. Le garde Worker ne ferme ni les REST/RPC directs, ni Auth/Storage gérés. Le garde SQL a été éprouvé localement, pas installé globalement sur qwf : l'autorisation d'un Worker isolé ne justifie pas une interruption des autres recettes de ce projet. Il faut finaliser et éprouver la coordination des écrivains directs, la couverture SQL, les envois Storage encore autorisés et les contrôles de dérive. Ne pas prétendre que les huit assertions HTTP lèvent cette condition.

## Incident de connexion : valeur rejetée, diagnostic corrigé

La valeur affichée à 13:30:12 UTC était le mot de passe PostgreSQL temporaire du rôle CLI `cli_login_postgres`, associé au pooler de production. Ce n'était ni une clé applicative Supabase ni un jeton Cloudflare. Sa portée était administrative : le rôle peut assumer `postgres` ; l'option READ ONLY de la commande ne limite pas intrinsèquement le secret.

La valeur exacte a été récupérée uniquement en mémoire depuis l'événement de diagnostic précis, sans réaffichage ni nouveau fichier de secret. Deux connexions de contrôle TLS `verify-full`, requête READ ONLY, ont été refusées (14:27 et 14:50 UTC). Une connexion CLI valide séparée a réussi entre les deux : le refus n'est donc pas seulement une indisponibilité réseau. La preuve finale consigne `authenticationRejected:true`, `connectionAccepted:false`. La cause exacte expiration/rotation n'est pas attribuée sans preuve. Le `valid_until` observé concerne le rôle temporaire courant, pas nécessairement l'ancienne valeur.

Aucune rotation des identifiants des services de production : inutile pour une valeur déjà rejetée. Le défaut de diagnostic était le préfixe `export` non reconnu par une suppression textuelle. `safe-connection-summary.mjs` n'émet désormais qu'une liste fermée de booléens ; deux tests couvrent la forme simple et `export`, y compris une valeur hostile dans l'hôte. Ne jamais afficher le résultat brut de `supabase db dump --dry-run` ni ses erreurs complètes.

## Nettoyage et conservation

Worker temporaire supprimé avec succès. Son unique fiche ouvrage temporaire, son incident et ses deux associations ont été supprimés sur qwf par transaction contrôlée ; les deux objets Storage ont été supprimés par l'API Storage, préfixe vide vérifié. Les triggers immuables ont été désactivés uniquement dans cette transaction sous verrou exclusif et réactivés avant COMMIT ; comparaison des comptes : exactement -1 ouvrage, -1 incident, -2 associations. Aucun compte, atelier ou ancien dossier supprimé. Aucun schéma ni migration ajouté. Le Worker de production reste `bdddc8b4-2d9a-4193-a477-87e7df682c70`.

## Lanceur pour revue, écriture distante matériellement absente

`run-production-preparation.ps1` et `prepare-production-execution.mjs` préparent seulement un SQL ; `Execute` est refusé inconditionnellement et aucune fonction de connexion distante n'existe. Hôte, référence, port, utilisateur, base et TLS sont épinglés. Reçu de sauvegarde de moins de 30 minutes, preuves de restauration/Storage/maintenance vérifiées par empreinte, 91 migrations/96 tables, trois SHA SQL exacts et absence de tentative antérieure obligatoires. Génération exclusive du fichier (pas d'écrasement). Les trois migrations et leur historique sont dans une transaction avec arrêt à la première erreur ; COMMIT sans marqueur ou exit non nul impose inspection sans rejeu.

Les tests locaux couvrent cible/TLS incorrects, preuve altérée ou ancienne, écrivains non arrêtés, mode Execute et COMMIT incertain. **Ce préparateur n'est pas encore un exécuteur de production final** : la vérification de dérive vivante dans la connexion d'exécution et la fenêtre de maintenance complète restent à raccorder après levée des blocages. Aucune répétition SQL supplémentaire n'est présentée comme réalisée ici. La répétition précédente sur copie restaurée reste la preuve des trois migrations exactes.

## Suite exacte avant décision d'exécution

1. Lever le budget CPU et éprouver le gel des écrivains directs ; reconstruire/retester si le code change.
2. Finaliser et faire examiner le lanceur connecté, encore désactivé, avec comparaison vivante schéma/historique/données et preuve de gel. Ne pas se contenter du nombre de migrations.
3. Actualiser source/artefact/empreintes et CI, puis demander une décision distincte de publication.
4. Après cette décision seulement : une fusion de #53 (pas de double fusion #51/#52), maintenance vérifiée, sauvegarde fraîche restaurée/comparée, `0900 → 1100 corrigée → 1300`, contrôles, déploiement unique, lectures autorisées de documents existants, réouverture.

Pas de facture/avoir fictif en production ; circuits carte 3 %, commission 25 %, conciergerie et abonnement verrouillés. Les limites e-mails réels, textes libres historiques Fine Bindery, Safari/iOS physique et panne hébergée du nettoyage Storage ne sont pas levées par ces essais CPU/maintenance.

## Contrôles locaux de cette étape

- Build combiné qwf : réussi ; paquet de recette déployé et testé réellement.
- 11 assertions Node ciblées : réussies (diagnostic, maintenance, protections du préparateur).
- TypeScript : réussi. Lint : 0 erreur, 17 avertissements préexistants.
- Suite complète par défaut : 3 165/3 168, trois expirations à 5 s sur scans de fichiers (secrets, PDF bundle, prix publics).
- Suite complète relancée avec `--maxWorkers=1`, sans changer les délais ni les assertions : **3 168/3 168, 234 fichiers, 152,82 s**. Les premiers timeouts sont consignés, pas masqués par un changement de test.
- Le build production archivé n'a pas été remplacé par le build qwf. Aucun changement de code produit ni de conditionnement production ; sa précédente empreinte reste valide.
