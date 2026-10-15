# Audit Sendcloud — 15 octobre 2026

## Périmètre et preuves

Lecture du code et des migrations sur `main` **fb32fe1a8f5438baa307441f9ddb613ab85d4da6**, qui inclut déjà #121, #122 et #123 (contrairement au brief, où #123 était encore ouverte). Branche indépendante `docs/sendcloud-audit-20261015`. Aucun correctif applicatif dans cette PR ; les propositions ci-dessous sont destinées à Claude Code.

Aucun achat, appel de création/annulation fournisseur, paiement, changement de compte, écriture SQL distante, modification de configuration ou déploiement. Les essais SQL utilisent PGlite et les migrations réelles, sur le schéma minimal des fixtures du dépôt ; ils ne valident pas tout le schéma Supabase hébergé. Le fournisseur des essais webhook est simulé.

Les faits du brief — verrou ouvert par le propriétaire, moyen de paiement ajouté, suivis 73095350 / 73095353, annulations HTTP 202, deux notifications de 13:58, refus Chrono 2Shop Retour — sont des **faits rapportés par le propriétaire**, pas des opérations reproduites ici. Le code de réponse de ces deux notifications et leur association à un job du site ne sont pas établis par cet audit. « Sans exception » n'est pas une preuve de 2xx ni de rapprochement : le handler ignore aussi les colis non rattachés en 200.

## Conclusion

**Oui, le parcours peut rester bloqué après paiement sans qu'une action de reprise utilisable soit proposée.** L'interface affiche des états et un journal ; elle n'est donc pas totalement silencieuse. Mais elle conserve parfois un bouton d'achat qui ne peut pas résoudre le blocage, ou une simple possibilité de note. Priorités : renouvellement des tarifs, résolution contrôlée des achats ambigus, annulation et rapprochement des statuts fournisseur.

## 1. Parcours et machine d'états

Sources : `src/marketplace/shipping/labelOrchestrator.ts`, `src/marketplace/services/roundTripAutomation.server.ts`, `src/marketplace/services/caseLogistics.server.ts`, `src/marketplace/pages/admin/OperatorLogisticsPanel.tsx`, migrations `20261001160000_book_round_trip_shipping.sql` et **`20261002090000_book_round_trip_journey.sql`**. Cette dernière remplace les fonctions de réservation/transition ; ne pas conclure à partir de la première migration seule.

### Avant l'achat

1. Le client soumet un plan (adresses, colis, nature et valeur du livre). L'atelier retenu accepte la réception de cette version.
2. L'offre `book_round_trip_fr` est liée à cette version. Sa présentation puis son acceptation figent le contenu du plan ; l'accord atelier n'est pas modifiable après ce verrouillage.
3. Le paiement Stripe intégral de revente doit être effectivement constaté. Un règlement déclaré à l'atelier ne suffit pas.
4. L'admin interroge les méthodes et saisit un tarif pour les deux sens, avec références de devis, couverture, coût économique et échéance. L'ouverture générale ne déclenche aucun achat en arrière-plan : l'admin doit cliquer pour chaque sens.
5. Le retour exige en plus réception physique dans le journal atelier, retour déclaré prêt avec mesures et adresse reconfirmée par le client. Ce sont des interventions normales des intéressés, pas des blocages anormaux.

### Tous les états d'un job

| État | Évolution prévue | Action visible et limite |
| --- | --- | --- |
| `claimed`, automatique, premier appel | `request_started`, puis confirmation, échec net ou ambiguïté | Bouton d'achat. Une tentative interrompue devient ambiguë à la reprise ; recherche fournisseur avant de créer à nouveau. |
| `claimed`, automatique, 401/403/429 (`not_created`) | Note puis nouvelle tentative avec même référence | Reprise explicite par le bouton, après correction de la cause. Aucun rachat autonome. |
| `claimed`, manuel | PDF privé puis `label_confirmed`, ou `purchase_failed` si aucun achat | Dépôt manuel et « Abandonner ». Reprise prévue. |
| `ambiguous`, ordinaire, fournisseur lisible | Recherche par référence ; si retrouvé, stockage et confirmation ; si absence, demande avec même référence | Reprise possible tant que les gardes de réservation et le tarif restent valides. |
| `ambiguous`, fournisseur illisible | Reste `ambiguous`, résultat `pending/provider_unreadable` | Bouton et notes seulement ; pas de résolution manuelle disponible. Voir P1-2. |
| `ambiguous`, PDF illisible, stockage indisponible ou objet privé incompatible | Tentative de relecture et de stockage ; reste ambigu tant que la cause persiste | Un PDF identique est accepté ; des octets différents au même chemin sont refusés. Aucune adoption manuelle du job dans l'interface. |
| `ambiguous`, méthode Sendcloud « Retour » | `findByReference` avec l'indice de méthode retourne volontairement `unknown` | **Aucune issue accessible** même après découverte du colis dans le panneau. Méthodes désactivées actuellement ; blocage latent avant réouverture. |
| `confirmed` | Réponse existante, pas de second achat ; suivi et frais consignables ; annulation constatée → `cancelled` | Étiquette téléchargeable. Un statut transporteur annulé/refusé ne fait pas changer cet état. |
| `failed` | Pas de reprise automatique | Dépôt manuel avec confirmation de remplacement. Sortie visible et intentionnelle, pas de remise à zéro automatique. |
| `cancelled` | Pas de reprise automatique | Même sortie manuelle avec confirmation et vérification des frais précédents. |

