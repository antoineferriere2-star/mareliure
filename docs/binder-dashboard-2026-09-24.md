# Tableau de bord relieur « Aujourd'hui » — note technique (24 septembre 2026)

Branche `feat/binder-dashboard-optimization`. Aucune migration, aucun type
régénéré, aucun déploiement.

## Ce que l'écran affiche, et d'où vient chaque chiffre

| Élément | Source | Règle |
| --- | --- | --- |
| Nouvelles demandes | `listMyBinderCases` | état `offered` ou `invited`, dossier non clos |
| Messages non lus | `listMyBinderCases.unreadCount` | somme brute |
| Devis envoyés / à relancer | `getMyQuotes` | `sent` ; relance si `valid_until` ≤ aujourd'hui + 7 jours, « validité dépassée » après |
| Ouvrages en cours | `getMyWorks` | `status = active` |
| Paiements attendus / en retard | `getMyInvoices` | `unpaid` ou `deposit_paid` ; retard si `due_date` < aujourd'hui (Paris) |
| Accès aux demandes | `getMyBinderProfile.status` | `approved` |
| Devis et factures | `getBillingProfile` + `profileReadiness(…, "invoice")` | la règle existante de l'émission |
| Profil public | `getMyFineBinderyProfile` | `profileStatus`, `missing` |

La logique est pure et testée dans `src/marketplace/binders/todayAgenda.ts`.
Une source en échec s'affiche « — / donnée indisponible », jamais 0.

Correctif serveur inclus : `listInvoices` renvoyait `payment_status` pour une
facture annulée par avoir (`status = credited`), qui se lisait donc « Non
payée » et aurait gonflé les paiements attendus. Elle porte désormais le statut
`credited` (« Annulée par avoir »), et la liste expose `dueDate`.

## Limites connues

- **Relance d'un devis** : fondée sur la fin de validité, faute de date d'envoi.
  `marketplace_binder_quotes` n'a pas de `sent_at` ; une relance « envoyé il y a
  N jours » demanderait cette colonne (migration + écriture dans
  `setQuoteStatus`). Non implémenté ici.
- **Offres Ma Reliure qui expirent** : `marketplace_quotes.expires_at` existe
  mais `listMyBinderCases` ne l'expose pas. L'ajouter au select suffirait (pas
  de migration) ; laissé hors périmètre pour ne pas toucher à
  `marketplace.data.functions.ts`, modifié par PR #31 pendant ce chantier.
- **Langue** : l'écran reste en français. Depuis PR #31, la navigation de
  l'espace atelier est traduite (`FineBinderyWorkspaceContext`) ; le tableau de
  bord peut suivre dans une PR dédiée, avec les dictionnaires DE/IT/ES/EN.
- **Clés de cache** : `LeadsPage` et `BinderCasePage` lisent encore devis et
  ouvrages sous `["binder", …]` au lieu de `QUOTES_KEY` / `WORKS_KEY` ; à aligner
  dans une PR séparée (fichiers touchés par PR #31, laissés intacts ici).
