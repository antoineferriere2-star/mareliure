# Logistique manuelle des ouvrages — recette avant publication

Branche `feat/work-logistics-manual`, base main `bbd4b57`. Le patch `/workspace/scratch/8802e09064a3/work-logistics-manual.patch` et le commit `2ec6e21` n'étaient pas accessibles : périmètre reconstruit, pas de reprise présumée du patch ni de ses résultats. Aucun paiement, achat d'étiquette, prix de transport ou niveau d'assurance ajouté.

## Parcours livré

Le panneau « Trajet et réception de l’ouvrage » est intégré à chaque fiche `/atelier/ouvrages/$workId`, commune à Ma Reliure et Fine Bindery. L'espace atelier existant reste en français sur les deux marques ; cette PR n'ajoute pas de portail logistique client ou de traductions publiques.

1. Aller : colis suivi (transporteur et numéro obligatoires) ou remise en main propre.
2. Mention facultative « livré selon le transporteur », saisie manuellement avec référence de preuve. Elle ne change jamais l'état en réception physique.
3. Réception physique constatée par l'atelier : état conforme ou écart ; description de huit caractères minimum pour un écart. Jusqu'à huit photos privées peuvent être ajoutées au constat.
4. Retour disponible uniquement après cette réception : colis suivi ou main propre.
5. Remise finale déclarée par l'atelier avec référence de preuve obligatoire. L'écran précise que le client n'a pas confirmé lui-même.

Un incident ou une note de correction peut être ajouté à tout moment, même après remise finale. Une erreur de suivi se rectifie par une note, sans réécrire l'événement initial. Les dates sont celles d'enregistrement serveur, pas une date réelle de livraison vérifiée. Un incident ne décide pas automatiquement de bloquer le transport. Cette V1 suit un aller/retour par fiche, pas plusieurs cycles de réexpédition.

## Sécurité et concurrence

- Atelier et auteur résolus depuis Auth côté serveur, jamais pris dans le corps envoyé. La RPC revérifie l'appartenance active et l'ouvrage de cet atelier, y compris en lecture.
- Verrou de ligne sur l'ouvrage ; version de journal attendue ; identifiant de requête pour retry exact. Une requête concurrente devenue obsolète est refusée. Les tests PGlite vérifient le refus de version obsolète, pas l'ordonnancement de deux connexions PostgreSQL distantes.
- Tables événements/photos avec RLS, aucun accès direct anon/authenticated. Historique et pièces jointes non modifiables/supprimables, y compris par les fonctions applicatives.
- Bucket `work-logistics-private`, privé, formats JPEG/PNG/WebP, maximum 5 Mo. Signature de fichier contrôlée côté serveur ; SVG/HTML refusés. Pas d'analyse antivirus ou de réencodage des images dans cette V1. Ne pas exposer les originaux hors des ateliers autorisés.
- Politique Storage restrictive excluant ce bucket de toute permission navigateur, même si une autre politique est trop large. Téléversement serveur, chemins construits avec atelier/ouvrage/événement/UUID. Photos seulement sur constat de réception ou incident. URLs signées 60 secondes, renouvelées par le panneau ; une URL déjà émise reste utilisable jusqu'à expiration, même après révocation du compte.
- Si l'insertion de référence photo échoue de façon ambiguë après l'upload, l'objet privé est conservé : une suppression immédiate pourrait détruire une pièce dont l'insertion a réussi. Contrôler les objets orphelins avant publication ; un nouvel envoi après erreur peut créer une seconde photo, dans la limite de huit. Aucun nettoyage automatique de données réelles.

## Vérifications locales effectuées

- Suite générale initiale : **3 065 tests / 226 fichiers**, tous verts ; TypeScript, lint (0 erreur, 17 avertissements existants), build générique verts. Test Storage restrictif ajouté ensuite, résultat final dans la CI de la PR.
- Migration réelle `20260928130000_work_logistics_manual.sql` exécutée sur PostgreSQL/PGlite éphémère : droits, autre atelier, membre désactivé, transitions, suivi transporteur distinct, constat obligatoire, retries, version obsolète, photos du même ouvrage, historique immuable, MIME et validation d'entrée.
- Recette de coexistence locale : reprise temporaire de `externalSettlement.recipe.test.ts` de #51 au SHA `3d19fcd`, huit migrations réelles de cette recette puis 1300 ; ajout d'un ouvrage et événement après le scénario paiement. **18 tests verts** (10 recette combinée + 8 logistique, avant ajout du test Storage). Aucun fichier métier ni migration de #51 intégré à la branche. Fixtures environnantes minimales, pas une restauration Supabase complète.
- UI locale isolée, données fictives en mémoire : saisie colis, constat avec écart refusé sans description puis accepté, retour en main propre, remise finale avec preuve et libellé exact. Contrôle visuel desktop et 390 px, pas de débordement observé. Route QA supprimée, arbre des routes restauré. Aucun appel de mutation en production.

## Migration indépendante et coexistence #51

1300 dépend des ouvrages/membres/Storage déjà présents dans main. Elle n'altère aucune table de paiements, de devis ou de factures. Aucun trigger n'est ajouté aux tables de #51. Elle est livrable seule ; si les deux PR sont retenues, ordre numérique : 0900 paiements corrigée → 1100 externe → 1300 logistique. La recette locale combinée couvre cet ordre, pas l'application de migrations hors ordre sur une instance distante. Si logistique est publiée avant paiements, résoudre explicitement l'historique des migrations antérieures lors de la future revue de #51 ; ne pas lancer `db push --include-all` aveuglément.

