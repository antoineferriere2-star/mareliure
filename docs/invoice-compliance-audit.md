# Audit de conformité du module Factures

Audit réalisé le 23 septembre 2026 avant modification du module.

## État initial conservé

- Les montants sont recalculés côté serveur en centimes et les lignes gardent leurs taux de TVA. Une ventilation multi-taux existe déjà.
- Le vendeur, le client, les lignes, les montants et la mention de TVA sont copiés dans la facture : une modification ultérieure du profil ne réécrit pas l'historique.
- La fonction PostgreSQL de conversion verrouille le devis, attribue un numéro et écrit facture et lignes dans une même transaction. Le compteur est atomique et l'unicité est garantie par `(binder_id, invoice_number)`.
- Les tables sont en RLS deny-all pour `anon` et `authenticated`; les accès serveur filtrent aussi par `binder_id`.
- Une facture émise et ses lignes sont protégées contre la modification.

## Écarts constatés

L'action actuelle crée directement une facture numérotée et figée. Elle ne permet pas de compléter puis valider un brouillon. Les dates de prestation et d'échéance, le type et l'identité juridique du client, la nature de l'opération, les adresses distinctes, les conditions d'escompte et de pénalités ne sont pas snapshotées. La table principale ne bloque pas explicitement `DELETE`. Aucun avoir n'est modélisé. Les champs de préparation à la facturation électronique ont des noms historiques incomplets et aucune interface fournisseur.

## Référentiel retenu

- L'[article L441-9 du Code de commerce](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038414397/2026-05-11) fonde les mentions B2B : parties, adresse de facturation, date de prestation, désignation/quantité/prix HT/remise, échéance, escompte, pénalités et indemnité forfaitaire de 40 €.
- La fiche officielle [Mentions obligatoires sur une facture](https://www.service-public.fr/entreprendre/vosdroits/F31808) précise notamment le numéro unique dans une séquence chronologique continue, la date de prestation, l'identité du vendeur et la mention de franchise.
- La [présentation DGFiP de la facturation électronique](https://www.impots.gouv.fr/professionnel/je-decouvre-la-facturation-electronique) distingue e-invoicing et e-reporting et cite les formats UBL, CII et mixtes.
- Le [calendrier DGFiP](https://www.impots.gouv.fr/professionnel/questions/partir-de-quand-suis-je-concerne-par-la-reforme-de-la-facturation) prévoit la réception pour toutes les entreprises au 1er septembre 2026 et l'émission des PME et microentreprises au 1er septembre 2027.
- Seules les [plateformes agréées](https://www.impots.gouv.fr/facturation-electronique-et-plateformes-agreees) assureront les transmissions. Aucun fournisseur n'est donc présumé dans cette évolution.
- Les pièces comptables et factures sont conservées dix ans selon [Service Public Entreprendre](https://entreprendre.service-public.fr/vosdroits/F10029).

## Décision d'architecture

La facture existante devient un document à deux états : `draft`, modifiable sans numéro, puis `issued`, numéroté atomiquement et immuable. Les factures historiques sont reprises comme `issued` sans modifier leurs données métier. Le devis reste la source initiale des lignes et montants; le brouillon reçoit les champs administratifs manquants. L'émission fige les mentions calculées par le validateur.

La rectification passe par un avoir immuable rattaché à la facture. Les identifiants de transmission sont réservés, avec un provider manuel qui ne transmet rien. La génération Factur-X est volontairement séparée : voir `docs/factur-x-feasibility.md`.

Le futur routeur de transmission devra décider à partir du snapshot, après validation des règles alors applicables : entreprise établie en France vers l'e-invoicing, particulier ou opération hors périmètre vers l'e-reporting, et entité publique vers le circuit public. Cette évolution ne code aucune règle fiscale supposée et ne sélectionne aucune plateforme avant contractualisation.
