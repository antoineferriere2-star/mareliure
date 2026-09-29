# Complément : concurrence de photos et mobile

**Complété par [publication-review.md](publication-review.md) : journal désormais traduit et contrôlé dans les cinq langues, reprise d'erreur photo corrigée. Les constats de traduction ci-dessous décrivent l'état antérieur.**

Instance unique : `qwfhebtxeubfmvvdsqdt`. Aucune migration supplémentaire. Application locale de la branche #52, Auth et Storage hébergés. Aucun déploiement.

## Défaut reproduit et correction

Dix PNG réels distincts (dimensions et contenu différents) ont été préparés. Après sept envois, deux fichiers distincts sont envoyés simultanément sur la dernière place. Avant correction : huit associations SQL, neuf objets Storage, un succès applicatif et un refus. Un dixième fichier est refusé sans nouvel objet.

Après correction : huit associations et huit objets. Après une erreur de l'association, le serveur relit le constat. Si la photo est associée, il reconnaît le succès malgré la réponse perdue. Si le constat immuable contient huit photos et que cet identifiant en est absent, il supprime uniquement l'objet perdant. Si la lecture échoue, si le constat est introuvable ou si une place reste disponible, il conserve l'objet pour permettre la reprise avec le même identifiant. Une erreur Storage de nettoyage reste une erreur explicite.

Sept tests de récupération couvrent ces distinctions ; les deux tests d'identité stable passent également. TypeScript et lint ciblé passent.

## Vérification dans deux onglets mobiles

Chromium Playwright isolé, viewport 390 × 844, connexion réelle de l'atelier QA A. Sept fichiers déposés en préparation ; les deux derniers sont envoyés depuis les sélecteurs de fichiers de deux onglets ouverts sur le même incident.

- SQL : **8** associations.
- Storage : **8** objets.
- Chaque onglet : **8** images, aucun champ d'ajout supplémentaire.
- Onglet perdant : erreur visible ; onglet gagnant : pas d'erreur.

La transaction SQL sérialise les insertions ; le correctif applicatif traite le fichier envoyé avant le refus SQL. Il ne modifie ni les droits ni la migration.

## Objets historiques de recette

L'objet isolé du scénario d'interruption antérieur au correctif d'identifiant stable reste distinct. Le nouvel incident utilisé pour reproduire la course avant correction conserve également son inventaire 8/9 comme preuve. Aucun de ces anciens objets ne constitue un échec du scénario corrigé, qui emploie de nouveaux incidents.

## Mobile

Fine Bindery : parcours colis et main propre entièrement déclenchés par les contrôles de l'espace atelier. Colis : aller, livraison transporteur, réception physique avec écart, incident, retour, livraison transporteur, remise finale. Main propre : aller, réception avec écart, incident, retour, remise finale. Chaque transition affichée est comparée au journal SQL. Aucun dépassement horizontal ; la remise reste explicitement une déclaration de l'atelier, pas du client.

Le bandeau du compte A correspond à un atelier non approuvé pour les dossiers réseau : ses propres ouvrages restent accessibles. Il ne faut pas assimiler l'autorisation d'un ouvrage propre à celle d'un dossier réseau.

La répétition sous la configuration serveur **Ma Reliure** réussit également avec deux nouveaux ouvrages QA, colis et main propre. Un premier clic de retour n'a pas été confirmé dans le délai du navigateur (quatre événements conservés) ; après relecture de la fiche, la reprise a terminé le parcours sans doublon. Cette tentative n'est pas comptée comme une réussite avant sa reprise. Les quatre journaux finaux, leurs étapes et l'absence de débordement sont dans `mobile-transitions-evidence.json`. Captures : `logistics-mr-mobile-complete.png` et `logistics-fb-mobile-complete.png`.

La couche logistique commune conserve ses libellés français dans l'espace Fine Bindery ; le cadre de navigation Fine Bindery est bien affiché. Cette recette valide les transitions et les droits, pas une traduction intégrale de cette nouvelle section.

## Reprise après interruption recontrôlée sur ce correctif

Après coupure entre Storage et SQL : un objet, zéro association ; deux reprises simultanées donnent un objet et une association. Après perte de la réponse SQL : le serveur relit l'association et reconnaît immédiatement le succès ; deux reprises ne créent aucun doublon. Voir `photo-recovery-current-evidence.json`.

## Matrice finale fonctionnelle

| Contrôle | Résultat |
|---|---|
| Mobile Ma Reliure : colis et main propre jusqu'à remise finale | Réussi après reprise du contrôle du retour |
| Mobile Fine Bindery : colis et main propre jusqu'à remise finale | Réussi |
| Livraison transporteur distincte de réception physique / écart / incident / preuve atelier | Réussi |
| Huit fichiers distincts, course dernière place, SQL + Storage + deux onglets | Réussi après correction ; échec avant correction conservé séparément |
| Réponses perdues et deux reprises identiques concurrentes | Réussi |
| SVG, taille excessive, interruption du corps HTTP, accès inter-ateliers, expiration 60 s | Réussi lors de la recette hébergée précédente, preuves dans le rapport principal |
| Traduction intégrale du journal logistique Fine Bindery | Non testée ; libellés communs français constatés |
| Stockage : panne du nettoyage lui-même | Test unitaire de propagation de l'erreur réussi ; panne hébergée non injectée |
| Publication Worker | Non testée, explicitement interdite |

TypeScript, lint ciblé et neuf tests ciblés passent. La première suite complète Windows concurrente des navigateurs a reproduit un timeout de lecture du bundle PDF puis a été arrêtée. Les serveurs ont ensuite été arrêtés pour isoler la reprise. Les seuils de timeout ne sont pas augmentés. La CI complète du nouveau HEAD reste le contrôle final ; son lien et son résultat sont ajoutés dans la PR.
