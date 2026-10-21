# Revue indépendante Sendcloud P1 — 16 octobre 2026

## Actualisation du 20 octobre 2026, après-midi — brief n° 6

Base intégrée dans la branche de cette PR : `origin/main f4bb8d0c81e893d44c803a6b87420551a1220ad8` (#150 incluse). Les conflits de handoff ont été résolus en conservant les deux blocs. Aucun rapport historique supprimé, aucune fusion de PR ni déploiement.

Le script de 15 caractérisations a été converti en 15 tests de non-régression. Les faux fournisseurs vérifient désormais la référence et utilisent le colis rattaché ; le magasin simule aussi le retrait Storage. Les attentes corrigées portent sur les deux constats, le refus et la relecture d’annulation, la référence étrangère, le PDF retiré, le fallback webhook et l’annulation v2. Commande : `npm run test:sendcloud-review`.

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


## Conclusion

Les PR [#128](https://github.com/antoineferriere2-star/mareliure/pull/128) et [#129](https://github.com/antoineferriere2-star/mareliure/pull/129) corrigent le renouvellement des tarifs et donnent des actions de résolution à l'administration. **Elles ne ferment pas tous les cas limites de l'adoption et du rapprochement.** Trois points restent prioritaires : réconcilier le statut lors de l'adoption, vérifier le lien entre le colis retrouvé et la réservation, et annuler le colis réellement adopté plutôt que rechercher seulement une référence d'achat.

Les 15 tests de cette revue passent : ce sont des **tests de caractérisation**, dont certains affirment un comportement incorrect reproduit. « Tests verts » ne signifie donc pas « transport validé ». Aucun achat, appel Sendcloud réel, paiement, compte, e-mail, correctif, fusion ou déploiement n'a été effectué.

Le workflow dédié s'exécute pour les changements de cette suite/configuration ou sur demande manuelle. Il n'est pas ajouté aux contrôles de chaque changement de transport : les assertions décrivant un défaut devront être actualisées lors de son correctif, et ne doivent pas imposer de conserver ce défaut.

## Sources et méthode

- #128 : tête `dce423f3dd5efaf4ef1746f5b8baa6e8347c2cd8`, fusion `ad8d88389ca48eaccfe7da6867b45240fe410096`.
- #129 : tête `ea88522a4187af1941cbc4a50cd2fcf45592ad1b`, fusion `4e56fa6f91f5758d4ae418a59b6236128c86cc9e`.
- Branche de revue créée depuis `origin/main 8737677a30a65a33611346c33087383fa26416d4`. Les changements ultérieurs #130 (libellés admin) et #131 (alerte d'étiquette inutilisable) sont identifiés ; ils ne réparent pas les cas d'adoption ci-dessous. Le callback d'alerte #131 est absent des dépendances de ces essais et aucun e-mail n'est envoyé.
- Relecture des vraies migrations `20261015100000_round_trip_rate_versions.sql` et `20261016100000_round_trip_label_resolution.sql`, ainsi que des migrations fondatrices du 1er et du 2 octobre. Les deux migrations récentes avaient déjà été appliquées séparément par Codex ; aucun SQL n'a été rejoué en production pour cette revue.
- Preuves SQL : [sélection de la dernière revue tarifaire et contrôles de réservation](../supabase/migrations/20261015100000_round_trip_rate_versions.sql#L45) ; [verrou du job et garde du constat d'absence](../supabase/migrations/20261016100000_round_trip_label_resolution.sql#L18). Les nouveaux tests les chargent sans les modifier.
- [Suite reproductible](../scripts/audits/sendcloudP1Review.test.ts) : `npm run test:sendcloud-review`. Elle utilise PGlite, le vrai fixture `roundTripTestDb.fixture.ts`, les quatre vraies migrations et les vraies fonctions d'orchestration/webhook. Fournisseur, PDF, événements et signature HMAC sont synthétiques. La seule utilisation de l'adaptateur HTTP fournit explicitement un `fetchImpl` simulé ; aucune clé réelle.
- PGlite est un moteur PostgreSQL dans un seul processus. `Promise.allSettled` et des barrières contrôlent les lectures et l'ordre des effets applicatifs ; cela **ne prouve pas** une concurrence entre deux backends PostgreSQL ni les verrous d'une base Supabase hébergée. Une recette multi-connexion sur copie native reste recommandée pour ce dernier point.

## Résultats des 15 essais

| Essai | Résultat observé |
|---|---|
| Deux réservations mises en concurrence dans PGlite | Même identifiant, une seule réservation. Limite mono-moteur rappelée ci-dessus. |
| Ancien tarif valide, dernière revue expirée | Nouvel achat refusé ; pas de retour silencieux à l'ancien tarif. |
| Reprise après expiration du tarif | Même réservation, aucun nouveau tarif exigé pour reprendre. |
| Poids retour modifié / dimensions réorientées | Poids différent refusé ; mêmes mesures triées acceptées. |
| Empreinte d'adresse modifiée | Refus de nouvel achat. |
| Deux constats lisent « ambigu » avant leur écriture | Un succès et un rejet ; un seul événement `purchase_failed`, état final `failed`. |
| Second constat après le premier | `review_required/job_failed`, aucune seconde transition. |
| Preuve courte ou acteur vide | Refus SQL, état `ambiguous` conservé. |
| Adoption, puis webhook annulé, puis doublon | `cancelled` ; un seul événement de suivi pour la même clé fournisseur. |
| Webhook annulé avant validation de l'adoption | Webhook acquitté `ignored:true` ; adoption termine **confirmed malgré le statut 2000 relu**. Problème P1-A. |
| Adoption d'un identifiant quelconque lisible | Acceptée ; aucune comparaison de référence de réservation n'est possible dans le contrat actuel. P1-B. |
| Constat d'absence gagnant pendant le téléchargement d'adoption | Confirmation SQL refusée ; état `failed`, mais PDF privé déjà déposé. P2-D. |
| Annulation en file, puis statut annulé relu | État reste `confirmed` pendant la file ; webhook mène à `cancelled`. Remboursement toujours `null`. |
| Recherche par référence illisible, lecture par identifiant disponible | HTTP 503 ; lecture par identifiant non tentée, état encore `confirmed`. P2-E. |
| Colis adopté absent de la recherche v3 par référence | `shipment_not_found` ; aucun appel d'annulation du colis par son identifiant. P1-C. |

## P1-A — L'annulation reçue avant rattachement peut être perdue

Preuves : [handleSendcloudWebhook](../src/marketplace/shipping/sendcloudWebhook.ts#L47) cherche le job par `provider_label_id` et acquitte immédiatement un colis sans rattachement avec HTTP 200. [adoptLeg et persist](../src/marketplace/shipping/labelOrchestrator.ts#L117) téléchargent, stockent et confirment le PDF sans utiliser `ProviderLabel.status` pour refuser une étiquette déjà annulée ou rapprocher ce statut.

Interleaving contrôlé : l'adoption a déjà relu un colis synthétique au statut `2000` ; le téléchargement est suspendu. Le webhook du même colis arrive avant la transition SQL, ne trouve pas de rattachement et retourne `ignored:true`. Le téléchargement reprend et `label_confirmed` mène à `confirmed`. Aucun événement non acquitté ne garantit un rattrapage ultérieur. Le test inverse, adoption puis webhook, aboutit bien à `cancelled`.

**Impact :** une étiquette annulée peut redevenir présentée comme utilisable. La nouvelle projection des annulations fonctionne après rattachement, mais ne rattrape pas systématiquement le premier événement.

**Correctif proposé, non appliqué :** réconcilier le statut pendant l'adoption et après l'association durable ; conserver ou rapprocher les événements arrivés avant rattachement ; refuser la mise à disposition d'un PDF dont le fournisseur atteste déjà l'inutilisabilité. Garder la distinction annulation/remboursement et livraison/réception physique.

## P1-B — Lire un colis par identifiant ne prouve pas qu'il appartient à cette réservation

[operatorAdoptLabel](../src/marketplace/services/roundTripAutomation.server.ts#L178) vérifie que le job appartient au dossier et est automatique. La server function [adoptRoundTripLabel](../src/marketplace/services/caseLogistics.data.functions.ts#L217) exige bien un admin. En revanche, `adoptLeg` accepte tout objet retourné par `findByLabelId` ; le contrat [ProviderLabel](../src/marketplace/shipping/labelProvider.ts#L30) ne transporte ni référence externe, ni sens, ni empreinte des adresses/colis qui permettraient de comparer le colis au job.

L'essai confirme qu'un identifiant lisible arbitraire est enregistré sur la réservation. Il ne démontre pas qu'un client ou un atelier peut appeler l'action administrative, ni qu'un fichier réel d'un autre dossier a été consulté. Le défaut concerne le contrôle d'une erreur de rapprochement opérateur, potentiellement porteuse d'un mauvais PDF ou de coordonnées d'un autre envoi.

**Correctif proposé :** relire et comparer les identifiants de référence et le trajet attendu ; pour une étiquette créée hors circuit sans référence exploitable, prévoir une adoption manuelle explicite avec les preuves minimales vérifiables et la traçabilité de la décision, plutôt qu'assimiler « colis lisible » à « colis de cette réservation ».

## P1-C — L'annulation ne cible pas toujours le colis adopté

[cancelLeg](../src/marketplace/shipping/labelOrchestrator.ts#L92) passe l'identifiant du job à `provider.cancel`. [L'adaptateur Sendcloud](../src/marketplace/shipping/sendcloudProvider.server.ts#L205) recherche uniquement `/shipments?external_reference_id=JOB`, puis annule le shipment obtenu. Il n'utilise pas le `provider_label_id` conservé par l'adoption ni une branche d'annulation v2/Retour.

Le test de l'adaptateur fournit une recherche v3 vide et constate `refused/shipment_not_found`, un seul GET, sans POST d'annulation. Les méthodes Retour restent fermées à l'achat automatique ; le problème concerne aussi une adoption externe dont la référence ne correspond pas au job. L'absence de colis dans cette recherche ne prouve pas son absence chez Sendcloud.

**Correctif proposé :** résoudre et annuler le colis effectivement associé au job, avec la méthode/API appropriée, puis relire sa réponse. Conserver les états `queued`, `refused` et `pending` distincts et ne jamais présumer d'un remboursement. Aucune annulation réelle n'a été tentée pendant cette revue.

## P2-D — Double constat et adoption contre constat : données protégées, reprise imparfaite

La migration du 16 octobre verrouille le job avec `FOR UPDATE`, n'autorise la nouvelle sortie que depuis `ambiguous` avec preuve et acteur, puis inscrit état et événement dans la même transaction. Les tests confirment qu'une lecture applicative préalable ne permet pas deux sorties SQL. Une seconde demande concurrente peut toutefois lever `label_transition_invalid:failed:purchase_failed`, au lieu de relire un résultat idempotent ; elle ne produit pas une seconde ligne.

Si le constat gagne pendant la lecture du PDF d'adoption, la confirmation est refusée et l'état reste `failed`, mais le dépôt privé précède la transition : un objet peut rester sans adoption réussie. Rien ici n'atteste qu'un achat fournisseur en cours est effectivement annulé par ce constat. Une preuve écrite est un constat administratif, pas une recherche atomique chez Sendcloud.

**Correctif proposé :** relire et présenter explicitement l'issue concurrente ; identifier les tentatives de résolution de manière idempotente ; définir le traitement des objets privés et d'une réponse fournisseur tardive, sans supprimer les preuves ni relancer aveuglément un achat.

## P2-E — La relecture par identifiant n'est pas utilisée après `unknown`

Le webhook tente `findByLabelId` seulement lorsque `findByReference` retourne `null`. Une réponse `unknown` mène directement à 503, même lorsque le colis est lisible par son identifiant. Le test maintient volontairement cette distinction : la lecture par identifiant n'est jamais appelée.

**Correctif proposé :** utiliser le colis déjà rapproché quand la lecture par identifiant est fiable, en conservant les vérifications de fournisseur et d'identifiant. Une lecture réellement impossible doit rester une erreur reprise, jamais une annulation présumée. Ce test synthétique ne signifie pas que tous les retours réels produisent `unknown` dans la recherche v3.

## Protections conservées et limites de validation

La sélection du tarif récent, l'expiration pour un nouvel achat, les empreintes d'adresse et les mesures du colis sont vérifiées. Les transitions SQL empêchent une confirmation après un constat d'absence déjà validé. La répétition d'une notification de suivi ne duplique pas sa ligne, et une annulation en file n'invente ni annulation effective ni remboursement.

Les essais ne prouvent pas : l'absence de doublon d'achat face à une vraie course réseau, une annulation Retour réelle, la réception d'une alerte e-mail, la disponibilité d'un PDF fournisseur réel, une expédition physique ou la couverture d'assurance. Aucun statut transporteur n'est présenté ici comme une réception physique du livre.

Les fichiers de transport et les migrations ne sont pas modifiés dans cette branche. La suite est indépendante et reproductible ; les résultats applicatifs généraux et la CI sont consignés dans le bloc daté de `docs/CODEX_HANDOFF.md`.
