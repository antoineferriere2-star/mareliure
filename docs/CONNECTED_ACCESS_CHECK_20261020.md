# Contrôle administrateur connecté après réduction des droits — 20 octobre 2026

Contrôle effectué le **20 octobre au matin, heure de Paris**, dans le navigateur intégré, en réutilisant la session du propriétaire déjà ouverte sur `https://mareliure.fr/admin`. Aucune nouvelle connexion ni changement de compte. Navigation seulement : aucun bouton d'action métier utilisé.

Base documentaire : `origin/main 57499b4f9314cef39622fd72c6eb3881739ce1cc`. Production annoncée par le brief : code `6ba5dc9`, Worker `b819469f`, 123 migrations. Ces identifiants n'ont pas été réinterrogés en production pendant ce contrôle.

| Page lue | Constat dans l'interface | Console `warn` / `error` après lecture |
| --- | --- | --- |
| Tableau de bord `/admin` | Sections et indicateurs chargés ; neuf dossiers, aucun plan ni étiquette. | Aucun message. |
| Liste `/admin/leads` | Neuf dossiers affichés. | Aucun message. |
| Dossier de test existant RL-006 | Dossier et photos chargés ; section « Acheminement du livre » affichée, avec « Aucun plan logistique : le client n'a pas encore choisi. » | Aucun message. |
| Liste `/admin/ateliers` | Atelier réel affiché ; groupe des ateliers de démonstration visible, non ouvert. | Aucun message. |

La logistique se présente comme une **section du dossier**, déjà affichée, et non comme un onglet distinct dans l'interface observée. Aucun écran vide persistant, message « permission denied » ou erreur 500 visible n'a été observé sur ces pages. Les lectures de console après chacune de ces étapes ont renvoyé une liste vide.

## Portée du résultat

Le parcours de lecture administrateur demandé fonctionne dans cette session après la réduction des droits. Cela ne vérifie pas les sessions client ou atelier, les écritures, un plan logistique rempli, un téléchargement d'étiquette, ni les circuits de paiement. Aucun plan n'étant présent dans les pages lues, leur affichage détaillé n'a pas été exercé.

La console et l'interface ont été lues ; les journaux du Worker et une trace exhaustive des réponses réseau n'ont pas été consultés. « Aucun 500 observé » ne signifie donc pas que tous les endpoints de l'application ont été vérifiés. Aucun relevé de contacts, montant, identifiant interne ou capture contenant des données personnelles n'est publié.

## Réserve sur la lecture seule stricte

La relecture du code **après** cette navigation révèle un effet automatique qui aurait dû être vérifié avant l'ouverture du dossier : `CaseMatchingPage.tsx` monte `AdminConversations`, qui monte `ConversationPanel`. Son effet d'ouverture appelle `markConversationRead` (`src/marketplace/pages/ConversationPanel.tsx`, effet commenté « Opening the panel counts as reading it »). La fonction serveur effectue un `upsert` dans `marketplace_conversation_reads` avec `last_read_at` (`src/marketplace/services/messaging.data.functions.ts`, handler `markConversationRead`). Ce code est présent dans la base produit `6ba5dc9`.

**La navigation demandée peut donc avoir mis à jour un horodatage de lecture. Une lecture seule stricte de la base n'est pas certifiée pour ce contrôle connecté.** Aucun bouton métier n'a été utilisé, mais cela ne supprime pas cet effet de montage. Aucun relevé réseau ou SQL ne permet ici de confirmer l'exécution ou le résultat de l'upsert ; la console vide n'est pas une preuve suffisante. Le propriétaire en a été informé. Un contrôle futur strictement sans écriture devra bloquer cet appel automatique avant d'ouvrir le dossier.

Aucune modification explicite des dossiers, ateliers ou plans, aucun compte créé, aucun e-mail, achat Sendcloud, paiement, fusion ou déploiement.
