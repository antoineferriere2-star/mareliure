# Faisabilité Factur-X / PDF-A-3

Rapport technique du 23 septembre 2026. Aucun fichier Factur-X n'est produit par cette évolution.

## Standard cible

Factur-X 1.08, en vigueur depuis le 15 janvier 2026, associe un PDF lisible et un XML structuré fondé sur UN/CEFACT CII et conforme à EN 16931. La [publication FNFE-MPE de décembre 2025](https://fnfe-mpe.org/wp-content/uploads/2025/12/2025-12-04_Factur-X_1.08_ZUGFeRD_2.4_Press_Release_EN.pdf) constitue la référence de version à retenir au démarrage de l'implémentation. Le profil visé pour Ma Reliure doit être `EN16931`; un profil minimal perdrait des données déjà présentes dans le modèle.

## Génération XML

Le modèle de facture doit être projeté vers CII avec des codes normalisés : identifiants des parties, nature de l'opération, unités, catégories et taux de TVA, échéances, moyens de paiement, remises et totaux. La génération doit être une fonction pure et versionnée. Elle devra refuser toute facture qui ne passe pas le validateur de conformité applicatif, puis vérifier les égalités de montants entre snapshot SQL, XML et rendu humain.

Deux voies sont réalistes :

1. construire le CII en TypeScript à partir des schémas XSD et règles Schematron officielles, ce qui reste compatible avec le Worker mais reporte sur Ma Reliure une forte charge de conformité ;
2. appeler un service isolé utilisant [Mustangproject](https://github.com/ZUGFeRD/mustangproject), bibliothèque Java open source qui lit, écrit, combine et valide Factur-X/CII. Son validateur intègre les contrôles de schéma, Schematron et PDF/A via veraPDF.

La seconde voie est recommandée pour la production. La version de Mustang doit être épinglée et qualifiée avec le corpus Ma Reliure avant toute mise à jour.

## Compatibilité Cloudflare Workers

Le Worker exécute JavaScript/V8 et WebAssembly, pas une JVM ni un binaire natif. Cloudflare documente un [sous-ensemble d'API Node.js](https://developers.cloudflare.com/workers/runtime-apis/nodejs/) et précise que certains modules absents ne sont que des shims. Son [modèle de sécurité](https://developers.cloudflare.com/workers/reference/security-model/) n'autorise que JavaScript et WebAssembly. La compilation Wasm serait théoriquement possible, mais [WASI reste expérimental et partiel](https://developers.cloudflare.com/workers/runtime-apis/webassembly/).

Mustangproject et veraPDF ne doivent donc pas être embarqués dans le Worker principal. La stratégie proposée est un service asynchrone Java conteneurisé, appelé derrière l'abstraction `ElectronicInvoiceProvider`, avec stockage privé des entrées/sorties et idempotence par identifiant de facture. Le Worker reste responsable de l'autorisation, du snapshot et de la mise en file; le service produit et valide l'artefact.

## PDF/A-3 et validation

Le PDF actuel, produit avec `pdf-lib`, n'est pas présumé PDF/A-3. Le service spécialisé doit :

1. générer le XML CII EN16931 ;
2. transformer ou régénérer le PDF en PDF/A-3 avec polices et profil colorimétrique embarqués ;
3. joindre `factur-x.xml` avec les métadonnées XMP et la relation AF conformes ;
4. valider le XML (XSD + Schematron), le PDF/A-3 et l'ensemble hybride.

[Mustangproject](https://github.com/ZUGFeRD/mustangproject/) fournit les actions de combinaison et validation. [veraPDF](https://verapdf.org/) est le validateur PDF/A de référence intégré par Mustang. La validation doit s'exécuter à chaque génération; un artefact invalide ne doit jamais recevoir un statut `accepted`.

## Stratégie de test

- Fixtures EN16931 : franchise, TVA normale, 5,5 %, 20 %, taux mixtes, remise, acompte, B2B, particulier, entité publique et avoir.
- Tests de correspondance centime par centime entre base, XML et texte extrait du PDF.
- Validation automatique Mustang + veraPDF de chaque fixture et d'un corpus de non-régression.
- Tests négatifs avec XML invalide, métadonnées XMP incohérentes, pièce jointe absente et arrondis divergents.
- Test d'idempotence et de reprise : une même facture ne produit qu'un artefact versionné; les nouvelles tentatives conservent l'historique des statuts.
- Test d'intégration avec la plateforme agréée seulement après sélection du fournisseur et accès à son environnement de recette.

## Étapes avant réalisation

Choisir une plateforme agréée, confirmer son format d'entrée et ses statuts, figer la version Factur-X acceptée, déployer un prototype du service Java hors production, faire valider un corpus par le fournisseur puis soumettre la décision d'architecture et les coûts d'exploitation. Aucun connecteur ne doit être codé à partir d'une API supposée.

