# Audit sécurité RLS et accès aux dossiers — 16 octobre 2026

## Actualisation du 20 octobre 2026, après-midi — brief n° 6

Base intégrée dans la branche de cette PR : `origin/main f4bb8d0c81e893d44c803a6b87420551a1220ad8` (#150 incluse). Les conflits de handoff ont été résolus en conservant les deux blocs. Aucun rapport historique supprimé, aucune fusion de PR ni déploiement.

Les ACL historiques et les sondes de l’audit sont conservées comme état avant correction. Ils ne décrivent plus les droits après application de #140. Aucune fuite réelle nouvelle ni nouvelle preuve d’absence de fuite n’est déduite de la seule relecture. Les 78 tables, buckets et politiques ne sont pas réinventoriés en production ici.

### Avant / correction / preuve

| Avant, dans les relevés historiques | Correction fusionnée (SHA de tête ; SHA de fusion) | Preuve relue et portée |
| --- | --- | --- |
| Un tarif expiré ne pouvait pas être remplacé proprement ; mesures et reprise devaient rester liées au dossier. | #128 : `dce423f3dd5efaf4ef1746f5b8baa6e8347c2cd8` ; `ad8d88389ca48eaccfe7da6867b45240fe410096`. | Migration `20261015100000_round_trip_rate_versions.sql` ; cinq assertions SQL du script `sendcloudP1Review` actualisé : dernière revue, expiration, réservation réutilisée, adresse et colis. Ce sont des essais PGlite, pas des devis réels Sendcloud. |
| Réservation ambiguë sans résolution opérateur et annulation insuffisamment projetée. | #129 : `ea88522a4187af1941cbc4a50cd2fcf45592ad1b` ; `4e56fa6f91f5758d4ae418a59b6236128c86cc9e`. | Migration `20261016100000_round_trip_label_resolution.sql`, transitions et annulation en file puis finale. Le test vérifie que le remboursement reste NULL ; aucune annulation réelle ni remboursement fournisseur testé. |
| Des chemins de photos stockés pouvaient référencer une autre session. | #135 : `ef0f074505b2f2a945e7540ebb756a5fd702bb14` ; `325d209869fd7750eb16c5b141418ec2932918a4`. | Contrôle de session dans `src/build/engine/visitorSummary.ts` et résolveur de références photo. Cette première correction n'avait pas clos le résumé public : voir #141. Les sondes historiques restent datées de leur SHA. |
| Adoption d'un colis non vérifié, événement d'annulation arrivant avant rattachement, annulation v2 sans recherche v3. | #136 : `a1a75d593234a69dbd489ab22ce85708d146c4d2` ; `5ec9605cca687f8c7bd578fbfbfb8c3e2b87f170`. | `labelOrchestrator.ts`, `sendcloudProvider.server.ts`, `sendcloudWebhook.ts` ; non-régressions référence étrangère, étiquette annulée, relecture après adoption, fallback par identifiant et annulation v2. Fournisseur simulé. Compléments #141 nécessaires pour les cas résiduels. |
| Droits table/colonne trop larges, fonctions trigger exposées, quatre search_path exposés non fixés. | #140 : `45822bdbf3af3e8507092cbce0172f4f47b1fc4d` ; `0b46cc8adcfe0de76ef3d1e4a24255e2fd2deaca`. | Migration `20261020100000_marketplace_grants_hardening.sql` et reçu `docs/operations/20261019_marketplace_grants_application.json` : application et relecture le 19/10, 123 migrations. **Pas de nouvelle relecture SQL de production dans cette actualisation.** Le contrôle connecté du 20/10 comporte la réserve de marquage automatique comme lu décrite dans #146. |
| Résumé public signant encore une photo étrangère ; reprise d'étiquette annulée ; identité de colis v3 et annulation concurrente résiduelles. | #141 : tête finale `00ca6999c79315a4d4dbce498335c1109d3f8c4e` ; `908688a0fe5703bff3d434b3aa4ffaab4b4ed194`. | Relecture de `src/routes/api/public/project-summary.ts` et des contrôles transport ; tests unitaires des routes et du transport dans la suite générale. Les deux P2 vus sur la tête intermédiaire `7582d72` ne décrivent pas cette tête finale : contrôle d'un colis unique et identique, annulation déjà enregistrée reconnue. |
| Deux constats simultanés rendaient une erreur ; une adoption perdante conservait son PDF. | #142 : `8a920541b224a4342b12a858084446c4223c0f61` ; `9721dc6bd7923e6e7a3240e388fd46073be30b36`. | Non-régressions : deux succès pour un seul événement SQL, refus de confirmer le job échoué, PDF retiré si Storage accepte. Les ordres PDF indépendants de #147 vérifient l'absence de référence confirmée vers un objet manquant dans le stockage simulé. |
| Échec Storage du retrait absorbé ; garde-fou #144 ignorant plusieurs formes SQL. | #149 : `d472b084072454bf2ae73544964b1cbb13dd4433` ; `4e5cc92ad59e4071f6c6803b3c3b82a0f44a121e`. | Retour `review_required/label_orphaned` et note `label_discard_failed` ; anciennes reproductions converties en assertions du correctif. Détecteur extrait dans `src/marketplace/security/tableGrants.ts`, tests des syntaxes déjà signalées et des renommages. La contre-revue indépendante de #149 examine **d'autres** angles : ces non-régressions ne prouvent pas l'exhaustivité du parseur ou de l'affichage. |

Les SHA ci-dessus sont ceux des corrections, vérifiés dans l’ascendance de la base. La preuve est soit la relecture du code, soit l’essai local nommé, soit un reçu historique explicitement daté ; les résultats exécutés cet après-midi sont consignés dans le bloc daté du handoff. Aucun achat, paiement, compte ou e-mail.

## Relevé historique conservé — état aux dates et SHA d’origine


## Résultat pour le propriétaire

**Une faille de cloisonnement des photos est à corriger (P1).** Les primitives locales acceptent et signent un chemin Storage fourni dans les réponses sans le rattacher à la session du projet. Il faut déjà connaître le chemin d'une photo ; aucune énumération ni lecture de photo réelle n'a été tentée. La RLS des tables ne bloque pas cette chaîne, car la signature passe par la clé de service.

Les **78 tables public.marketplace_*** ont la RLS activée ; les **10 buckets sont privés**. Les **160 SELECT sous les rôles anon et authenticated** n'ont retourné aucune ligne : 84 résultats à zéro et 76 refus de privilèges. Aucun accès direct aux adresses, téléphones, tarifs, étiquettes ou factures d'un autre dossier n'est établi par ces contrôles. Cela ne dispense pas des contrôles du serveur : service_role contourne la RLS.

**40 tables portent encore des droits SQL excessifs pour anon/authenticated (P2)**, notamment TRUNCATE, auquel la RLS ne s'applique pas. L'API REST ne fournit pas une commande TRUNCATE : ce constat n'est pas présenté comme une suppression anonyme réalisable par HTTP.

Cette PR est documentaire : aucun correctif, migration, modification de transport, compte, e-mail, achat ou déploiement. Le chantier 3 est terminé, comme indiqué par le propriétaire ; les deux migrations sont présentes dans le catalogue relu.

## Périmètre, méthode et limites

- Code : origin/main **8737677a30a65a33611346c33087383fa26416d4** ; l'audit Sendcloud du 15 octobre a été relu depuis sa branche documentaire, car son rapport n'est pas encore dans ce main.
- Catalogue production Supabase **hljxohondjvrkzqicexl**, lu à **2026-10-16T07:29:22.612802+00:00** : **122 migrations**, dernière **20261016100000**. Le Worker e93441f1 était celui annoncé dans le brief du 15 octobre ; son état n'a pas été relu dans cet audit.
- Connexion PostgreSQL TLS verify-full vérifiée par le client existant ; **BEGIN READ ONLY**, timeouts, puis COMMIT/ROLLBACK. Les requêtes reproductibles sont [catalog.sql](security-rls-audit-20261015/catalog.sql) et [role-probes.sql](security-rls-audit-20261015/role-probes.sql). Aucun appel d'une fonction métier susceptible d'écrire n'a été fait en production.
- Inventaire : tables et ACL effectives, politiques, droits par colonne, rôles, buckets, 129 fonctions publiques liées à marketplace ou SECURITY DEFINER, empreinte de leurs définitions. Toutes les valeurs publiées sont des métadonnées ; aucune ligne de dossier, adresse, numéro ou URL signée de production n'est publiée.
- Les sondes SET LOCAL ROLE n'utilisent ni JWT client ni compte atelier. Les politiques marketplace étant inconditionnellement fausses ou absentes, les claims ne peuvent pas ouvrir ces tables. Ce résultat n'est **pas** une recette HTTP avec trois comptes réels.
- 196 server functions marketplace inventoriées statiquement dans [server-functions.json](security-rls-audit-20261015/server-functions.json), avec fichiers/lignes, présence du middleware, extraits des gardes et empreinte. Le corps des helpers et des RPC d'autorisation ci-dessous a aussi été relu. Il ne s'agit pas d'un test d'intrusion exhaustif de tout le moteur Métré ou de tous ses endpoints publics.
- Le test local de la faille photos utilise les vraies fonctions de validation/extraction/signature et un client Storage simulé. **Zéro appel réseau**, objet fictif, aucun secret ou contenu d'un tiers. La chaîne HTTP complète avec deux comptes et un fichier réel n'a pas été exécutée.

## Constats et correctifs proposés (aucun appliqué)

### P1 — Référence de photo non liée à la session avant signature

**Preuves :** [`src/build/engine/validation.ts:126`](../src/build/engine/validation.ts#L126) ne vérifie que le MIME, la taille et le nombre de photos ; il ne vérifie pas storagePath. [`src/routes/api/public/build-runtime.ts:397`](../src/routes/api/public/build-runtime.ts#L397) valide les champs visibles puis enregistre finalAnswers ; les réponses supplémentaires ne sont pas rejetées dans la boucle de soumission (contrairement à la sauvegarde intermédiaire). [`src/build/engine/visitorSummary.ts:41`](../src/build/engine/visitorSummary.ts#L41) parcourt toutes les valeurs, même celles d'un champ inconnu, et collecte storagePath ou photoPath. [`src/marketplace/services/caseRepository.server.ts:329`](../src/marketplace/services/caseRepository.server.ts#L329) signe ensuite ces chemins avec service_role pour 3 600 secondes.

Reproduction locale répétée le 16 octobre sur cette base : une photo synthétique avec storagePath = sessions/00000000-0000-4000-8000-000000000099/private-photo passe validateFieldFormat ; extractPhotoReferences la conserve ; signCasePhotos appelle createSignedUrl sur ce chemin dans build-project-photos. Une valeur supplémentaire {_extra:{photoPath:…}} est aussi extraite comme photo d'inspiration. Le faux client a retourné une URL factice ; aucune signature Supabase réelle n'a été demandée. [Sonde synthétique reproductible](security-rls-audit-20261015/photo-probe.ts) : `npx tsx docs/security-rls-audit-20261015/photo-probe.ts` depuis la racine du dépôt ; elle n'utilise aucune clé et remplace Storage par un objet sans accès réseau.

**Impact :** un projet contrôlé peut faire signer une référence d'une autre session dans les buckets de photos projet/inspiration, si le chemin est déjà connu (par exemple par une ancienne URL). Posséder son propre dossier ou son secret de session ne prouve pas la propriété de chaque photo qu'on y référence. Les chemins sont difficiles à deviner ; aucune possibilité d'énumérer les fichiers, de lire un PDF de facture ou une étiquette par cette primitive n'est démontrée. Le bucket est fixé par le serveur, pas fourni librement par l'attaquant.

**Correctif proposé :** refuser les champs inconnus à la soumission, valider chaque référence contre les objets réellement déposés pour la session vérifiée et le bucket attendu, traiter les images d'inspiration avec leur propre relation de propriété, puis revérifier cette relation avant chaque signature. Ne pas se limiter à une expression régulière ou à l'existence de l'objet. Prévoir des tests A/B : référence de B refusée depuis A, référence inventée refusée, bonne référence acceptée, ancien dossier relu sans nouvelle fuite. Préserver les fichiers historiques ; pas de suppression automatique.

### P2 — ACL SQL et droits de service plus larges que le besoin

Les 40 tables du groupe A du tableau accordent S/I/U/D/T/R/G à anon et authenticated. Leurs politiques ALL USING false WITH CHECK false bloquent les lectures et écritures de lignes, mais pas TRUNCATE ni les droits structurels. Les sondes n'exécutent **aucune écriture**, même pour vérifier un refus. Les deux rôles ont USAGE, mais pas CREATE sur public ; TEMP sur la base est accordé. Aucun chemin permettant à un visiteur d'envoyer du SQL arbitraire ou un TRUNCATE via PostgREST n'a été identifié ici.

**Correctif proposé :** révoquer tous les droits sur les tables marketplace à anon/authenticated, comme pour le groupe B, et corriger les DEFAULT PRIVILEGES du propriétaire concerné. Réduire les droits service_role aux opérations nécessaires ; l'approbation tarifaire n'a pas UPDATE mais conserve notamment DELETE/TRUNCATE. Conserver la RLS et vérifier les endpoints publics via serveur avant une future migration. Ce durcissement n'est pas un correctif au P1 : la clé de service doit continuer à contrôler la propriété des références.

### P3 — Durcir la surface des fonctions et des URL privées

Les 10 SECURITY DEFINER ont search_path=public et ne sont exécutables ni par anon ni par authenticated. Les fonctions déclencheurs dont EXECUTE reste public ne sont pas des RPC métier appelables directement : PostgreSQL exige un contexte trigger. Les deux aides ordinaires publiques marketplace_fr_mainland_postal et marketplace_round_trip_parcel_ok ne lisent aucun dossier et ne modifient rien. Quatre fonctions déclencheurs n'ont pas de search_path explicite (inventaire ci-dessous) ; elles ne sont pas SECURITY DEFINER.

**Correctif proposé :** révoquer l'exécution publique des déclencheurs inutiles et fixer explicitement le search_path des fonctions privilégiées (objets qualifiés et pg_temp maîtrisé), en recette séparée. Les liens signés de documents sont des capacités temporaires : une personne qui reçoit l'URL peut la réutiliser jusqu'à expiration. Une déconnexion ne la révoque pas instantanément ; éviter leur journalisation/partage et ne pas présenter cette limite normale comme une fuite déjà constatée.

## Ce que chaque audience peut lire ou écrire

| Ressource | Visiteur anonyme | Client connecté | Membre d'atelier actif | Autre dossier / autre atelier |
|---|---|---|---|---|
| Tables marketplace par API avec sa propre clé/JWT | Aucune ligne | Aucune ligne | Aucune ligne | Fermé par RLS/ACL ; 160 SELECT, zéro ligne |
| Dossier, adresses et téléphone client via serveur | Pas avec un simple caseId | Son customer_user_id ; rattachement initial par e-mail vérifié ou jeton distinct | Atelier invité : projet/photos/ville ; atelier retenu : coordonnées nécessaires | canViewCase et caseDisclosure vérifiés côté serveur ; pas le seul middleware |
| Prix et proposition | Pas avec un simple caseId | Vue blanche du prix de son dossier ; aucune marge/rémunération atelier | Sa propre offre et rémunération ; pas le prix de vente ni la marge Oppe | Gardes de rôle/propriété et projections différentes |
| Plan d'acheminement et PDF d'étiquette | Aucun accès direct au bucket privé | Plan de son dossier ; seulement PDF aller confirmé et rattaché à la proposition acceptée | Plan d'un dossier qui lui est attribué ; PDF retour approprié | labelUrl vérifie propriétaire/atelier, sens, proposition, statut et chemin ; URL de 60 s |
| Factures Oppe et avoirs | Pas avec un simple ID | Propriétaire du dossier puis document appartenant à sa facture | Facture fournisseur et règlements de son atelier | assertCaseOwner / binder_id puis liaison document-facture |
| Devis et factures des clients propres d'atelier | Seulement avec jeton de paiement valide | Dossier propriétaire, vendeur et contact d'origine liés côté serveur | Atelier dérivé de la session ; IDs filtrés par binder_id | getInvoice/getQuote/getCreditNote et relations contact/ouvrage relus |
| Photos des dossiers | L'accès direct Storage est fermé ; résumé par jeton prévu | Photos de son dossier à l'écran | Photos des dossiers autorisés | **Références internes falsifiables : P1 ci-dessus**, malgré l'accès au dossier contrôlé |
| Vitrines Fine Bindery | Profils publiés d'ateliers approuvés et abonnement admissible ; coordonnées professionnelles publiées et portfolio avec consentement | Même surface publique | Même surface publique ; édition de sa propre vitrine seulement | Publication explicite, pas une ouverture RLS globale |

### Contrôles serveur relus (et exceptions explicites)

requireSupabaseAuth prouve l'identité mais ne donne pas à lui seul accès à un dossier. admin() signifie **client de service**, pas contrôle d'administrateur : [`src/build/services/adminAuth.server.ts:23`](../src/build/services/adminAuth.server.ts#L23). Les contrôles effectifs sont les suivants :

| Famille | Fonctions et preuve | Décision d'autorisation |
|---|---|---|
| Administration, prix, TVA, affectations, remboursements | [`src/build/services/adminAuth.server.ts:13`](../src/build/services/adminAuth.server.ts#L13), [`src/marketplace/services/adminDashboard.data.functions.ts:12`](../src/marketplace/services/adminDashboard.data.functions.ts#L12), [`src/marketplace/services/commercialProposal.data.functions.ts:142`](../src/marketplace/services/commercialProposal.data.functions.ts#L142) | assertAdmin utilise le client du demandeur ; les fonctions Core déléguées vérifient aussi le rôle. |
| Espace client | [`src/marketplace/services/marketplace.data.functions.ts:1495`](../src/marketplace/services/marketplace.data.functions.ts#L1495), [`src/marketplace/services/marketplace.data.functions.ts:1576`](../src/marketplace/services/marketplace.data.functions.ts#L1576), [`src/marketplace/permissions.ts:37`](../src/marketplace/permissions.ts#L37) | Liste bornée par customer_user_id ; détail refusé avant projection ; identité et non e-mail libre. |
| Acceptation/paiement | [`src/marketplace/services/customerProposalAcceptance.server.ts:44`](../src/marketplace/services/customerProposalAcceptance.server.ts#L44), [`src/marketplace/stripe/checkoutSession.server.ts:52`](../src/marketplace/stripe/checkoutSession.server.ts#L52) | Rechargement du propriétaire et proposition courante ; montants/identité pris côté serveur ; aucun paiement exécuté pour cet audit. |
| Atelier, catalogue, contacts, ouvrages, devis, PDFs | [`src/marketplace/services/binderQuotes.server.ts:118`](../src/marketplace/services/binderQuotes.server.ts#L118), [`src/marketplace/services/binderWorks.data.functions.ts:85`](../src/marketplace/services/binderWorks.data.functions.ts#L85), [`src/marketplace/services/binderQuotes.data.functions.ts:508`](../src/marketplace/services/binderQuotes.data.functions.ts#L508) | Atelier dérivé de l'adhésion active, puis binder_id sur la ressource. Un UUID envoyé n'autorise pas l'accès. |
| Conversations et décisions | [`src/marketplace/services/messaging.data.functions.ts:168`](../src/marketplace/services/messaging.data.functions.ts#L168), [`src/marketplace/services/decisions.data.functions.ts:91`](../src/marketplace/services/decisions.data.functions.ts#L91) | resolveViewer puis droits au dossier et audiences persistées ; les filtres d'audience sont appliqués avant réponse. |
| Transport lu uniquement | [`src/marketplace/services/caseLogistics.server.ts:165`](../src/marketplace/services/caseLogistics.server.ts#L165), [`src/marketplace/services/caseLogistics.server.ts:241`](../src/marketplace/services/caseLogistics.server.ts#L241), [`src/marketplace/services/caseLogistics.server.ts:453`](../src/marketplace/services/caseLogistics.server.ts#L453) | Propriétaire ou atelier courant puis contrôle de la pièce. Aucun fichier de transport modifié. |
| Journal atelier | [`src/marketplace/services/workLogistics.data.functions.ts:61`](../src/marketplace/services/workLogistics.data.functions.ts#L61) ; définition SQL marketplace_work_logistics dans le catalogue lu | Le helper transmet l'identité et l'atelier résolu ; le RPC vérifie adhésion active et ouvrage du même atelier avant lecture/écriture. |
| Transition atelier de commande Oppe | [`src/marketplace/services/oppeOrders.data.functions.ts:135`](../src/marketplace/services/oppeOrders.data.functions.ts#L135) | Pas de comparaison dans ce wrapper : le RPC marketplace_advance_oppe_order vérifie l'adhésion de l'acteur à l'affectation active ; EXECUTE service seulement. Ce n'est pas un manque d'autorisation. |
| Factures | [`src/marketplace/services/oppeBilling.data.functions.ts:44`](../src/marketplace/services/oppeBilling.data.functions.ts#L44), [`src/marketplace/services/supplierInvoices.data.functions.ts:237`](../src/marketplace/services/supplierInvoices.data.functions.ts#L237), [`src/marketplace/services/workshopCustomerCase.server.ts:17`](../src/marketplace/services/workshopCustomerCase.server.ts#L17) | Propriétaire du dossier ou binder_id de la facture ; une référence de document est bornée à son contrat/ouvrage/contact. |
| Sans propriété, par conception | [`src/marketplace/services/binderApplications.data.functions.ts:49`](../src/marketplace/services/binderApplications.data.functions.ts#L49), [`src/marketplace/services/referral.public.functions.ts:16`](../src/marketplace/services/referral.public.functions.ts#L16), [`src/marketplace/services/fineBinderyProfile.data.functions.ts:410`](../src/marketplace/services/fineBinderyProfile.data.functions.ts#L410) | Candidature neuve sans lecture d'un tiers ; slug d'atelier publié ; vitrine avec statut/consentement. Aucun accès global à des dossiers privés. |
| Liens sans session | [`src/marketplace/services/marketplace.data.functions.ts:1126`](../src/marketplace/services/marketplace.data.functions.ts#L1126), [`src/marketplace/stripe/workshopOnlinePayment.server.ts:72`](../src/marketplace/stripe/workshopOnlinePayment.server.ts#L72) | Jeton d'invitation ou jeton de paiement validé avant lecture. Le jeton est une autorisation distincte ; une simple authentification n'est pas requise sur ces liens. |

**Bilan sur le middleware sans appartenance :** aucun endpoint de lecture de dossier/PDF tiers n'est confirmé vulnérable par la seule absence d'une comparaison dans son wrapper ; plusieurs délèguent au helper ou au RPC. La faiblesse confirmée est plus bas : les références de photos contenues dans un dossier autorisé ne sont pas liées à leur session avant signature. Les capacités par jeton et les endpoints publics ci-dessus ne sont pas classés comme des IDOR du seul fait qu'ils utilisent admin().

## Inventaire exhaustif des 78 tables marketplace

S = SELECT ; I = INSERT ; U = UPDATE ; D = DELETE ; T = TRUNCATE ; R = REFERENCES ; G = TRIGGER. Les cellules sont des **ACL effectives**, pas des autorisations de lignes. **RLS oui, FORCE non pour toutes ces tables.** service_role a BYPASSRLS ; anon/authenticated n'ont ni superuser ni BYPASSRLS. Aucun droit par colonne supplémentaire n'est présent dans ce relevé.

Groupe A = politique permissive ALL nommée exactement « No direct access to NOM_TABLE », pour anon/authenticated, USING false et WITH CHECK false. Groupe B = aucune politique, donc refus par défaut ; droits anon/authenticated révoqués. Les noms et expressions exacts sont dans [catalog.json](security-rls-audit-20261015/catalog.json).

| Table | RLS | anon | authenticated | service_role | Politique |
|---|---|---|---|---|---|
| marketplace_binder_applications | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_binder_billing_profiles | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_binder_clients | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_binder_commercial_terms | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_binder_credit_note_items | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_binder_credit_notes | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_binder_document_counters | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_binder_invitations | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_binder_invoice_items | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_binder_invoices | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_binder_members | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_binder_operation_photos | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_binder_portfolio | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_binder_price_preferences | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_binder_quote_item_photos | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_binder_quote_items | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_binder_quotes | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_binder_rates | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_binder_service_categories | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_binder_services | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_binder_skills | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_binder_subscriptions | oui | — | — | DISUGTR | B : aucune |
| marketplace_binder_work_counters | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_binder_work_photos | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_binder_works | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_binders | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_case_logistics_plans | oui | — | — | DISUGTR | B : aucune |
| marketplace_case_matches | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_case_payment_circuits | oui | — | — | DISUGTR | B : aucune |
| marketplace_cases | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_commercial_proposal_payments | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_commercial_proposals | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_conversation_reads | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_decisions | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_events | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_external_settlements | oui | — | — | DISUGTR | B : aucune |
| marketplace_intake_missions | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_messages | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_oppe_credit_notes | oui | — | — | DISUGTR | B : aucune |
| marketplace_oppe_disputes | oui | — | — | DISUGTR | B : aucune |
| marketplace_oppe_document_counters | oui | — | — | DISUGTR | B : aucune |
| marketplace_oppe_invoice_items | oui | — | — | DISUGTR | B : aucune |
| marketplace_oppe_invoices | oui | — | — | DISUGTR | B : aucune |
| marketplace_oppe_order_assignments | oui | — | — | DISUGTR | B : aucune |
| marketplace_oppe_orders | oui | — | — | DISUGTR | B : aucune |
| marketplace_oppe_refunds | oui | — | — | DISUGTR | B : aucune |
| marketplace_oppe_supplier_invoices | oui | — | — | DISUGTR | B : aucune |
| marketplace_oppe_supplier_payments | oui | — | — | DISUGTR | B : aucune |
| marketplace_own_agreement_identity_completions | oui | — | — | DISUGTR | B : aucune |
| marketplace_own_client_agreements | oui | — | — | DISUGTR | B : aucune |
| marketplace_pricebook | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_proposal_acceptances | oui | — | — | DISUGTR | B : aucune |
| marketplace_proposal_billing_details | oui | — | — | DISUGTR | B : aucune |
| marketplace_quotes | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_reference_default_prices | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_reference_price_operation_links | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_round_trip_automation | oui | — | — | DISUGTR | B : aucune |
| marketplace_round_trip_automation_changes | oui | — | — | DISUGTR | B : aucune |
| marketplace_round_trip_label_events | oui | — | — | DISUGTR | B : aucune |
| marketplace_round_trip_label_jobs | oui | — | — | DISUGTR | B : aucune |
| marketplace_round_trip_rate_approvals | oui | — | — | DISGTR | B : aucune |
| marketplace_stripe_webhook_events | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_work_items | oui | DISUGTR | DISUGTR | DISUGTR | A : ALL false / false |
| marketplace_work_logistics_events | oui | — | — | DISUGTR | B : aucune |
| marketplace_work_logistics_labels | oui | — | — | DISUGTR | B : aucune |
| marketplace_work_logistics_photos | oui | — | — | DISUGTR | B : aucune |
| marketplace_workshop_billing_documents | oui | — | — | DISUGTR | B : aucune |
| marketplace_workshop_checkout_attempts | oui | — | — | DISUGTR | B : aucune |
| marketplace_workshop_connect_consent_history | oui | — | — | DISUGTR | B : aucune |
| marketplace_workshop_connect_consents | oui | — | — | DISUGTR | B : aucune |
| marketplace_workshop_fee_counters | oui | — | — | DISUGTR | B : aucune |
| marketplace_workshop_fee_documents | oui | — | — | DISUGTR | B : aucune |
| marketplace_workshop_notices | oui | — | — | DISUGTR | B : aucune |
| marketplace_workshop_offer_settings | oui | — | — | DISUGTR | B : aucune |
| marketplace_workshop_online_disputes | oui | — | — | DISUGTR | B : aucune |
| marketplace_workshop_online_payments | oui | — | — | DISUGTR | B : aucune |
| marketplace_workshop_online_refund_attempts | oui | — | — | DISUGTR | B : aucune |
| marketplace_workshop_online_refunds | oui | — | — | DISUGTR | B : aucune |

## Inventaire des 10 buckets et politiques Storage

Tous ont public=false. storage.buckets et storage.objects ont RLS=true, FORCE=false ; les rôles anon/authenticated ont les ACL S/I/U/D, service_role S/I/U/D/T/R/G. buckets n'a aucune politique de lignes. Sur objects, les six politiques permissives « No direct access to … » ont USING (bucket_id = 'BUCKET' AND false) et WITH CHECK identique ; aucune ne donne de droit positif. Les quatre politiques restrictives des buckets financiers/transport ont USING (bucket_id <> 'BUCKET') et WITH CHECK identique ; elles bloquent ces buckets même si une autre politique permissive est ajoutée. Les 160 sondes incluent ces deux tables pour les deux rôles : zéro ligne.

| Bucket | Public | Plafond octets | MIME autorisés | Politique d'objects pour anon/authenticated |
|---|---|---|---|---|
| build-inspiration-photos | non | 8388608 | image/jpeg, image/png, image/webp | ALL permissive false / false |
| build-project-photos | non | 8388608 | image/jpeg, image/png, image/webp, image/heic, image/heif | ALL permissive false / false |
| marketplace-binder-document-logos | non | 2097152 | image/jpeg, image/png | ALL permissive false / false |
| marketplace-binder-photos | non | 8388608 | image/jpeg, image/png, image/webp | ALL permissive false / false |
| marketplace-message-attachments | non | 8388608 | image/jpeg, image/png, image/webp, application/pdf | ALL permissive false / false |
| marketplace-quote-operation-photos | non | 8388608 | image/jpeg, image/png | ALL permissive false / false |
| round-trip-labels-private | non | 5242880 | application/pdf | ALL restrictive : bucket_id <> ce bucket |
| supplier-invoices-private | non | 5242880 | application/pdf | ALL restrictive : bucket_id <> ce bucket |
| work-logistics-private | non | 5242880 | image/jpeg, image/png, image/webp | ALL restrictive : bucket_id <> ce bucket |
| work-transport-labels-private | non | 5242880 | application/pdf | ALL restrictive : bucket_id <> ce bucket |

Aucun téléchargement, dépôt, retrait ou création d'URL signée réelle n'a été effectué. Factures Oppe et devis atelier sont aussi rendus à la demande par les fonctions serveur : leur protection ne se réduit pas à un bucket.

### Fonctions et tables auxiliaires Storage

Complément en lecture seule du **16 octobre à 07:52:35 UTC** : [requête](security-rls-audit-20261015/storage-functions.sql) et [catalogue avec définitions, ACL et politiques](security-rls-audit-20261015/storage-functions.json). Les 19 fonctions du schéma `storage` sont **SECURITY INVOKER**, exécutables par anon, authenticated et service_role. Ces trois rôles ont USAGE sans CREATE sur le schéma. Les fonctions de recherche restent soumises aux droits et à la RLS du demandeur ; aucune n'est une signature privilégiée d'URL.

| Fonctions Storage (inventaire exhaustif ; signatures dans le JSON) | search_path | EXECUTE anon / authenticated / service_role |
|---|---|---|
| allow_any_operation, allow_only_operation, operation | non fixé | oui / oui / oui |
| can_insert_object | non fixé | oui / oui / oui |
| enforce_bucket_lifecycle_service_role, protect_bucket_control_columns | pg_catalog | oui / oui / oui |
| enforce_bucket_name_length, protect_delete, update_updated_at_column | non fixé | oui / oui / oui |
| extension, filename, foldername, get_common_prefix | non fixé | oui / oui / oui |
| get_size_by_bucket, list_multipart_uploads_with_delimiter, list_objects_with_delimiter | non fixé | oui / oui / oui |
| search, search_by_timestamp, search_v2 | non fixé | oui / oui / oui |

Les **8 tables Storage**, y compris les tables auxiliaires, ont la RLS activée sans FORCE. Hors `objects` et `buckets` détaillées ci-dessus : `buckets_analytics` accorde S/I/U/D à anon/authenticated, `buckets_vectors`, `s3_multipart_uploads`, `s3_multipart_uploads_parts` et `vector_indexes` leur accordent SELECT ; toutes ont **zéro politique**, donc aucun droit positif sur les lignes. `migrations` ne leur accorde aucun de ces droits. Le JSON donne aussi les droits service_role. `can_insert_object` tente un INSERT puis lève une exception pour annuler sa sonde ; étant INVOKER, elle ne contourne pas la RLS. Elle n'a pas été exécutée pour cet audit. Les fonctions trigger ne sont pas directement appelables comme des fonctions métier.

## SECURITY DEFINER et fonctions exécutables

Inventaire de 129 fonctions pertinentes ; 10 SECURITY DEFINER. Identifiants de surcharge, propriétaires, ACL brutes, configuration exacte et empreintes des définitions sont dans le catalogue JSON. A = anon ; C = authenticated ; S = service_role. « trigger » signale une fonction non appelable comme RPC métier ordinaire.

| Fonction (arguments d'identité) | SECURITY DEFINER | search_path | EXECUTE | Type |
|---|---|---|---|---|
| has_role(_user_id uuid, _role app_role) | oui | public | S | ordinaire |
| marketplace_accept_own_quote(p_quote uuid, p_binder uuid, p_actor uuid, p_evidence text, p_revision text) | non | public | S | ordinaire |
| marketplace_accept_proposal_as_customer(p_proposal_id uuid, p_customer_user_id uuid, p_terms_version text, p_snapshot_sha256 text, p_ip_address text, p_user_agent text) | non | public | S | ordinaire |
| marketplace_accept_proposal_as_customer_v2(p_proposal_id uuid, p_customer_user_id uuid, p_terms_version text, p_snapshot_sha256 text, p_ip_address text, p_user_agent text, p_billing jsonb) | non | public | S | ordinaire |
| marketplace_accept_workshop_offer(p_case_id uuid, p_binder_id uuid, p_lead_time_days integer, p_actor_user_id uuid) | non | public | S | ordinaire |
| marketplace_advance_oppe_order(p_case_id uuid, p_status text, p_actor_user_id uuid, p_actor_role text, p_reason text) | non | public | S | ordinaire |
| marketplace_archive_connect_consent() | non | public | A, S, C | trigger |
| marketplace_attach_work_transport_label(p_work uuid, p_binder uuid, p_actor uuid, p_event uuid, p_id uuid) | non | public | S | ordinaire |
| marketplace_bind_proposal_to_agreement() | non | public | S | trigger |
| marketplace_binder_create_full_credit_note(p_binder_id uuid, p_invoice_id uuid, p_issue_date date, p_reason text) | non | public | S | ordinaire |
| marketplace_binder_create_invoice_draft(p_binder_id uuid, p_quote_id uuid, p_draft jsonb) | non | public | S | ordinaire |
| marketplace_binder_create_legacy_full_credit_note(p_binder_id uuid, p_invoice_id uuid, p_issue_date date, p_reason text) | non | public | S | ordinaire |
| marketplace_binder_create_partial_credit_note(p_binder_id uuid, p_invoice_id uuid, p_issue_date date, p_reason text, p_request_id uuid, p_lines jsonb) | non | public | S | ordinaire |
| marketplace_binder_create_quote(p_binder_id uuid, p_quote jsonb, p_items jsonb) | non | public | S | ordinaire |
| marketplace_binder_create_work(p_binder_id uuid, p_work jsonb) | non | public | S | ordinaire |
| marketplace_binder_credit_limits(p_binder_id uuid, p_invoice_id uuid) | non | public | S | ordinaire |
| marketplace_binder_credit_notes_immutable() | non | public | A, S, C | trigger |
| marketplace_binder_credit_tax_groups(p_binder_id uuid, p_invoice_id uuid) | non | public | S | ordinaire |
| marketplace_binder_document_is_oppe_order(p_binder uuid, p_work uuid, p_client uuid) | non | public | S | ordinaire |
| marketplace_binder_document_is_own_client(p_binder uuid, p_work uuid, p_client uuid) | non | public | S | ordinaire |
| marketplace_binder_import_case(p_binder_id uuid, p_case_id uuid, p_contact_name text, p_contact_email text, p_contact_phone text, p_work_title text, p_work_description text) | non | public | S | ordinaire |
| marketplace_binder_import_own_case(p_binder_id uuid, p_case_id uuid, p_actor uuid, p_contact_name text, p_contact_email text, p_contact_phone text, p_work_title text, p_work_description text) | non | public | S | ordinaire |
| marketplace_binder_invoice_items_forbid_change() | non | public | A, S, C | trigger |
| marketplace_binder_invoices_forbid_content_change() | non | public | A, S, C | trigger |
| marketplace_binder_invoices_forbid_delete() | non | public | A, S, C | trigger |
| marketplace_binder_issue_invoice(p_binder_id uuid, p_invoice_id uuid, p_legal_mentions jsonb) | non | public | S | ordinaire |
| marketplace_binder_next_document_number(p_binder_id uuid, p_kind text, p_year integer) | non | public | S | ordinaire |
| marketplace_binder_next_work_reference(p_binder_id uuid, p_year integer) | non | public | S | ordinaire |
| marketplace_binder_portfolio_work_same_binder() | non | public | S | trigger |
| marketplace_binder_quotes_work_same_binder() | non | public | S | trigger |
| marketplace_binder_update_invoice_draft(p_binder_id uuid, p_invoice_id uuid, p_draft jsonb) | non | public | S | ordinaire |
| marketplace_binder_update_quote(p_binder_id uuid, p_quote_id uuid, p_quote jsonb, p_items jsonb) | non | public | S | ordinaire |
| marketplace_binder_works_same_binder() | non | public | S | trigger |
| marketplace_case_attachment_requires_open() | non | public | S | trigger |
| marketplace_cases_forbid_brand_change() | non | non fixé | A, S, C | trigger |
| marketplace_cases_guard_engagement() | non | public | A, S, C | trigger |
| marketplace_claim_webhook_event(p_id text, p_type text, p_payload jsonb, p_stale_after_seconds integer) | non | public | S | ordinaire |
| marketplace_claim_workshop_notice(p_id text) | non | public | S | ordinaire |
| marketplace_close_case_without_follow_up(p_case_id uuid, p_actor_user_id uuid, p_reason text, p_expected_status text) | non | public | S | ordinaire |
| marketplace_commercial_proposals_forbid_change_after_acceptance() | non | non fixé | A, S, C | trigger |
| marketplace_complete_own_agreement_identity(p_quote uuid, p_binder uuid, p_actor uuid, p_attestation text) | non | public | S | ordinaire |
| marketplace_dossier_ids_for_verified_email(p_email text) | non | public | S | ordinaire |
| marketplace_enforce_match_ceiling() | oui | public | S | trigger |
| marketplace_external_balance_guard() | non | public | A, S, C | trigger |
| marketplace_external_member(p_binder uuid, p_actor uuid) | non | public | S | ordinaire |
| marketplace_external_settlement_state(p_invoice uuid, p_binder uuid, p_actor uuid) | non | public | S | ordinaire |
| marketplace_fee_document_immutable() | non | public | A, S, C | trigger |
| marketplace_forbid_acceptance_changes() | non | non fixé | S | trigger |
| marketplace_forbid_oppe_document_change() | non | non fixé | S | trigger |
| marketplace_forbid_supplier_payment_change() | non | non fixé | S | trigger |
| marketplace_fr_mainland_postal(p_country text, p_code text) | non | public | A, S, C | ordinaire |
| marketplace_freeze_binder_provenance() | non | public | S | trigger |
| marketplace_freeze_proposal_agreement() | non | public | S | trigger |
| marketplace_freeze_supplier_invoice_terms() | non | non fixé | S | trigger |
| marketplace_freeze_workshop_agreement() | non | public | S | trigger |
| marketplace_guard_binder_invoice_circuit() | non | public | S | trigger |
| marketplace_guard_binder_quote_circuit() | non | public | S | trigger |
| marketplace_guard_oppe_sale_origin() | non | public | S | trigger |
| marketplace_guard_oppe_tax_validation() | non | public | S | trigger |
| marketplace_guard_retired_circuits() | non | public | S | trigger |
| marketplace_ingest_dossier() | oui | public | S | trigger |
| marketplace_ingest_missing_cases() | oui | public | S | ordinaire |
| marketplace_init_workshop_subscription() | non | public | A, S, C | trigger |
| marketplace_invoice_agreed_amount() | non | public | A, S, C | trigger |
| marketplace_invoice_payment_snapshot() | non | public | A, S, C | trigger |
| marketplace_issue_oppe_credit_note(p_invoice_id uuid, p_amount_ttc_cents integer, p_reason text) | non | public | S | ordinaire |
| marketplace_issue_oppe_invoice(p_proposal_id uuid, p_seller jsonb, p_customer jsonb, p_payment jsonb, p_service_label text) | non | public | S | ordinaire |
| marketplace_issue_workshop_fee_documents(p_payment_id uuid, p_fee_id text, p_fee_amount integer, p_fee_refunded integer, p_brand text, p_seller jsonb, p_customer jsonb) | non | public | S | ordinaire |
| marketplace_lock_commercial_origin() | non | public | S | trigger |
| marketplace_lock_payment_circuit() | non | public | A, S, C | trigger |
| marketplace_logistics_immutable() | non | non fixé | A, S, C | trigger |
| marketplace_logistics_plan_guard() | non | public | A, S, C | trigger |
| marketplace_mark_proposal_paid(p_proposal_id uuid, p_payment_intent_id text, p_invoice_id text, p_amount_cents integer, p_currency text) | non | public | S | ordinaire |
| marketplace_messages_route_audience() | non | public | A, S, C | trigger |
| marketplace_next_oppe_number(p_series text) | non | public | S | ordinaire |
| marketplace_norm_identifier(p_value text) | non | public | S | ordinaire |
| marketplace_open_oppe_order(p_proposal_id uuid, p_paid_at timestamp with time zone) | non | public | S | ordinaire |
| marketplace_own_agreement_identity(p_quote uuid, p_binder uuid, p_actor uuid) | non | public | S | ordinaire |
| marketplace_own_contract(p_quote uuid, p_binder uuid, p_actor uuid) | non | public | S | ordinaire |
| marketplace_own_quote_eligible(p_quote uuid, p_binder uuid) | non | public | S | ordinaire |
| marketplace_preserve_collected_fee_terms() | non | public | A, S, C | trigger |
| marketplace_preserve_confirmed_online_payment() | non | public | A, S, C | trigger |
| marketplace_prevent_mixed_settlement() | non | public | A, S, C | trigger |
| marketplace_project_online_invoice_balance() | non | public | A, S, C | trigger |
| marketplace_quote_payment_snapshot() | non | public | A, S, C | trigger |
| marketplace_reassign_oppe_order(p_case_id uuid, p_new_binder_id uuid, p_reason text, p_actor_user_id uuid) | non | public | S | ordinaire |
| marketplace_record_case_completion() | oui | public | S | trigger |
| marketplace_record_external_settlement(p_id uuid, p_invoice uuid, p_binder uuid, p_actor uuid, p_kind text, p_amount integer, p_evidence text) | non | public | S | ordinaire |
| marketplace_record_supplier_payment(p_invoice uuid, p_paid_on date, p_amount integer, p_reference text, p_actor uuid) | non | public | S | ordinaire |
| marketplace_release_workshop_payment_checkout(p_payment_id uuid, p_session_id text, p_intent_id text, p_reason text) | non | public | S | ordinaire |
| marketplace_release_workshop_subscription_checkout(p_binder_id uuid, p_session_id text, p_reason text) | non | public | S | ordinaire |
| marketplace_repair_workshop_referral_matches() | non | public | S | ordinaire |
| marketplace_require_customer_acceptance() | non | public | S | trigger |
| marketplace_require_own_agreement() | non | public | A, S, C | trigger |
| marketplace_require_portfolio_subscription() | non | public | A, S, C | trigger |
| marketplace_require_profile_subscription() | non | public | A, S, C | trigger |
| marketplace_require_workshop_subscription() | non | public | A, S, C | trigger |
| marketplace_reserve_round_trip_label(p_case uuid, p_direction text, p_outbound_address_sha256 text, p_return_address_sha256 text) | non | public | S | ordinaire |
| marketplace_reserve_round_trip_label_manual(p_case uuid, p_direction text, p_actor uuid, p_replace boolean) | non | public | S | ordinaire |
| marketplace_reserve_workshop_checkout(p_binder_id uuid, p_user_id uuid, p_terms_version text) | non | public | S | ordinaire |
| marketplace_reserve_workshop_online_payment(p_binder_id uuid, p_invoice_id uuid, p_token_hash text, p_expires_at timestamp with time zone) | non | public | S | ordinaire |
| marketplace_reserve_workshop_payment_checkout(p_payment_id uuid) | non | public | S | ordinaire |
| marketplace_reserve_workshop_refund(p_binder_id uuid, p_payment_id uuid, p_credit_note_id uuid) | non | public | S | ordinaire |
| marketplace_respond_to_offer(p_case_id uuid, p_binder_id uuid, p_accept boolean, p_reason_code text, p_reason_detail text, p_actor_user_id uuid) | oui | public | S | ordinaire |
| marketplace_retry_workshop_refund(p_binder_id uuid, p_credit_note_id uuid, p_refund_id text, p_status text) | non | public | S | ordinaire |
| marketplace_review_supplier_invoice(p_invoice uuid, p_decision text, p_reason text, p_actor uuid) | non | public | S | ordinaire |
| marketplace_round_trip_label_transition(p_job uuid, p_kind text, p_provider_event_id text, p_details jsonb) | non | public | S | ordinaire |
| marketplace_round_trip_leg_context(p_case uuid, p_direction text) | non | public | S | ordinaire |
| marketplace_round_trip_offer_guard() | non | public | A, S, C | trigger |
| marketplace_round_trip_parcel_ok(p_weight integer, p_a integer, p_b integer, p_c integer) | non | public | A, S, C | ordinaire |
| marketplace_round_trip_plan_block(p_plan marketplace_case_logistics_plans, p_brand text, p_selected_binder uuid) | non | public | S | ordinaire |
| marketplace_round_trip_return_ready(p_case uuid, p_binder uuid, p_actor uuid, p_weight integer, p_length integer, p_width integer, p_height integer) | non | public | S | ordinaire |
| marketplace_seed_payment_circuit() | non | public | A, S, C | trigger |
| marketplace_select_binder_offer(p_case_id uuid, p_binder_id uuid, p_actor_user_id uuid) | oui | public | S | ordinaire |
| marketplace_seller_entity(p_issuer jsonb) | non | public | S | ordinaire |
| marketplace_set_case_payment_circuit(p_case_id uuid, p_circuit text, p_event_id uuid, p_actor uuid, p_notes text) | non | public | S | ordinaire |
| marketplace_set_round_trip_automation(p_actor uuid, p_enabled boolean, p_evidence jsonb) | non | public | S | ordinaire |
| marketplace_settlement_immutable() | non | non fixé | A, S, C | trigger |
| marketplace_snapshot_payment_circuit() | non | public | A, S, C | trigger |
| marketplace_snapshot_workshop_fee_basis() | non | public | A, S, C | trigger |
| marketplace_submit_supplier_invoice(p_case uuid, p_binder uuid, p_source text, p_number text, p_issue_date date, p_vat_regime text, p_vat_rate_bps integer, p_vat_mention text, p_document_path text, p_actor uuid) | non | public | S | ordinaire |
| marketplace_sync_workshop_subscription(p_binder_id uuid, p_snapshot jsonb, p_event_created bigint) | non | public | S | ordinaire |
| marketplace_validate_pricing(p_case_id uuid, p_customer_price_cents integer, p_binder_payout_cents integer, p_price_includes text[], p_minimum_margin_bps integer, p_minimum_margin_cents integer, p_actor_user_id uuid) | oui | public | S | ordinaire |
| marketplace_validate_workshop_transport() | non | public | A, S, C | trigger |
| marketplace_validate_workshop_transport_plan() | non | public | A, S, C | trigger |
| marketplace_work_logistics(p_work uuid, p_binder uuid, p_actor uuid, p_action text, p_data jsonb) | non | public | S | ordinaire |
| marketplace_workshop_can_create(p_binder_id uuid) | non | public | S | ordinaire |
| provision_owner_workspace(_user_id uuid, _email text, _workspace_name text) | oui | public | S | ordinaire |
| publish_workspace_onboarding(p_workspace_id uuid, p_playbook_id uuid, p_validated_draft_schema jsonb, p_published_by uuid, p_mission_name text, p_onboarding_id uuid) | oui | public | S | ordinaire |

Les SECURITY DEFINER concernent : has_role, marketplace_enforce_match_ceiling, marketplace_ingest_dossier, marketplace_ingest_missing_cases, marketplace_record_case_completion, marketplace_respond_to_offer, marketplace_select_binder_offer, marketplace_validate_pricing, provision_owner_workspace et publish_workspace_onboarding. Le rôle service est le seul des trois à pouvoir les exécuter. Les fonctions métier ordinaires, y compris les réservations d'étiquettes, sont également fermées à A/C, sauf les deux aides pures mentionnées plus haut.

## Validation et suite

- Requêtes réelles READ ONLY : catalogue, 160 SELECT par rôle, schémas et privilèges ; aucun contenu client extrait. [Résultats des 160 sondes et privilèges de schéma](security-rls-audit-20261015/role-probes.json).
- Test synthétique photos : validation accepte le chemin tiers, extraction le conserve et signataire simulé appelé avec ce chemin ; URL factice, zéro réseau. Preuve privée : outputs/mareliure-security-20261016/photo-probe.log.
- Les résultats des tests de dépôt, TypeScript et CI sont consignés dans le bloc daté de docs/CODEX_HANDOFF.md ; ils ne constituent pas une recette d'identité en production.
- Prévoir un correctif distinct pour P1 et un durcissement SQL distinct pour P2/P3 ; ne pas modifier les fichiers de transport réservés à Claude depuis cette PR. Aucune nouvelle application de migration n'est effectuée par cet audit.
