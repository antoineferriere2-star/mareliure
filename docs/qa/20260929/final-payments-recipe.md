# Recette paiements — complément du 29 septembre 2026

Cible unique : `qwfhebtxeubfmvvdsqdt`. Serveur applicatif local de #51, Auth et base Supabase hébergées. Aucun Worker déployé, aucune migration, aucun paiement ni appel Stripe. La réconciliation n'a pas été rejouée.

## Avoir téléchargé depuis le bouton : réussi

Chromium Playwright isolé, connexion par e-mail/mot de passe du compte QA A, ouverture de sa facture puis clic sur **Télécharger l’avoir PDF**. L'événement navigateur `download` est capturé, puis `saveAs` enregistre les octets réellement reçus. Aucun échec de téléchargement.

- Nom proposé : `avoir-A-2026-0001.pdf` ; 2 697 octets ; en-tête `%PDF-`.
- SHA256 : `bf59b0a518d6810017b12c35c9e2a79f8f9244fb29b0818d0ffadeaf1c55cf8e`.
- Lecture du fichier avec pypdf : une page, titre AVOIR, référence A-2026-0001, facture F-2026-0001, montant 100,00 €, motif d'annulation fictive intégrale. Aucun IBAN. Le texte précise que l'avoir ne prouve pas le remboursement.
- Même fonction HTTP avec l'atelier B et sans session : erreur applicative sérialisée, **aucun PDF**. Le transport TanStack utilise HTTP 200 pour ces erreurs ; ce statut seul ne constitue pas une autorisation.

Preuves sans secrets : `credit-button-evidence.json`, `credit-button-content.json`. Les anciens timeouts de l'outil navigateur ne sont plus le résultat final du contrôle de téléchargement.

## Demandes publiques existantes : réussite fonctionnelle HTTP

Les deux demandes avaient été réellement soumises dans le navigateur (sessions `submitted`, photo privée contrôlée). Elles sont poursuivies, sans en créer de nouvelles :

- Ma Reliure : `8c6505a5-8013-409c-b15f-17b79520745b`.
- Fine Bindery : `dae7e3ed-6167-479f-a915-16eeda1013b3`.

Des comptes clients QA `example.invalid` vérifiés et un compte administrateur QA distinct ont été préparés avec Supabase Auth. `listMyCustomerCases` rattache les demandes via l'adresse vérifiée. Les données de prix sont des fixtures explicites (100 € HT), pas des tarifs commerciaux proposés. La sélection concerne uniquement l'atelier QA B.

Les fonctions applicatives authentifiées `createCommercialProposal` et `validateCommercialProposalTax` créent et valident les propositions. `acceptMyProposal`, appelé avec la session réelle du propriétaire, enregistre l'accord. `getMyCustomerCase` confirme la consultation ; le compte de l'autre client est refusé. `getBinderCase` autorise l'atelier B sélectionné et refuse l'atelier A non approuvé. Les deux propositions sont `accepted`, avec date d'accord, montant fictif de 120 € TTC et circuit **legacy_resale**. Aucun Checkout n'est appelé.

Le précontrôle du rattrapage global a trouvé **zéro dossier manquant** et seulement quatre dossiers non classés, tous créés par cette recette. Aucune ancienne démonstration n'était concernée.

Preuve : `public-completion-http-evidence.json`. Ces appels utilisent les mêmes fonctions serveur que les boutons, les JWT réels et les règles d'accès de l'application. Ils prouvent le traitement et les refus côté serveur ; **ils ne prouvent pas le clic du client sur son bouton d'accord ni l'intégralité du rendu final**. La tentative navigateur de cette séquence n'a pas abouti sur la machine locale ralentie ; elle n'est pas comptée comme réussie.

Contrôle supplémentaire : A a été temporairement approuvé, puis testé sans affectation aux deux dossiers. Les deux lectures sont refusées. Son statut initial a été restauré dans un `finally`. Cela vérifie le refus d'un atelier **approuvé mais non sélectionné**, séparément du refus d'un atelier en attente. Preuve : `public-approved-cross-evidence.json`.

## Fine Bindery : limites historiques distinctes

La mission générale de recette reprend le playbook historique : une phrase narrative française reste visible dans la confirmation anglaise et le lien de résumé absolu désigne Ma Reliure. Ces éléments précèdent #51. La recette n'a jamais suivi ce lien vers la production. Le parcours depuis un profil Fine Bindery publié n'est pas couvert par ces deux demandes générales. La copie des langues lors du tri est réservée dans le code historique aux demandes issues d'un profil ; les colonnes de langue du dépôt général ne prouvent donc pas ce parcours.

## Matrice

| Contrôle | Résultat |
|---|---|
| Bouton avoir → fichier reçu → contenu | Réussi |
| Refus avoir autre atelier / session absente | Réussi |
| Dépôt public des deux marques, Auth client, proposition, accord et lecture atelier via fonctions applicatives | Réussi |
| Absence de bascule des nouveaux dossiers réseau hors revente historique | Réussi |
| Accord client et lecture finale entièrement cliqués dans le navigateur | Non testé jusqu'au bout |
| Playbook Fine Bindery intégralement anglais / lien de résumé de sa propre marque | Échec historique identifié, pas une régression #51 |
| Checkout / argent réel / nouveaux circuits payants | Non testé et volontairement verrouillé |

Les résultats antérieurs des règlements déclarés, remboursements, litiges, avoir intégral et accès privés restent dans `hosted-qa-results-20260929.md`. Les types ont déjà été régénérés depuis la recette et reportés par périmètre ; aucune modification de schéma pendant ce complément.

La CI doit être contrôlée sur le nouveau HEAD documentaire. Ne pas transformer la réussite SQL ou HTTP en réussite des scénarios navigateur encore non exécutés.
