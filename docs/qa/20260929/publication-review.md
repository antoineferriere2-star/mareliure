# PR #52 — journal traduit et avis de publication

## Avis : favorable au suivi logistique manuel

Le blocage de traduction/contrôle du journal Fine Bindery est levé. Avis limité au suivi manuel par ouvrage, avec photos privées et déclaration finale de l'atelier, **sous réserve de la CI complète verte du HEAD final**. Aucune fusion ni publication autorisée par cet avis. Les limitations historiques des rapports précédents doivent être lues avec les compléments ci-dessous.

## Traduction et navigateur

`LogisticsPanel` utilise la langue de l'espace atelier. Le dictionnaire typé `logisticsCopy` contient intégralement **EN/FR/DE/IT/ES** : événements, modes, distinction livraison transporteur/réception physique, état constaté, preuves, confidentialité, erreurs, chargement, boutons et déclaration finale. Les dates suivent la langue sélectionnée. Le sélecteur de photo a un libellé localisé, sans dépendre du texte natif du navigateur. Les descriptions, références et noms de transporteurs saisis par l'atelier ne sont pas traduits.

Chromium Playwright isolé, application locale de #52, Auth/SQL/Storage du seul projet **qwfhebtxeubfmvvdsqdt**. Compte atelier QA A réel, ouvrage Fine Bindery `89dd8e53-1d1f-4061-a62f-6aeead6dcc43`. Journal colis déjà achevé par les contrôles mobiles lors de la recette précédente ; aucune migration rejouée.

Dans chacune des cinq langues, bureau 1 440 × 1 000 et mobile 390 × 844 :

- historique et attribution finale affichés dans la langue choisie ; aucun retour français inattendu dans les libellés du journal ;
- note sans description refusée avec une validation traduite ;
- changement de langue par le menu mobile : texte libre conservé, message d'erreur retraduit ;
- date affichée comparée au `dateTime` du serveur dans la locale choisie ;
- aucun débordement horizontal mesuré, contrôles utilisables et captures relues.

Preuve : `journal-i18n-evidence.json`. Captures `journal-*-mobile.png` et `journal-it-desktop.png`. Les captures longues du panneau peuvent inclure l'en-tête et la navigation fixes à leur position de capture ; les contrôles ont aussi été utilisés dans le viewport réel.

## Défaut de reprise réellement reproduit et corrigé

Après le refus d'un SVG, un PNG était bien enregistré mais l'erreur locale « Photo non confirmée » restait visible. La nouvelle tentative efface désormais l'erreur précédente ; un nouvel échec peut toujours l'afficher. Aucun changement des droits, de la RPC ou de Storage.

Reprise contrôlée en espagnol sur mobile, avec un **PNG distinct** :

| Étape | Associations SQL du constat | Objets Storage du constat | Affichage |
|---|---:|---:|---|
| Avant | 1 | 1 | Une photo |
| SVG refusé | 1 | 1 | Erreur traduite |
| PNG valide après refus | 2 | 2 | Deux photos, aucun message d'erreur, envoi terminé |

Les inventaires sont lus réellement dans la RPC et l'API Storage. Preuve : `journal-photo-retry-evidence.json`. Ce constat est distinct des incidents de course et de l'objet isolé antérieur, qui restent conservés et documentés séparément.

## Matrice consolidée

| Contrôle | Résultat et preuve |
|---|---|
| Auth réelle, autre atelier, anonyme, membre désactivé, accès direct SQL/Storage | Réussi — rapport hébergé principal |
| URL privée et expiration après 60 s | Réussi — rapport hébergé principal |
| Aller/réception avec écart/incident/retour/remise finale, colis et main propre, deux marques sur mobile | Réussi — `mobile-transitions-evidence.json` |
| Deux événements concurrents, version périmée, retry sans doublon | Réussi — rapport hébergé principal |
| Huit fichiers distincts, deux ajouts sur dernière place, SQL/Storage/deux onglets | Réussi après correction — `last-slot-concurrency.md` (8/8) |
| Interruption avant SQL, réponse perdue après SQL, reprises concurrentes | Réussi après correction — `photo-recovery-current-evidence.json` |
| Journal Fine Bindery EN/FR/DE/IT/ES bureau/mobile, validation et dates | Réussi — présent complément |
| Refus puis reprise photo : erreur et stockage cohérents | Réussi après correction — présent complément |
| Types régénérés depuis le test et report limité à #52 | Réussi — `../../hosted-qa-results-20260929.md` |
| Panne du nettoyage Storage lui-même | Test unitaire réussi ; panne hébergée non injectée |
| Worker publié et appareils Safari/iOS réels | Non testés |

Le bandeau de QA A (`draft`) est cohérent : clients/ouvrages propres autorisés, projets réseau soumis à approbation séparée. Ses textes ont déjà été clarifiés dans les cinq langues. Le droit réseau refusé n'empêche pas le journal d'un ouvrage propre.

## Limites résiduelles et publication ultérieure

- Suivi manuel d'un aller-retour par ouvrage. Pas d'achat d'étiquette, d'intégration transporteur, de tarif, d'assurance ou de preuve de livraison certifiée ; la remise finale est une déclaration de l'atelier, pas du client.
- URLs signées utilisables jusqu'à expiration après révocation ; pas d'antivirus ni de réencodage des images. Originaux réservés aux accès autorisés. Si le résultat SQL est ambigu et non vérifiable, l'objet est conservé pour reprise ; aucune suppression aveugle.
- Traduction du **journal**, pas certification de l'ensemble des anciennes pages métier. Les contenus libres restent dans leur langue. Chromium mobile émulé, pas un essai sur chaque appareil physique.
- Aucun Worker déployé pendant la recette. La future publication nécessite précontrôle/sauvegarde autorisés, migration `20260928130000` et smoke test après déploiement. Si #51 est retenue aussi : `0900 → 1100 → 1300`. Les conflits de types/handoff entre les branches doivent être relus, sans importer un circuit payant par inadvertance.
- Les échecs initiaux et anciens objets isolés de QA sont conservés dans les preuves. Ils ne sont pas présentés comme de nouveaux échecs des correctifs.

La fiche Sendcloud reste une préparation d'essai, sans prix ni couverture confirmés. Aucune production touchée, migration supplémentaire, fusion, publication ou opération payante.
