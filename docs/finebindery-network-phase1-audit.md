# Audit Phase 1 — FineBindery Network

## A. Réutilisable

- `marketplace_binders` porte déjà l’identité, la ville, la présentation, le parcours, le slug personnel et le statut de validation.
- `marketplace_binder_skills` fournit dix spécialités structurées ; `reliure-fr-v1` fournit les clés techniques et matériaux.
- `marketplace_binder_portfolio` et le bucket privé `marketplace-binder-photos` existent déjà.
- Le parcours livre, les photos, les dossiers, les attributions et l’espace atelier sont communs aux deux marques.
- FineBindery possède déjà son identité éditoriale, sa résolution par domaine et ses fondations SEO.

## B. Manquant

- Coordonnées publiques, pays, langues, philosophie, photo d’atelier et état de publication.
- Consentement explicite et état public de chaque réalisation.
- Éditeur dans l’espace atelier, page publique, annuaire minimal et visibilité admin.
- Provenance `FINEBINDERY_PROFILE` et attribution directe à l’atelier ciblé.

## C. Migration

Une migration additive étend `marketplace_binders`, complète `marketplace_binder_portfolio` et élargit la provenance des dossiers. Aucun objet privé existant n’est publié par défaut.

## D. Composants

- Éditeur « Profil public » dans l’espace atelier.
- Page éditoriale `/fr/:slug` et annuaire `/professionnels`.
- Services serveur séparés pour les lectures publiques, les écritures propriétaire et les URLs signées.

## E. Sécurité

- RLS existante conservée : aucun accès direct navigateur aux tables ou au stockage.
- Publication réservée au propriétaire actif ; page visible seulement pour un atelier approuvé et publié.
- Une réalisation exige un consentement daté et une photo avant de devenir publique.
- Les projections publiques sélectionnent explicitement leurs colonnes et excluent clients, montants, documents, messages, notes et ouvrages privés.

## F. Découpage PR

Une seule PR : les données, l’édition, la page, le portfolio et la provenance forment un parcours testable unique. La migration reste non appliquée jusqu’à validation de la PR.
