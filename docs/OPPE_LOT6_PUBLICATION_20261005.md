# Publication Oppe, lot 6 — 5 octobre 2026

## État attesté

PR [#86](https://github.com/antoineferriere2-star/mareliure/pull/86) fusionnée. Code applicatif : `13f18d60e7c148fad99cebe8923303b30022f8aa` sur main. Le bundle préparé depuis `ed71caa452229e208c2eaa0a0088d68ba86820fa` a exactement le même code applicatif, migrations et scripts que ce commit de fusion.

Worker Ma Reliure, servant également Fine Bindery : `cbd5667f-3585-495a-addd-895842adf7c7`, 100 %, reçu Cloudflare du **5 octobre 2026 à 17:18:25 UTC**. Déploiement : `1fd43ae4-89f0-42ca-a915-9726373ba171`. Compatibilité `2026-09-25`, `nodejs_compat`, CPU 1 000 ms. Les 15 liaisons et secrets existants sont conservés.

Production : **107 migrations**, dernière `20261006140000`. Les quatre ateliers présents restent gratuits. `subscription_open=false`, `online_payment_open=false` ; les annonces publiques B/C restent fermées. A reste en production.

## Contenu publié

- B : écran abonnement, accord explicite du propriétaire, Checkout et portail, synchronisation Stripe, droits en base et conservation des documents historiques. Le service payant reste fermé.
- Vitrine : aperçu privé, publication explicite, rendu partagé MR/FB et route Ma Reliure `/ateliers/$slug`.
- Facturation atelier : avoirs partiels par prestation, plafonds et reprise sans doublon, avoir du reliquat. Compatibilité franchise TVA et anciens documents sans ventilation ; aucun taux nouveau déduit d’un catalogue.
- C : socle de paiement direct sur le compte de l’atelier, frais Oppe 3 % du TTC et frais Stripe distincts, liens privés, preuves de paiement, remboursements adossés aux avoirs et webhook dédié. L’encaissement reste fermé et sa recette Connect complète reste nécessaire.
- Transport clients propres : rattachement facture, payeur, coût et couverture dans le journal déclaratif. Aucun achat d’étiquette ni extension du forfait Oppe.
- Anciennes descriptions de commission remplacées, conditions ateliers et dossier de reprise mis à jour.

## Preuves

CI de la PR et [CI main](https://github.com/antoineferriere2-star/mareliure/actions/runs/37346674243) vertes : TypeScript, lint, tests, build et contrôles de publication. La suite comporte 3 498 tests ; 19 contrôles de publication. Le build de production vérifie que le bundle client vise uniquement `hljxohondjvrkzqicexl` et contrôle les incompatibilités serveur connues avec workerd.

Sauvegarde complète fraîche, format pg_dump custom : **1 207 410 octets**, 1 614 entrées TOC, SHA256 `81c4cf1f7e61e4acf04531bee3f1744a7861573c9dc4b23b65ead4d226138793`. Restauration PostgreSQL 17 ; huit diagnostics exclusivement liés à Supabase Vault, extension indisponible localement. Les tables métier et les 102 migrations initiales sont restaurées. Comparaison en UTC des douze empreintes historiques avec la production : identiques.

Les cinq migrations puis le script exact d’application transactionnelle sont répétés sur des restaurations distinctes. Application réelle unique, TLS `verify-full`/TLS 1.3, garde d’identité, historique attendu, empreintes avant/après, ouvertures fermées et gratuité contrôlées. Marqueur `publication_commit_confirmed`, reçu `committed`, puis contrôle distant en lecture seule.

qwf uniquement : sauvegarde, 108 migrations ; aperçu privé, gratuité et fermetures B/C vérifiés. Facture fictive : avoir partiel depuis l’interface, reprise RPC sans doublon, avoir du reliquat, montants HT/TVA/TTC exacts et facture originale inchangée.

Abonnement Stripe **test** avec propriétaire fictif isolé : accord enregistré, activation, maintien des droits lors d’une résiliation à échéance, suspension après résiliation effective et événement ancien sans rétablissement. Les ouvertures qwf sont ensuite refermées et la gratuité de la fixture rétablie. Ce test technique n’atteste pas la fiscalité du Checkout, le portail ni les e-mails.

Smoke production : **28 contrôles réussis**, pages publiques et nouvelles routes sur les deux marques, mobile/ordinateur, redirection de l’espace privé vers l’authentification, vitrine inexistante indisponible, aucune erreur JavaScript ni débordement. Trois contrôles initialement exécutés avant la fin du chargement sont repris en attendant le rendu attendu ; preuves initiales conservées. Les deux webhooks historiques renvoient 400 sans signature sur les deux domaines. HTTP redirige vers HTTPS en 301.

Preuves opérationnelles et sauvegardes non versionnées : `D:/CodexProjects/oppe-model-operation/`. Les secrets et les dumps ne sont jamais joints à Git.

## Retour arrière

Worker précédent réellement actif avant bascule : `b812e4cc-a6ea-4050-81a8-508044caed0c`, source `77af584`.

Fermer B/C, garder les documents et les webhooks. **Après émission d’avoirs partiels en production, ce Worker ancien ne constitue plus un retour arrière complet**, car il suppose un seul avoir par facture. Préférer alors une correction compatible avec plusieurs avoirs. Ne pas supprimer de migration ou de document pour revenir en arrière.

## Travail restant avant les ouvertures

1. Suite Stripe live : intégration maintenant connectée, identité publique relue et anomalies Securicom/BTP confirmées ; correction en attente de connexion au Dashboard. Catalogue B et portail live créés, événements abonnement ajoutés, webhook Connect créé et secret déployé. Nouveau Worker `8f9d80ce-82a3-4848-8e9a-0bc1edc383ae`, même code, 16 liaisons, 12 contrôles HTTP réussis et B/C toujours fermés. Voir [le reçu Stripe live](OPPE_STRIPE_LIVE_PREPARATION_20261005.md).
2. Validation de l’expert-comptable sur la TVA et revue juridique des clauses : non obtenues. Stripe Tax actif mais aucune immatriculation enregistrée ; compléter sur décision comptable, puis recette hébergée Checkout, portail, facture, e-mail et résiliation.
3. Connect C : secret et événements configurés ; activation de la plateforme live non attestée. Revoir Accounts v2 pour cette nouvelle intégration, terminer la configuration d’un atelier français et éprouver succès/refus/asynchrone, remboursement partiel/total, litige, e-mails et frais réels. Un Checkout complété en échec nécessite encore une reprise d’exploitation avant nouvelle tentative ; cette limite interdit de présenter C comme entièrement prêt.
4. Secrets Sendcloud, conditions de couverture et test physique réel d’aller-retour : non effectués.
5. Premier paiement réel de faible montant et remboursement : non effectués ; aucun débit réel par ce chantier.
6. Offre internationale : tarifs, pays, devises, transport, couverture, douanes et fiscalité à établir avec des données réelles avant ouverture. Aucun forfait international inventé.

Voir [OPPE_BC_COMPLETION.md](OPPE_BC_COMPLETION.md) pour le périmètre technique et les indicateurs d’ouverture. L’activation en base et les annonces publiques doivent être mises en cohérence uniquement après les validations et recettes correspondantes.
