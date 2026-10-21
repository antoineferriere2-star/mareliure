# Candidature atelier : validation et refus accessibles — 21 octobre 2026

Branche issue de `origin/main ef45d12`, après #163/#164. Le composant Hero de PartnersLanding reste identique octet pour octet (SHA-256 `699261d5a8372fc8004db7ef3c8fb512299857c3c051f63a5668c8d38de4334a`). Les changements de cette page concernent ApplicationForm et ses imports.

## Contrat retenu

La ville devient **facultative dans ApplicationForm**, comme elle l’était déjà au serveur et dans l’autre entrée `/candidature-atelier`. Le contact initial n’exige pas de localisation pour être étudié ; aucune information existante n’est effacée. Les quatre champs de contact obligatoires restent prénom, nom, nom de l’atelier et e-mail.

Le consentement, déjà exigé dans ApplicationForm, est maintenant transmis et vérifié au serveur comme booléen vrai. L’autre page de candidature reçoit donc la même case obligatoire et traite le résultat de refus, pour éviter un faux succès. **Aucune preuve de consentement persistée ni nouveau stockage n’est prétendu** : il s’agit de valider la demande courante, sans migration.

`applicationValidation.ts` fournit le même validateur pur aux deux côtés. Le navigateur le charge à l’interaction ; le serveur le relance indépendamment avant tout accès privilégié, écriture ou notification. Les erreurs sont renvoyées en objet sérialisable `{ ok: false, fieldErrors }`, pas déduites du texte d’une exception Zod.

| Champ | Contrat |
| --- | --- |
| Prénom / nom | Obligatoires, espaces extérieurs retirés, 100 caractères chacun |
| Nom d’atelier | Obligatoire, 200 caractères |
| E-mail | Obligatoire, format e-mail, 200 caractères ; mise en minuscules conservée à l’enregistrement |
| Ville | Facultative, 100 caractères |
| Téléphone | Facultatif, 30 caractères et 7 à 15 chiffres ; indicatif international, espaces, points, tirets, parenthèses acceptés |
| Site / réseau social | Facultatif, 300 caractères, URL complète HTTP(S) ; aucune visite de cette adresse par la validation |
| Expérience | Facultative, entier de 0 à 100 ; une valeur fractionnaire n’est plus tronquée par parseInt |
| Présentation | Facultative, 2 000 caractères |
| Savoir-faire | Facultatifs, catalogue existant conservé ; 20 valeurs maximum, slugs inconnus filtrés comme auparavant |
| Consentement | Booléen vrai obligatoire |
| Piège à robots | 200 caractères maximum, jamais stocké ; faux succès sans accès à la base pour une demande valide qui le remplit |

Le téléphone concerne un atelier, potentiellement international : la contrainte française propre au transport n’est pas réutilisée. Ces formats ne certifient ni qu’un numéro existe ni qu’une adresse web appartient à l’atelier.

ApplicationForm garde les attributs required/maxLength/type pour la sémantique et les claviers adaptés. `noValidate` permet de présenter les messages français du validateur partagé à chaque champ : aria-invalid, aria-describedby, texte associé. Après **chaque** refus, un effet après rendu place le focus sur le premier champ invalide dans l’ordre de la page. Une simple modification de champ ne déplace pas le focus. Une panne d’enregistrement reste un message global ; aucun détail SQL n’est exposé comme erreur de saisie.

## Vérifications

- **40 tests ciblés réussis** : 34 tests de validation (normalisation, formats, consentement, longueurs, bornes) et 6 tests du point d’entrée public, base et e-mail simulés. Les refus sont vérifiés avant l’appel à admin(), insert() ou sendTemplateEmail(). Aucun e-mail réel envoyé. Les deux derniers cas refusent explicitement `https:atelier.fr` et `http:/atelier.fr`, acceptés par le parseur URL mais contraires au préfixe demandé.
- **Premier passage local complet : 316 fichiers, 3 889 tests réussis**, un worker, délai de test 30 s, avant ajout de ces deux cas URL. Le dernier commit est de nouveau soumis à la suite complète en CI ; ce nombre historique n’est pas présenté comme le nombre de la dernière CI.
- **TypeScript réussi**, lint sans erreur (19 avertissements existants au premier passage).
- **Build `node scripts/buildMaReliure.mjs` réussi**, vérification du projet public attendu dans l’artefact ; aucune publication.
- **Recette candidature : 2/2**, bureau 1280 × 900 et mobile 375 × 812 réels. Deux refus successifs, dont au clavier ; e-mail/téléphone/site/expérience/consentement ; attributs de limites ; ville absente acceptée jusqu’au serveur simulé ; refus de ce serveur rattaché à l’e-mail sans faux succès. Aucune requête extérieure ou inattendue. Captures [bureau](binder-application-validation-20261021/refus-1280.png) et [mobile](binder-application-validation-20261021/refus-375.png).
- **Recette client existante : 4/4**, français et anglais, bureau et iframe mobile 375 px, server functions simulées.

Les premiers essais navigateur ont échoué sur la synchronisation avec une route découpée : le signal de la racine peut être présent avant l’interactivité de son contenu. La recette valide maintenant une bascule réelle d’un savoir-faire avant de tester les refus. Aucun délai fixe ni clic forcé n’est utilisé pour prétendre la page interactive. Le focus est lui-même déclenché après le rendu des erreurs. Les traces des essais échoués sont conservées hors dépôt ; elles ne sont pas présentées comme des passages réussis. Sous Windows, le serveur Vite de la recette est resté ouvert pendant le nettoyage Playwright : fermeture du seul processus frais identifié, puis sortie du runner confirmée à 0.

La CI rejoue les tests unitaires, la recette client existante et les deux cas de candidature. Commande ciblée de recette :

```sh
npx playwright test --config playwright.partners.config.ts
```

Aucune migration, écriture de production, candidature réelle, compte, achat, paiement, e-mail, fusion de PR ou déploiement.