`request_started`, `response_ambiguous`, `tracking_update`, `cancellation_requested`, `unused`, etc. sont des **événements**, pas tous des états supplémentaires. `pending` et `review_required` sont des résultats de l'orchestrateur. Une demande d'annulation en file reste `confirmed`.

### Blocages transversaux / sans issue depuis l'interface

**P1-1 — Tarif expiré ou à corriger impossible à renouveler.**

- La table impose `UNIQUE(case_id, proposal_id)`. `recordRateApproval` fait uniquement `insert`, sans révision, nouvelle version ni mise à jour ; la migration du parcours retire le droit UPDATE du service sur les tarifs.
- `marketplace_reserve_round_trip_label` contrôle `valid_until` **avant** de retourner un job existant. Après expiration, même reprendre un aller ambigu est interdit ; le retour peut survenir plusieurs semaines après le tarif initial (le panneau propose sept jours par défaut).
- Le formulaire « Enregistrer le tarif revu » reste présent, mais une seconde saisie produit `invalid_input` sur la contrainte unique. Pas de renouvellement utilisable. L'admin ne voit pas non plus le tarif courant et son échéance dans `operatorLogistics`.
- Le circuit manuel reste possible si aucun job actif ne le bloque. Il ne résout pas un job automatique ambigu.
- Essai local : expiration puis reprise refusée `current_rate_approval_required` ; deuxième INSERT refusé pour clé dupliquée.
- Correctif à concevoir : tarifs versionnés et immuables ; afficher le tarif courant et son échéance, autoriser une nouvelle approbation explicite pour le prochain achat, et permettre la récupération d'une étiquette déjà achetée sans exiger un nouveau devis. Garder les références de coût de chaque achat historique.

**P1-2 — Ambiguïté sans résolution opérateur.**

- La transition SQL interdit `purchase_failed` et `cancelled` depuis `ambiguous`. `operator_note` ne change jamais le statut.
- La réservation manuelle retourne `review_required` en présence d'un job `claimed` automatique ou `ambiguous`, même avec `p_replace=true`. Le panneau masque alors le dépôt manuel.
- `label_confirmed` permettrait de résoudre le job en interne avec preuves/PDF, mais l'API opérateur n'offre pas cette adoption. Une disparition définitive, un refus après ambiguïté ou une étiquette Retour retrouvée ne sont donc pas résolubles depuis le site.
- Pour les méthodes Retour, `return_id` n'est pas conservé. En cas de réponse perdue ou de relecture v2 impossible, la référence du colis peut aussi être perdue ; en cas d'échec de stockage, son identifiant reste dans un événement, pas dans la colonne de rapprochement webhook.
- Essai local : les deux clôtures SQL sont refusées et le remplacement manuel reste `review_required`.
- Correctif : procédure admin authentifiée d'adoption d'une étiquette retrouvée (identifiant fournisseur vérifié, même dossier/sens, PDF privé), ou de clôture après preuve certaine d'absence. Réserver les identifiants fournisseur dès qu'ils sont connus. Jamais de bouton de rachat aveugle ni de clôture sur simple timeout.

**P1-3 — Tarif non lié aux mesures et à l'adresse complète de départ atelier à l'achat.**

- La table conserve poids et dimensions des deux sens, mais la réservation ne compare que les empreintes des adresses client et retour ; elle vérifie le plafond général du colis retour, pas l'égalité avec les mesures approuvées. Le tarif saisi avant les travaux peut ainsi être réutilisé pour un autre poids encore dans le plafond.
- L'adresse atelier n'entre pas dans ces deux empreintes. Sa modification après verrouillage est bloquée, mais le dossier ne possède pas une empreinte tarifaire complète des deux trajets.
- Essai local : retour mesuré à 499 g / longueur 350 mm, différent du tarif/du plan initial, réservation autorisée.
- Correctif : associer chaque approbation à la version exacte des adresses et des mesures utilisées et revalider avant un nouvel achat ; distinguer clairement récupération d'une étiquette existante et nouvel achat.

