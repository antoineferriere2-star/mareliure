# Pilotage Ma Reliure · Fine Bindery — publication du 8 octobre 2026

La PR [#104](https://github.com/antoineferriere2-star/mareliure/pull/104) est fusionnée et publiée. `/admin` rassemble les deux marques, avec filtres de marque et de période (7, 30, 90 jours, depuis l'ouverture), alertes, parcours des dossiers, encaissements A/C, onboarding B/Connect et état du transport. Les flux suivent la période ; les états et alertes reflètent la situation actuelle. Les chiffres ateliers/abonnements/Connect sont communs aux deux marques, explicitement indiqués comme tels.

## Corrections réalisées pendant la revue

- Les litiges C sont rattachés au paiement et à sa marque, même quand ce paiement précède la période sélectionnée. Le filtre Fine Bindery ou Ma Reliure ne masque plus ses litiges.
- Le compteur de messages non lus utilise des lectures dédiées pour l'administrateur connecté, ses dates de lecture et les audiences autorisées. Il ne passe plus par l'ancienne liste de dossiers qui peut déclencher une réconciliation de triage. Aucun corps de message, identifiant de lecteur ou coordonnée de client ne sort dans le résultat.
- Les lectures sont paginées par 1 000 lignes et ordonnées sur une clé unique ; les dates de filtre et de tri sont comparées comme des instants, malgré des fuseaux différents.
- Au changement de filtre, le chargement remplace les anciens chiffres jusqu'à réception de ceux du nouveau filtre.

## Publication

- Correction de revue : `00a7de753de931adda51ba31bab81e144f213673`.
- Commit applicatif fusionné : `5127fe0e2e4ce19f8cca27041ed4273593aced06`. Le build Ma Reliure a été créé depuis le commit de revue ; son arbre est identique à celui du commit fusionné, vérifié avant publication.
- Worker : `005b597d-0792-47a8-b63f-082799a6cbc4`, 100 % du trafic.
- Déploiement : `a2fc2c3f-f9f1-42a0-916e-265b8fc1ccd5`, 8 octobre à 08:27:03 UTC.
- Retour arrière : `e1049a8a-6ecd-41c5-887b-68b3befe8d02` (PR103, redirections des marques conservées).
- Runtime et 25 bindings strictement identiques à la version précédente, dont les trois secrets Sendcloud ; aucune configuration QA. Le client ne référence que le projet Supabase de production prévu par le script de build.
- Sauvegarde complète avant publication, vérification de son catalogue : 1 347 644 octets, 1 801 entrées, SHA-256 `d9053108539425ef440ad7da06ddc71e73f785e2d1af01f7eed762661923d8b3`. Archive et preuves privées hors Git.
- Aucune migration nouvelle : 118 migrations. Dix empreintes commerciales/factures et les paramètres d'offres sont inchangés entre les lectures avant/après.

## Contrôles réussis et limites de preuve

- [CI de la PR](https://github.com/antoineferriere2-star/mareliure/actions/runs/37749353764) et [CI du commit applicatif sur main](https://github.com/antoineferriere2-star/mareliure/actions/runs/37749745284) vertes : 3 711 tests / 302 fichiers, garde-fous, TypeScript, lint et build.
- 15 tests du tableau de bord couvrent les calculs, les filtres, la pagination au-delà de 1 000 lignes, les messages non lus et le refus avant ouverture du client privilégié. 25 tests ciblés avec les contrats secrets/PDF passent ; les 10 contrôles secrets/PDF ont aussi été exécutés sur le nouveau build.
- La suite locale initiale a eu trois dépassements de délai dans les scanners de fichiers/bundles (3 708/3 711) ; les trois passent isolément et la CI complète passe. Aucun test n'a été supprimé ou modifié pour masquer ces délais. TypeScript et lint sans erreur, 19 avertissements existants ; 19 garde-fous passent.
- Les 20 requêtes du tableau de bord sont validées directement en SQL, en lecture seule sur la production, avec leurs clés de pagination. Le calcul est exécuté sur ces données pour les 12 combinaisons marque/période, sans montant non numérique ni coordonnée client dans le résultat.
- 39 contrôles HTTP réels sur les deux domaines : conditions B/C, refus du tableau de bord sans session pour chaque marque, refus des actions transport/onboarding non autorisées, lien de paiement invalide, signatures Stripe/Sendcloud, HTTP→HTTPS et pages d'accueil. Fine Bindery `/` répond 301 vers `/en` ; sa page `/tarifs` française redirige vers Ma Reliure conformément à la PR103.
- Le contrôle visuel bureau/mobile fourni par l'auteur initial repose sur une session et des données simulées. Computer Use Codex a échoué au démarrage ; aucun nouveau rendu connecté ni appel HTTP authentifié réussi du tableau de bord en production n'est prétendu. Les lectures SQL, calculs, garde d'autorisation unitaire et refus HTTP publics sont des preuves distinctes.

## État commercial et transport conservé

A/B/C et onboarding restent ouverts ; B est à 15 € HT / 18 € TTC, quatre ateliers historiques gratuits ; C à 3 % du TTC encaissé, TVA comprise, frais Stripe séparés. Aucun changement fiscal ni facture historique réécrite ; l'accord du propriétaire reste une approbation administrative, sans avis comptable ou juridique prétendu.

Sendcloud reste configuré et l'achat automatique fermé (`enabled=false`), zéro réservation d'étiquette. Aucun achat d'étiquette, débit réel ou expédition physique n'a été effectué. La correction des méthodes achetables de la PR101 reste présente. Les limites de couverture, de retour/relais et de recette réelle restent celles de `SENDCLOUD_RATE_APPROVAL_20261007.md` et `SENDCLOUD_WIRING_20261007.md` ; cette publication du tableau de bord ne les lève pas.

Preuves privées : `D:/CodexProjects/oppe-model-operation/dashboard-pr104-*`. Ne jamais publier l'archive, les secrets ou les résultats SQL détaillés.
