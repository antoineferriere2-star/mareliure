# Complément de recette — 29 septembre 2026

**État historique, complété ensuite : voir [last-slot-concurrency.md](last-slot-concurrency.md).** Les quatre parcours mobiles et la course de fichiers distincts sont désormais exécutés ; le défaut Storage de la dernière place est corrigé. Les preuves du bouton d'avoir et de la suite HTTP des demandes publiques sont sur la branche de #51.

Cible unique : qwfhebtxeubfmvvdsqdt. Application locale, Auth/PostgREST/Storage hébergés. Aucun Worker publié, aucun rejeu de réconciliation ni migration supplémentaire.

## Parcours publics effectivement exécutés

- Fine Bindery : neuf étapes en anglais, dépôt par le sélecteur de fichiers, récapitulatif et confirmation affichée, depuis le serveur local de #52.
- Ma Reliure : huit étapes, dépôt d’une couverture fictive, récapitulatif puis confirmation en français, depuis #51. Les dernières étapes et la confirmation ont été contrôlées en viewport mobile ; largeur DOM réelle 375 px, sans dépassement horizontal.
- Deux dossiers distincts avec les bonnes marques, deux sessions submitted, un objet photo lisible dans Storage pour chacun. Voir public-intake-evidence.json. Les adresses example.invalid et les illustrations de documents QA sont fictives. Aucun envoi vers un vrai destinataire, aucun paiement.
- La langue en est présente dans les réponses Fine Bindery. Les colonnes de langue des dossiers sont encore nulles avant tri ; le code de reconcileCaseTriage les copie pour les demandes issues d’un profil Fine Bindery. Ces dépôts généraux ne prouvent pas le parcours depuis un profil publié ni le tri. Aucun tri global déclenché sur les anciennes démonstrations.

## Limites à ne pas transformer en succès

- Le téléchargement par bouton de l’avoir a été tenté deux fois. Le bouton est présent, aucune erreur n’est affichée, mais aucun artefact de téléchargement n’a été capturé avant les délais de l’outil. La génération HTTP du PDF, sa lecture visuelle et les refus inter-ateliers sont des preuves distinctes déjà acquises.
- Les dépôts publics aboutissent, mais pas encore une recette navigateur de bout en bout jusqu’à proposition/accord client et consultation par atelier autorisé. Les transitions commerciales testées via API ne remplacent pas ce parcours.
- Limite de huit photos distinctes/course au dernier emplacement, toutes les actions logistiques depuis mobile et rendu complet de l’espace atelier Fine Bindery non exécutés.
- La fixture Fine Bindery conserve une phrase narrative française du playbook historique. Le lien de résumé absolu pointe vers Ma Reliure ; il n’a pas été suivi depuis cette recette.

Les timeouts locaux de #51 concernent des lectures de fichiers ; les assertions métier ne sont pas en défaut dans les reprises ciblées et la CI complète. Les seuils n’ont pas été augmentés.

**Pas de feu vert global de publication : CI verte ne signifie pas parcours fonctionnels restants validés.**