**P2 — Plan accepté avec adresse/coordonnées à corriger.** Le contenu est figé après proposition/acceptation ; cela protège l'accord commercial, mais il n'existe pas de procédure de correction logistique après accord. Revoir explicitement la correction versionnée, sans réécrire le contrat accepté. Les erreurs de téléphone introduites par #123 sont contrôlées sur les nouvelles saisies ; les données historiques ne sont pas automatiquement corrigées.

## 2. Webhook : rapprochement, rejeu et réception

Sources : `src/marketplace/shipping/sendcloudWebhook.ts`, `src/marketplace/services/roundTripWebhook.server.ts`, `src/marketplace/shipping/sendcloudProvider.server.ts` et fonction SQL de transition.

- HMAC SHA-256 du corps brut, comparaison sans arrêt au premier octet différent ; signature invalide → 401. JSON invalide → 400.
- Seuls `parcel_status_changed` avec identifiant de colis et horodatage sont traités. Le job est retrouvé par **fournisseur + provider_label_id**, pas par le numéro de suivi.
- Le fournisseur est relu par référence du job ; si réponse `null`, repli par identifiant de colis v2. `unknown` → 503, discordance d'identifiant → 409. Le repli v2 n'est pas tenté si la recherche v3 renvoie `unknown`, même pour un colis Retour déjà rattaché : retard de suivi possible en cas d'indisponibilité de cette recherche.
- Un colis non rattaché est ignoré en 200. Si le webhook arrive avant `label_confirmed`, le job n'a pas encore sa colonne fournisseur/colis ; aucun rattrapage n'est planifié après ce 200. Il faut un événement ultérieur ou une récupération explicite.
- Événement durable `tracking_update`, dédupliqué sous verrou par `(job_id, provider_event_id)` avec identifiant `${parcelId}:${timestamp}`. Un rejeu exact n'ajoute pas de seconde ligne. La relecture fournisseur précède la déduplication : même un rejeu peut obtenir 503 pendant une panne fournisseur, sans écriture dupliquée.
- L'horodatage fait partie de l'identifiant mais n'impose pas une séquence métier. Le journal reçoit l'état courant relu chez le fournisseur, pas une projection fiable de chaque étape historique. Deux notifications distinctes ayant le même colis et horodatage seraient fusionnées.

| État du colis relu | Résultat du code actuel |
| --- | --- |
| Annulé | `tracking_update` avec le statut fournisseur ; job **reste confirmed**, étiquette encore téléchargeable, pas de remboursement présumé. |
| Livré | `tracking_update` seulement ; **aucun événement atelier received**, aucune confirmation physique fabriquée. |
| Refusé / `ANNOUNCEMENT_FAILED` tardif | `tracking_update` seulement ; job **reste confirmed** s'il était déjà confirmé. Le traitement d'échec net ajouté par #123 concerne la réponse initiale à l'achat, pas ce webhook tardif. |

**P1-4 — Annulation fournisseur non projetée.** Une annulation finale reçue par webhook ne retire pas l'étiquette aux personnes qui l'utilisent ; l'admin doit vérifier le panneau puis consigner « Annulée (référence) ». Un rejet tardif n'a pas de projection exploitable non plus. Correctif : rapprochement explicite des statuts annulé/refusé et état d'exception opérateur ; ne jamais assimiler ces statuts à un remboursement, ni une livraison à une réception physique.

La séparation transport / réception physique est correcte dans le code : seule la confirmation atelier alimente le journal qui autorise le retour. Elle doit être préservée.

## 3. Annulation depuis le site après #121

**Correction de l'hypothèse du brief : la primitive d'annulation des envois ordinaires existe, mais n'est pas branchée à une action fournisseur du site.**

- `createSendcloudProvider.cancel` recherche `/shipments?external_reference_id=<job>` puis appelle `/shipments/{id}/cancel`. Il distingue 200, 202, refus et réponse ambiguë. Les tests utilisent des réponses simulées ; les HTTP 202 réels cités dans le brief ne sont pas reproduits.
- `cancelLeg` consigne la demande, puis appelle cette primitive. Une recherche des appels du dépôt ne trouve son utilisation que dans les tests ; `caseLogistics.data.functions.ts` expose achat, dépôt manuel et **consignation** d'événements, pas `cancelLeg`.
- « Annulation demandée » dans `JobActions` appelle `recordLabelEvent` : c'est une déclaration de l'opérateur, **pas une demande envoyée à Sendcloud**. « Annulée (référence) » est un constat externe.
- Pour une méthode Sendcloud Retour créée par `/returns/announce-synchronously`, le chemin d'annulation ne connaît ni le `return_id` ni une API d'annulation Retour ; sa recherche v3 par référence ne retrouve pas ce retour et peut produire `shipment_not_found`. Ceci concerne la **méthode Sendcloud Retour**, pas tout trajet retour : le trajet atelier → client est un envoi ordinaire.
- #122 conserve ces méthodes désactivées (`SENDCLOUD_RETURN_METHODS_ENABLED=false`). Le défaut reste à résoudre avant leur réouverture et pour tout retour historique réellement créé. Aucun achat Retour réussi n'est attesté ici.