Les deux branches ajoutent PGlite pour les tests et des signatures RPC dans `types.ts` : vérifier la résolution des conflits de fichiers au futur merge. Ne pas importer les commits paiements pour résoudre ce conflit. La signature RPC logistique est préparée manuellement ; **les types n'ont pas été régénérés depuis Supabase** faute d'instance de recette accessible.

## Recette Supabase hébergée à exécuter

Aucune URL/clé de test disponible ici. Ne jamais employer la production actuelle `hljxohondjvrkzqicexl`, l'ancienne référence `qwfhebtxeubfmvvdsqdt` ni leurs clés. La référence `imivilculbdgjvmfyohz` du dépôt n'est pas qualifiée comme test et reste exclue. Préparer une instance jetable positivement identifiée par nom, référence et usage QA, avec migrations du main, Auth et Storage, et deux origines de recette reproduisant les contextes Ma Reliure / Fine Bindery.

1. Créer deux comptes Auth test et deux ateliers `QA LOGISTIQUE A` / `QA LOGISTIQUE B`, avec membres actifs distincts. Dans A créer le contact `QA client logistique` et l'ouvrage `QA ouvrage colis`, référence attribuée par le serveur. Dans B créer `QA ouvrage B`. Consigner les UUID réellement retournés.
2. Appliquer 1300 sur main de recette. Contrôler historique `supabase_migrations.schema_migrations`, les deux tables/RLS/triggers, la fonction et le bucket privé. Refaire sur une seconde instance avec 0900 corrigée/1100 de #51 puis 1300 et dérouler aussi sa recette externe ; aucun paiement Stripe nécessaire.
3. Dans une session A authentifiée : colis, transporteur `QA transport`, suivi `QA-123`. Ajouter « livré selon transporteur », preuve `QA scan transporteur 001`. Vérifier que retour reste interdit. Constater écart `QA coin abîmé à réception`, joindre une photo JPEG et une PNG de données fictives. Retour main propre, confirmation `QA reçu signé 001`. Ajouter incident `QA couverture marquée`, photo WebP et note rectificative. Refaire un ouvrage avec aller en main propre et retour colis.
4. En desktop et 390 px, sur chaque contexte de marque : vérifier lisibilité, messages, photos et historique après recharge. Le rendu commun a été contrôlé localement ; le contexte Auth des deux marques ne l'a pas été.
5. Ouvrir deux onglets sur la même version : soumettre des actions différentes ; une seule transition doit réussir, l'autre demande relecture. Rejouer la même requête : pas de doublon. Tester preuve absente, description d'écart vide, retour précoce, plus de huit photos, fichier >5 Mo, SVG renommé JPEG.
6. Session B et anon : tenter lecture/écriture de l'ouvrage A, URL de sa fonction serveur et upload d'une photo vers son constat : aucun événement, URL signée ou donnée ne doit être retourné. Compte A désactivé : mêmes refus. Tester PostgREST direct et Storage direct avec JWT A/B/anon. URL publique refusée ; URL signée expirée après 60 secondes refusée. Vérifier que le serveur peut lire les objets et que la politique restrictive n'affecte aucun autre bucket.
7. Vérifier les octets affichés, le type MIME renvoyé par Storage, erreurs d'upload, timeout après insertion, accès après révocation et éventuels objets privés sans référence. Ne supprimer aucune pièce liée. Aucun nettoyage production autorisé.
8. Générer les types depuis la recette, vers un fichier intermédiaire :

```powershell
if (!$env:SUPABASE_TEST_PROJECT_REF -or $env:SUPABASE_TEST_PROJECT_REF -in @('hljxohondjvrkzqicexl','qwfhebtxeubfmvvdsqdt','imivilculbdgjvmfyohz')) { throw 'Instance test requise' }
npx supabase gen types typescript --project-id $env:SUPABASE_TEST_PROJECT_REF --schema public > output/types.recipe.ts
git diff --no-index -- src/integrations/supabase/types.ts output/types.recipe.ts
```

Vérifier les deux tables et la RPC, expliquer toute différence indépendante ; ne pas écraser `types.ts` en cas de sortie vide/erreur. Pour la branche logistique, ne pas importer les types paiements issus d'une recette combinée. Relancer TypeScript et les tests après intégration des types de la base logistique seule.

**Avant publication restent à vérifier** : vrais JWT/HTTP, Storage (upload/lecture/expiration), concurrence multi-connexions, deux contextes Auth de marque et types générés. PR à relire, aucune fusion, aucun déploiement ni migration production autorisés ici.

## Reprise hébergée du 28 septembre
Voir [le rapport d'accès](hosted-qa-access-report-20260928.md) : production actuelle hljxohondjvrkzqicexl confirmée, ancienne référence qwfhebtxeubfmvvdsqdt et référence non qualifiée imivilculbdgjvmfyohz exclues. Aucun projet QA identifié. Le précontrôle hosted-qa-preflight.sql est préparé mais non exécuté. Les types ne sont pas régénérés ; les scénarios hébergés restent bloquants. [Fiche Sendcloud sans achat](sendcloud-book-roundtrip-trial.md).
