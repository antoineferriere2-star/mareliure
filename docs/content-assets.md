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

## Retrait du 9 septembre 2026 — cinq images générées

Cinq fichiers ont été supprimés du dépôt. Ils étaient enregistrés ici comme
`REAL_PORTFOLIO` de l'atelier Ferrière, autorisation confirmée. Ils ne
l'étaient pas : ils ont été générés.

| Fichier           | Emplacement           | Ce qui le trahissait                                                                           |
| ----------------- | --------------------- | ---------------------------------------------------------------------------------------------- |
| `mains-dorure`    | hero                  | Le fer à dorer n'a pas de géométrie cohérente ; la main droite ne se résout pas.               |
| `atelier-presse`  | univers « Réparer »   | La vis de la presse n'engage rien, le plateau flotte, les outils fondent dans l'étagère.       |
| `livre-ancien`    | univers « Restaurer » | Les nerfs ne correspondent pas au corps d'ouvrage ; les plioirs ne sont pas des objets.        |
| `reliures-dorees` | univers « Embellir »  | Les fers se répètent avec une régularité impossible ; les corps d'ouvrage fusionnent.          |
| `coffrets-toile`  | univers « Protéger »  | Un couvercle est simultanément ouvert et fermé. **Créditée « Atelier Ferrière » sur la page.** |

La dernière ligne est la faute la plus grave, et elle explique pourquoi ce
registre existe : on attribuait à un atelier réel une pièce qu'il n'avait pas
faite, d'un objet qui n'existe pas. Un registre rempli sans regarder les
images ne vaut rien — il donne seulement à une erreur l'apparence d'une
vérification.

**Ce qui a changé dans la méthode.** Ouvrir chaque fichier et le regarder est
désormais la première étape, avant d'écrire une ligne ici. Un test
(`landingHonesty.test.ts`) interdit nommément le retour de ces cinq fichiers,
sur le disque comme dans le code : il ne sait pas juger une image, mais il
empêche un `revert` distrait de les réintroduire en silence.

---

## Registre

### Atelier Reliure Dorure Ferrière — Orléans

**Propriétaire :** Reliure Dorure Ferrière (`reliure-ferriere.fr`)  
**Autorisation :** confirmée par le titulaire des droits, oralement et par
écrit dans le fil de développement du 8 septembre 2026.  
**Usage autorisé :** mareliure.fr et réseaux sociaux de Ma Reliure.  
**Crédit à afficher :** « Atelier Reliure Dorure Ferrière, Orléans ».  
**Vérification visuelle :** chaque fichier ouvert et examiné le 9 septembre 2026.

Ces neuf images ont en commun ce qui manquait aux cinq autres : un éclairage
d'atelier plat, des fonds neutres, une usure réelle, des lettres dorées
lisibles — « VIEWS IN SYRIA », « VENISE / RENÉ BARDOT » — et des défauts de
prise de vue que personne ne fabrique.

| Fichier                             | Nature           | Sujet                                                         | Où                 | Crédité |
| ----------------------------------- | ---------------- | ------------------------------------------------------------- | ------------------ | ------- |
| `ferriere-baudelaire`               | `REAL_PORTFOLIO` | Reliure de création, mosaïque de cuir, sur Le Spleen de Paris | Hero               | Oui     |
| `syrie-avant` / `syrie-apres`       | `REAL_PORTFOLIO` | Views in Syria, 3 vol., 1830 — avant/après restauration       | Réalisations       | Oui     |
| `academie-avant` / `academie-apres` | `REAL_PORTFOLIO` | Dictionnaire de l'Académie, 2 vol., XVIIIᵉ — avant/après      | Réalisations       | Oui     |
| `reliure-bordeaux`                  | `REAL_PORTFOLIO` | Maroquin bordeaux à plats de brocart, titré « Venise »        | Atelier            | Oui     |
| `ferriere-omnia`                    | `REAL_PORTFOLIO` | Trois volumes en demi-cuir à coins                            | Atelier, portfolio | Oui     |
| `ferriere-doublures`                | `REAL_PORTFOLIO` | Doublures décorées                                            | Atelier, portfolio | Oui     |
| `ferriere-larousse`                 | `REAL_PORTFOLIO` | Volumes reliés, dos ornés                                     | Atelier, portfolio | Oui     |