**P1-5 — Rendre l'action réelle explicite.** Si l'on veut annuler depuis le site, brancher une commande admin fournisseur distincte du simple journal, gérer l'attente 202 et son rapprochement, conserver l'identifiant approprié par type d'envoi. Ne pas marquer annulé sur une simple demande et ne pas présumer de remboursement.

## 4. Ancienne intégration 621399 : panneau consulté

Le 15 octobre 2026, après ouverture de session par le propriétaire, lecture du panneau `https://app.sendcloud.com/v2/settings/integrations/api/621399` : nom **mareliure**, case **« Feedback des Webhooks activé » décochée (0)**. L'ancien feedback est donc **désactivé dans le panneau consulté**. URL affichée : `https://mareliure.fr/api/marketplace/sendcloud-webhook`.

Lecture de `https://app.sendcloud.com/v2/settings/integrations/api/633076` : nom **mareliure api**, feedback **coché (1)**, même URL. Aucun clic sur Enregistrer, Tester l'API Webhook, Régénérer ou Déconnecter. Aucune clé copiée ni publiée. Ces réglages ne prouvent pas le statut HTTP des deux notifications de 13:58.

## 5. Recommandations classées

| Gravité | Recommandation | Preuve / impact |
| --- | --- | --- |
| P1 | Versionner et renouveler l'approbation tarifaire ; récupérer un achat existant indépendamment de son expiration | P1-1 : retour différé ou reprise bloqués ; nouveau tarif refusé. |
| P1 | Résoudre les jobs ambigus avec preuves fournisseur, sans rachat aveugle | P1-2 : ni abandon ni adoption manuelle accessible ; indispensable avant réouverture des méthodes Retour. |
| P1 | Revalider les mesures/adresses exactes pour un nouvel achat | P1-3 : coût approuvé susceptible de ne plus correspondre au colis envoyé. |
| P1 | Projeter les annulations/rejets rapprochés et rattraper les événements reçus avant rattachement | P1-4 : étiquette annulée encore présentée comme disponible ; perte d'un premier événement. |
| P1 | Distinguer demande d'annulation fournisseur et constat opérateur ; traiter les méthodes Retour séparément | P1-5 : une entrée du journal n'annule rien chez Sendcloud. |
| P2 | Afficher tarif/échéance, cause de blocage et action de reprise ; rendre le bouton de reprise distinct du bouton de nouvel achat | Un code brut ou une note n'indique pas la marche à suivre. Le Pilotage compte notamment les retours prêts sans étiquette, pas toutes les ambiguïtés. |
| P2 | Prévoir une correction logistique versionnée après accord et un rapprochement par identifiant si la recherche par référence est indisponible | Préserver le contrat, les preuves et la séparation réception physique / livraison. |
| Vérifié | Ancien feedback 621399 déjà désactivé | Aucune modification à demander sur ce point au vu du panneau lu. |

Les coûts réels du fournisseur restent `null` à la création ; les chiffres du devis ne sont pas une facture. Le journal permet de consigner ensuite les frais et remboursements constatés. Ne pas afficher leur absence comme un coût réellement nul.

## Validation et limites

Résultats locaux détaillés à la fin de la reprise dans `docs/CODEX_HANDOFF.md`. La suite initiale sur la base inchangée a rencontré des délais de scan sous charge : 3 764 tests réussis, cinq timeouts, deux erreurs de délai internes à Vitest. Les fichiers concernés ont été rejoués isolément ; aucune assertion n'a été supprimée ou modifiée. Les six scénarios d'audit temporaires et les tests de transport ciblés sont exécutés séparément ; leur code temporaire n'est pas inclus dans la PR documentaire.

Restent non vérifiés : état actuel de la base/Worker production, code HTTP et rattachement des notifications de 13:58, clôture réelle des annulations en file, relecture et annulation d'une étiquette Retour réellement achetée, essai physique du livre. Le rapport ne revendique aucune de ces recettes.
