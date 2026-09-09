# Provenance des images — Ma Reliure

Toute image publiée commercialement par Ma Reliure figure dans ce registre.
Une image absente d'ici ne doit pas être mise en ligne.

La règle tient en une phrase : **on ne publie jamais la photographie d'un
atelier partenaire sans une autorisation identifiable.** Ce document est cette
identification. Il vit dans Git parce qu'une autorisation qui n'existe que dans
une conversation ne se retrouve pas le jour où quelqu'un la conteste.

---

## Les quatre natures d'image

| Nature               | Ce que c'est                                                             | Publiable                |
| -------------------- | ------------------------------------------------------------------------ | ------------------------ |
| `REAL_PORTFOLIO`     | Une pièce réellement réalisée par un atelier identifié                   | Oui, créditée            |
| `EDITORIAL_LICENSED` | Image sous licence, illustrative, ne représentant le travail de personne | Oui, sans crédit atelier |
| `PLACEHOLDER`        | Cadre en attente d'une vraie image                                       | Non                      |
| `DEMO`               | Image de démonstration produit                                           | Non                      |

La distinction qui compte est la dernière colonne, et elle n'a qu'un objet :
**une image `PLACEHOLDER` ou `DEMO` ne doit jamais être présentée comme un
travail réellement réalisé**, ni par Ma Reliure ni par un atelier. C'est la
même discipline que pour les tarifs — voir
[`pricing-reference-system.md`](./pricing-reference-system.md) : ne pas
fabriquer une preuve qu'on n'a pas.

Un crédit n'est pas une politesse. Sans lui, montrer la reliure d'un atelier
sur le site de Ma Reliure laisse croire que le chantier est passé par nous.

---

## Registre

Toutes les images ci-dessous sont encodées en WebP, qualité 76, aux largeurs
listées dans `src/marketplace/pages/landing/photos.ts`. Les noms de fichiers
disent l'emplacement, pas le sujet : quand une photographie est remplacée,
c'est l'emplacement qui reste stable.

### Atelier Reliure Dorure Ferrière — Orléans

**Propriétaire :** Reliure Dorure Ferrière (`reliure-ferriere.fr`)
**Autorisation :** confirmée par le titulaire des droits, oralement et par
écrit dans le fil de développement du 8 septembre 2026.
**Usage autorisé :** mareliure.fr et réseaux sociaux de Ma Reliure.
**Crédit à afficher :** « Atelier Ferrière » ou « Reliure Dorure Ferrière ».
**Date d'ajout :** 8 septembre 2026.

| Fichier                             | Nature           | Sujet                                      | Crédité en page |
| ----------------------------------- | ---------------- | ------------------------------------------ | --------------- |
| `mains-dorure`                      | `REAL_PORTFOLIO` | Pose de la feuille d'or sur un dos à nerfs | Non (hero)      |
| `atelier-presse`                    | `REAL_PORTFOLIO` | La presse, les cahiers en attente          | Non             |
| `livre-ancien`                      | `REAL_PORTFOLIO` | Ouvrage ancien et outils de restauration   | Non             |
| `coffrets-toile`                    | `REAL_PORTFOLIO` | Coffrets et emboîtages en toile            | Oui             |
| `reliure-bordeaux`                  | `REAL_PORTFOLIO` | Reliure cuir, brocart et dorure            | Oui             |
| `reliures-dorees`                   | `REAL_PORTFOLIO` | Pile de dos dorés sur l'établi             | Oui             |
| `syrie-avant` / `syrie-apres`       | `REAL_PORTFOLIO` | Restauration documentée, avant/après       | Oui             |
| `academie-avant` / `academie-apres` | `REAL_PORTFOLIO` | Restauration documentée, avant/après       | Oui             |
| `ferriere-baudelaire`               | `REAL_PORTFOLIO` | Pièce de l'atelier                         | Oui             |
| `ferriere-omnia`                    | `REAL_PORTFOLIO` | Pièce de l'atelier                         | Oui             |
| `ferriere-doublures`                | `REAL_PORTFOLIO` | Doublures décorées                         | Oui             |
| `ferriere-larousse`                 | `REAL_PORTFOLIO` | Pièce de l'atelier                         | Oui             |

**Note sur les crédits partiels.** Trois images ne portent pas de crédit
visible : le hero et deux illustrations d'univers. C'est délibéré — elles
montrent un geste et un lieu, pas une pièce finie attribuable. Les six images
qui montrent un ouvrage terminé sont créditées, ainsi que les quatre
avant/après, parce que ce sont elles qui pourraient être prises pour des
réalisations de Ma Reliure.

**Note sur les avant/après.** Ce sont de vrais ouvrages, vraiment restaurés.
C'est la seule raison pour laquelle la section avant/après existe : sans
chantier réel, elle n'aurait pas été construite.

---

## Ce qu'il faut faire avant d'ajouter une image

1. Identifier le propriétaire. Si c'est un atelier partenaire, obtenir son
   autorisation écrite pour l'usage précis prévu.
2. Ajouter une ligne à ce registre **avant** de committer le fichier.
3. Décider du crédit. En cas de doute, créditer : un crédit de trop n'a jamais
   nui à personne, un crédit manquant si.
4. Encoder aux largeurs déclarées dans `photos.ts` et déclarer l'entrée.

Une image de personne identifiable demande en outre l'autorisation de la
personne, distincte de celle du propriétaire de la photographie.

---

## Ce que ce registre ne couvre pas

Les photographies **envoyées par un client** dans son Project Intake. Elles
vivent dans le bucket `project-photos` de Supabase, appartiennent au client, et
ne sont jamais publiées. Leur usage est interne au dossier : qualification,
mise en relation avec l'atelier, constat d'état. Les republier demanderait une
autorisation qui n'a jamais été demandée à personne.