**Toutes créditées, sans exception.** Aucun de ces ouvrages n'est passé par Ma
Reliure : les montrer sans dire d'où ils viennent laisserait croire le
contraire.

### Extension du 24 septembre 2026 — les 45 prestations en images

Le titulaire des droits a confirmé dans le fil de développement du 24
septembre 2026 que Ma Reliure pouvait utiliser les photographies publiées sur
`reliure-ferriere.fr` pour illustrer les prestations. Cette extension couvre la
page publique `/tarifs`. Chaque carte porte le crédit « Atelier Reliure Dorure
Ferrière, Orléans » et renvoie vers la photographie source numérotée.

Les variantes `-320.webp` et `-640.webp` de chaque ligne sont des dérivés WebP
du même original, qualité 78, rotation EXIF appliquée, sans agrandissement. Les
45 originaux ont été ouverts et comparés visuellement avant intégration. Une
photographie peut montrer l'état reçu, le geste ou le résultat ; la page le dit
explicitement et ne présente pas ces ouvrages comme des projets Ma Reliure.

| Prestation | Fichiers dérivés | Source | Nature |
| --- | --- | --- | --- |
| `reemboitage` | `reemboitage-{320,640}.webp` | photo n°832 | `REAL_PORTFOLIO` |
| `reparation_dos` | `reparation_dos-{320,640}.webp` | photo n°564 | `REAL_PORTFOLIO` |
| `reparation_mors` | `reparation_mors-{320,640}.webp` | photo n°494 | `REAL_PORTFOLIO` |
| `reparation_coiffes` | `reparation_coiffes-{320,640}.webp` | photo n°496 | `REAL_PORTFOLIO` |
| `reparation_coins` | `reparation_coins-{320,640}.webp` | photo n°695 | `REAL_PORTFOLIO` |
| `reparation_plats` | `reparation_plats-{320,640}.webp` | photo n°746 | `REAL_PORTFOLIO` |
| `pages_detachees` | `pages_detachees-{320,640}.webp` | photo n°835 | `REAL_PORTFOLIO` |
| `couture_partielle` | `couture_partielle-{320,640}.webp` | photo n°456 | `REAL_PORTFOLIO` |
| `recouture_complete` | `recouture_complete-{320,640}.webp` | photo n°1031 | `REAL_PORTFOLIO` |
| `reparation_papier` | `reparation_papier-{320,640}.webp` | photo n°649 | `REAL_PORTFOLIO` |
| `gardes_neuves` | `gardes_neuves-{320,640}.webp` | photo n°757 | `REAL_PORTFOLIO` |
| `pleine_toile` | `pleine_toile-{320,640}.webp` | photo n°23 | `REAL_PORTFOLIO` |
| `demi_toile` | `demi_toile-{320,640}.webp` | photo n°29 | `REAL_PORTFOLIO` |
| `dos_cuir` | `dos_cuir-{320,640}.webp` | photo n°852 | `REAL_PORTFOLIO` |
| `demi_cuir` | `demi_cuir-{320,640}.webp` | photo n°153 | `REAL_PORTFOLIO` |
| `demi_cuir_a_coins` | `demi_cuir_a_coins-{320,640}.webp` | photo n°91 | `REAL_PORTFOLIO` |
| `plein_cuir` | `plein_cuir-{320,640}.webp` | photo n°1088 | `REAL_PORTFOLIO` |
| `dorure_titrage` | `dorure_titrage-{320,640}.webp` | photo n°1005 | `REAL_PORTFOLIO` |
| `dorure_auteur` | `dorure_auteur-{320,640}.webp` | photo n°1014 | `REAL_PORTFOLIO` |
| `dorure_tomaison` | `dorure_tomaison-{320,640}.webp` | photo n°968 | `REAL_PORTFOLIO` |
| `dorure_date` | `dorure_date-{320,640}.webp` | photo n°1115 | `REAL_PORTFOLIO` |
| `dorure_initiales` | `dorure_initiales-{320,640}.webp` | photo n°121 | `REAL_PORTFOLIO` |
| `dorure_filets` | `dorure_filets-{320,640}.webp` | photo n°1032 | `REAL_PORTFOLIO` |
| `dorure_fleurons` | `dorure_fleurons-{320,640}.webp` | photo n°543 | `REAL_PORTFOLIO` |
| `dorure_decor` | `dorure_decor-{320,640}.webp` | photo n°349 | `REAL_PORTFOLIO` |
| `nerfs` | `nerfs-{320,640}.webp` | photo n°991 | `REAL_PORTFOLIO` |
| `gardes_decorees` | `gardes_decorees-{320,640}.webp` | photo n°224 | `REAL_PORTFOLIO` |
| `papiers_marbres` | `papiers_marbres-{320,640}.webp` | photo n°860 | `REAL_PORTFOLIO` |
| `mosaique` | `mosaique-{320,640}.webp` | photo n°115 | `REAL_PORTFOLIO` |
| `signet` | `signet-{320,640}.webp` | photo n°556 | `REAL_PORTFOLIO` |
| `tranches` | `tranches-{320,640}.webp` | photo n°79 | `REAL_PORTFOLIO` |
| `decor_personnalise` | `decor_personnalise-{320,640}.webp` | photo n°483 | `REAL_PORTFOLIO` |
| `etui` | `etui-{320,640}.webp` | photo n°572 | `REAL_PORTFOLIO` |
| `chemise` | `chemise-{320,640}.webp` | photo n°987 | `REAL_PORTFOLIO` |
| `boite` | `boite-{320,640}.webp` | photo n°977 | `REAL_PORTFOLIO` |
| `coffret` | `coffret-{320,640}.webp` | photo n°201 | `REAL_PORTFOLIO` |
| `restauration_cuir` | `restauration_cuir-{320,640}.webp` | photo n°1004 | `REAL_PORTFOLIO` |
| `restauration_papier` | `restauration_papier-{320,640}.webp` | photo n°513 | `REAL_PORTFOLIO` |
| `restauration_cartonnage` | `restauration_cartonnage-{320,640}.webp` | photo n°268 | `REAL_PORTFOLIO` |
| `restauration_reliure_ancienne` | `restauration_reliure_ancienne-{320,640}.webp` | photo n°495 | `REAL_PORTFOLIO` |
| `restauration_patrimoniale` | `restauration_patrimoniale-{320,640}.webp` | photo n°298 | `REAL_PORTFOLIO` |
| `rebind_collector` | `rebind_collector-{320,640}.webp` | photo n°984 | `REAL_PORTFOLIO` |
| `nouvelle_couverture` | `nouvelle_couverture-{320,640}.webp` | photo n°814 | `REAL_PORTFOLIO` |
| `reliure_de_creation` | `reliure_de_creation-{320,640}.webp` | photo n°998 | `REAL_PORTFOLIO` |
| `projet_sur_mesure` | `projet_sur_mesure-{320,640}.webp` | photo n°320 | `REAL_PORTFOLIO` |

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

Les photographies **ajoutées par un atelier à une prestation de devis** ne
sont pas des ressources éditoriales du dépôt. Elles restent privées dans le
bucket `marketplace-quote-operation-photos` et ne sont utilisées que dans le
devis ou la facture de cet atelier, lorsque celui-ci coche leur inclusion au
PDF. L'atelier qui les téléverse confirme ainsi leur usage pour ce document ;
Ma Reliure ne les publie pas dans une galerie ni dans le site public.

Les **logos ajoutés par un atelier à ses documents** suivent la même règle. Ils
restent privés dans le bucket `marketplace-binder-document-logos`, sont servis
par URL signée et ne sont utilisés que dans les devis et factures de cet
atelier. Un fichier remplacé ou retiré reste conservé tant qu'un ancien
snapshot de document peut encore le référencer.
