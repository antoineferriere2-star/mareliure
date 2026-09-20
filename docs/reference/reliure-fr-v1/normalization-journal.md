# Journal de normalisation — reliure-fr-v1

Généré par `scripts/buildReliureReference.mjs` (rejouable, déterministe). **Rien n'est corrigé en silence** : chaque écart de l'audit du 20/09/2026 (A1–A11, V3, V4) est listé avec l'ancien contenu, le nouveau, la raison, le type de correction et l'impact. Le détail complet, entrée par entrée, est dans `journal.json`.

Source brute : `operations-reliure.json` (sha256 `d1ace276fdef51ad…`), `operations-relations.json` (sha256 `c8d6bab715353c21…`) — **hors du dépôt, jamais modifiée**. Les prix publics observés et les matériaux ne sont **pas lus** par ce script.

## Bilan

- Entrées : **195** — actives 194, importables dans un catalogue (operation + package + diagnostic, actives) **186**.
- Par nature : operation 162 · package 23 · diagnostic 1 · adjustment 5 · material_choice 3 · generic_quote 1.
- Entrées « à valider » (interne) : **79** (5 ajoutée(s) par la normalisation, source : 74).
- Relations : 35 séquences · 10 inclusions · 4 alternatives ; à valider : 27.

| Règle | Sujet | Corrections |
| --- | --- | ---: |
| A1 | Sens de `depends_on` ambigu | 26 |
| A2 | Contradictions et sources multiples de relations | 22 |
| A3 | Variante encodée comme prérequis | 3 |
| A4 | `commonly_bundled` en texte libre | 8 |
| A5 | Même paire typée deux fois | 1 |
| A6 | Unités et modes de prix mélangés | 59 |
| A7 | Entrées qui ne sont pas des opérations | 34 |
| A8 | Hiérarchie mélangée | 10 |
| A9 | Identifiants instables | 195 |
| A10 | Codes de domaine irréguliers | 1 |
| A11 | Champs promis mais vides ou boilerplate | 16 |
| V3 | Doublons fonctionnels probables | 6 |
| V4 | Termes ambigus pour un particulier | 0 |

## A1 — Sens de `depends_on` ambigu

**sens de la relation** (26) — *Raison :* Le gabarit du fichier est « `to` intervient habituellement après ou avec `from` » : lu littéralement, « from depends_on to » dit le contraire. Les colonnes sont désormais nommées par rôle. *Impact :* Sens inchangé, nom corrigé. C'est descriptif (« habituellement après ou avec »), jamais une contrainte.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0322 | REL-0001 | {"from":"OPR-0001-examen_de_l_ouvrage","to":"OPR-0002-constat_d_etat","type":"depends_on"} | {"prerequisite":"OPR-0001","dependent":"OPR-0002"} |
| J-0323 | REL-0002 | {"from":"OPR-0001-examen_de_l_ouvrage","to":"OPR-0011-debrochage","type":"depends_on"} | {"prerequisite":"OPR-0001","dependent":"OPR-0011"} |
| J-0324 | REL-0003 | {"from":"OPR-0004-collationnement","to":"OPR-0027-couture_de_cahiers","type":"depends_on"} | {"prerequisite":"OPR-0004","dependent":"OPR-0027"} |
| J-0325 | REL-0004 | {"from":"OPR-0028-grecquage","to":"OPR-0033-couture_a_la_grecque","type":"depends_on"} | {"prerequisite":"OPR-0028","dependent":"OPR-0033"} |
| J-0326 | REL-0005 | {"from":"OPR-0027-couture_de_cahiers","to":"OPR-0039-endossure","type":"depends_on"} | {"prerequisite":"OPR-0027","dependent":"OPR-0039"} |
| J-0327 | REL-0006 | {"from":"OPR-0039-endossure","to":"OPR-0042-formation_des_mors","type":"depends_on"} | {"prerequisite":"OPR-0039","dependent":"OPR-0042"} |
| J-0328 | REL-0007 | {"from":"OPR-0029-couture_sur_ficelles","to":"OPR-0038-passure_des_ficelles","type":"depends_on"} | {"prerequisite":"OPR-0029","dependent":"OPR-0038"} |
| J-0329 | REL-0008 | {"from":"OPR-0045-pose_de_nerfs_veritables","to":"OPR-0122-dorure_des_nerfs","type":"depends_on"} | {"prerequisite":"OPR-0045","dependent":"OPR-0122"} |
| J-0330 | REL-0009 | {"from":"OPR-0051-coupe_des_cartons","to":"OPR-0052-montage_des_plats","type":"depends_on"} | {"prerequisite":"OPR-0051","dependent":"OPR-0052"} |
| J-0331 | REL-0010 | {"from":"OPR-0052-montage_des_plats","to":"OPR-0061-couvrure","type":"depends_on"} | {"prerequisite":"OPR-0052","dependent":"OPR-0061"} |
| J-0332 | REL-0011 | {"from":"OPR-0074-parure_generale_du_cuir","to":"OPR-0061-couvrure","type":"depends_on"} | {"prerequisite":"OPR-0074","dependent":"OPR-0061"} |
| J-0333 | REL-0012 | {"from":"OPR-0061-couvrure","to":"OPR-0079-realisation_des_remplis","type":"depends_on"} | {"prerequisite":"OPR-0061","dependent":"OPR-0079"} |
| J-0334 | REL-0013 | {"from":"OPR-0061-couvrure","to":"OPR-0049-formation_des_coiffes","type":"depends_on"} | {"prerequisite":"OPR-0061","dependent":"OPR-0049"} |
| J-0335 | REL-0014 | {"from":"OPR-0081-pose_de_gardes_blanches","to":"OPR-0072-emboitage","type":"depends_on"} | {"prerequisite":"OPR-0081","dependent":"OPR-0072"} |
| J-0336 | REL-0015 | {"from":"OPR-0107-pose_de_piece_de_titre","to":"OPR-0110-dorure_sur_piece_de_titre","type":"depends_on"} | {"prerequisite":"OPR-0107","dependent":"OPR-0110"} |
| J-0337 | REL-0016 | {"from":"OPR-0101-preparation_a_la_dorure","to":"OPR-0103-titrage_au_dos","type":"depends_on"} | {"prerequisite":"OPR-0101","dependent":"OPR-0103"} |
| J-0338 | REL-0017 | {"from":"OPR-0101-preparation_a_la_dorure","to":"OPR-0109-dorure_directe_sur_cuir","type":"depends_on"} | {"prerequisite":"OPR-0101","dependent":"OPR-0109"} |
| J-0339 | REL-0018 | {"from":"OPR-0102-composition_typographique","to":"OPR-0103-titrage_au_dos","type":"depends_on"} | {"prerequisite":"OPR-0102","dependent":"OPR-0103"} |
| J-0340 | REL-0019 | {"from":"OPR-0126-mosaique_incrustee","to":"OPR-0131-dorure_associee_a_mosaique","type":"depends_on"} | {"prerequisite":"OPR-0126","dependent":"OPR-0131"} |
| J-0341 | REL-0020 | {"from":"OPR-0012-depose_de_la_couverture","to":"OPR-0022-montage_de_couverture_conservee","type":"depends_on"} | {"prerequisite":"OPR-0012","dependent":"OPR-0022"} |
| J-0342 | REL-0021 | {"from":"OPR-0013-depose_du_dos","to":"OPR-0139-remontage_d_ancien_dos","type":"depends_on"} | {"prerequisite":"OPR-0013","dependent":"OPR-0139"} |
| J-0343 | REL-0022 | {"from":"OPR-0016-reparation_de_cahier","to":"OPR-0036-couture_complete","type":"depends_on"} | {"prerequisite":"OPR-0016","dependent":"OPR-0036"} |
| J-0344 | REL-0023 | {"from":"OPR-0157-etui_simple","to":"OPR-0172-titrage_de_boite","type":"depends_on"} | {"prerequisite":"OPR-0157","dependent":"OPR-0172"} |
| J-0346 | REL-0025 | {"from":"OPR-0175-decoupe_de_structure_de_boite","to":"OPR-0176-montage_de_structure_de_boite","type":"depends_on"} | {"prerequisite":"OPR-0175","dependent":"OPR-0176"} |
| J-0347 | REL-0026 | {"from":"OPR-0176-montage_de_structure_de_boite","to":"OPR-0174-habillage_de_boite","type":"depends_on"} | {"prerequisite":"OPR-0176","dependent":"OPR-0174"} |
| J-0348 | REL-0027 | {"from":"OPR-0061-couvrure","to":"OPR-0182-controle_final","type":"depends_on"} | {"prerequisite":"OPR-0061","dependent":"OPR-0182"} |

## A2 — Contradictions et sources multiples de relations

**prérequis redondant** (6) — *Raison :* Déjà décrit par une relation `operation_sequences`. *Impact :* Aucune perte.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0349 | OPR-0002 ← OPR-0001 | {"entry":"OPR-0002","prerequisites":"OPR-0001-examen_de_l_ouvrage"} | — |
| J-0353 | OPR-0011 ← OPR-0001 | {"entry":"OPR-0011","prerequisites":"OPR-0001-examen_de_l_ouvrage"} | — |
| J-0361 | OPR-0042 ← OPR-0039 | {"entry":"OPR-0042","prerequisites":"OPR-0039-endossure"} | — |
| J-0365 | OPR-0103 ← OPR-0101 | {"entry":"OPR-0103","prerequisites":"OPR-0101-preparation_a_la_dorure"} | — |
| J-0366 | OPR-0109 ← OPR-0101 | {"entry":"OPR-0109","prerequisites":"OPR-0101-preparation_a_la_dorure"} | — |
| J-0367 | OPR-0110 ← OPR-0107 | {"entry":"OPR-0110","prerequisites":"OPR-0107-pose_de_piece_de_titre"} | — |

**prérequis converti en relation** (9) — *Raison :* Le prérequis déclaré dans l'entrée n'était décrit nulle part ailleurs : il devient une relation `operation_sequences` explicite (descriptive), à valider. *Impact :* Nouvelle relation informative « habituellement après ou avec ».

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0350 | OPR-0003 ← OPR-0002 | {"entry":"OPR-0003","prerequisites":"OPR-0002-constat_d_etat"} | {"relation":"REL-0040","prerequisite":"OPR-0002","dependent":"OPR-0003"} |
| J-0351 | OPR-0006 ← OPR-0001 | {"entry":"OPR-0006","prerequisites":"OPR-0001-examen_de_l_ouvrage"} | {"relation":"REL-0041","prerequisite":"OPR-0001","dependent":"OPR-0006"} |
| J-0352 | OPR-0006 ← OPR-0002 | {"entry":"OPR-0006","prerequisites":"OPR-0002-constat_d_etat"} | {"relation":"REL-0042","prerequisite":"OPR-0002","dependent":"OPR-0006"} |
| J-0354 | OPR-0012 ← OPR-0001 | {"entry":"OPR-0012","prerequisites":"OPR-0001-examen_de_l_ouvrage"} | {"relation":"REL-0043","prerequisite":"OPR-0001","dependent":"OPR-0012"} |
| J-0359 | OPR-0038 ← OPR-0027 | {"entry":"OPR-0038","prerequisites":"OPR-0027-couture_de_cahiers"} | {"relation":"REL-0044","prerequisite":"OPR-0027","dependent":"OPR-0038"} |
| J-0360 | OPR-0041 ← OPR-0027 | {"entry":"OPR-0041","prerequisites":"OPR-0027-couture_de_cahiers"} | {"relation":"REL-0045","prerequisite":"OPR-0027","dependent":"OPR-0041"} |
| J-0362 | OPR-0052 ← OPR-0027 | {"entry":"OPR-0052","prerequisites":"OPR-0027-couture_de_cahiers"} | {"relation":"REL-0046","prerequisite":"OPR-0027","dependent":"OPR-0052"} |
| J-0364 | OPR-0102 ← OPR-0101 | {"entry":"OPR-0102","prerequisites":"OPR-0101-preparation_a_la_dorure"} | {"relation":"REL-0047","prerequisite":"OPR-0101","dependent":"OPR-0102"} |
| J-0368 | OPR-0110 ← OPR-0101 | {"entry":"OPR-0110","prerequisites":"OPR-0101-preparation_a_la_dorure"} | {"relation":"REL-0048","prerequisite":"OPR-0101","dependent":"OPR-0110"} |

**prérequis contredit (ordre d'atelier)** (1) — *Raison :* Dans l'ordre d'atelier usuel le grecquage précède la couture ; la relation REL-0004 place d'ailleurs Grecquage avant la couture à la grecque. Décision éditoriale à valider par un relieur du pilote. *Impact :* Retiré ; à valider par un relieur.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0355 | OPR-0028 ← OPR-0027 | {"entry":"OPR-0028","prerequisites":"OPR-0027-couture_de_cahiers"} | — |

**prérequis contredit** (1) — *Raison :* Le sens inverse est décrit par les relations (REL-0011) : l'ordre métier retenu est celui du fichier de relations. *Impact :* L'entrée n'est plus en contradiction avec les relations. À valider par un relieur.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0363 | OPR-0074 ← OPR-0061 | {"entry":"OPR-0074","prerequisites":"OPR-0061-couvrure"} | — |

**opération liée (hors des trois familles)** (1) — *Raison :* Paire déjà décrite dans operation_sequences. *Impact :* Aucune perte.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0377 | OPR-0033 ~ OPR-0028 | {"related_operations":"OPR-0028-grecquage"} | — |

**opération liée (hors des trois familles)** (3) — *Raison :* « Liée à » n'est ni une séquence, ni une inclusion, ni une alternative : pas de famille pour la porter. *Impact :* Information non reprise ; à réintroduire dans la bonne famille après relecture.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0378 | OPR-0041 ~ OPR-0039 | {"related_operations":"OPR-0039-endossure"} | — |
| J-0379 | OPR-0186 ~ OPR-0001 | {"related_operations":"OPR-0001-examen_de_l_ouvrage"} | — |
| J-0380 | OPR-0186 ~ OPR-0002 | {"related_operations":"OPR-0002-constat_d_etat"} | — |

**indicateur de validation des relations** (1) — *Raison :* La séquence exacte des opérations fait partie des zones à faire relire : aucune des 39 relations n'était marquée. *Impact :* Interne au pilotage du référentiel ; jamais affiché au relieur.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0381 | 39 relations d'origine | {"needs_binder_validation":"absent (jamais marqué)"} | {"needsBinderValidation":"true si créée par conversion, contredite, ou si une extrémité est à valider"} |

## A3 — Variante encodée comme prérequis

**variante codée comme prérequis** (3) — *Raison :* « est une variante de » n'est pas « nécessite » : la couture sur ficelles / nerfs / à la grecque est une variante de la couture de cahiers. *Impact :* Le lien de variante est conservé sous `variantOf` ; plus aucun prérequis.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0356 | OPR-0029 ← OPR-0027 | {"entry":"OPR-0029","prerequisites":"OPR-0027-couture_de_cahiers"} | — |
| J-0357 | OPR-0030 ← OPR-0027 | {"entry":"OPR-0030","prerequisites":"OPR-0027-couture_de_cahiers"} | — |
| J-0358 | OPR-0033 ← OPR-0027 | {"entry":"OPR-0033","prerequisites":"OPR-0027-couture_de_cahiers"} | — |

## A4 — `commonly_bundled` en texte libre

**texte libre non résolu** (5) — *Raison :* Le texte ne désigne aucune entrée (ou un domaine, pas une opération). *Impact :* Aucune relation créée ; l'information reste dans la source brute.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0369 | OPR-0021 ~ pose de gardes | {"commonly_bundled":"pose de gardes"} | — |
| J-0372 | OPR-0027 ~ apprêture du dos | {"commonly_bundled":"apprêture du dos"} | — |
| J-0373 | OPR-0064 ~ parure du cuir | {"commonly_bundled":"parure du cuir"} | — |
| J-0375 | OPR-0064 ~ remplis | {"commonly_bundled":"remplis"} | — |
| J-0376 | OPR-0064 ~ dorure | {"commonly_bundled":"dorure"} | — |

**texte libre résolu** (2) — *Raison :* Le texte désigne exactement une entrée : il devient une relation `operation_components` (« peut inclure »), à valider. *Impact :* Nouvelle relation informative.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0370 | OPR-0021 ~ emboîtage | {"commonly_bundled":"emboîtage"} | {"relation":"REL-0049","composite":"OPR-0021","component":"OPR-0072"} |
| J-0371 | OPR-0027 ~ grecquage | {"commonly_bundled":"grecquage"} | {"relation":"REL-0050","composite":"OPR-0027","component":"OPR-0028"} |

**texte libre déjà décrit** (1) — *Raison :* Le texte désigne une entrée dont la paire figure déjà dans une relation. *Impact :* Aucun ajout.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0374 | OPR-0064 ~ formation des coiffes | {"commonly_bundled":"formation des coiffes"} | {"component":"OPR-0049"} |

## A5 — Même paire typée deux fois

**relation en double** (1) — *Raison :* La même paire est aussi typée « may_include » (REL-0033). Une paire ne figure que dans une seule famille : l'inclusion est conservée. *Impact :* Aucun effet : l'inclusion (« peut inclure ») décrit mieux Boîte de conservation → Calage intérieur qu'une séquence.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0345 | REL-0024 | {"relation":"REL-0024","type":"depends_on","from":"OPR-0164-boite_de_conservation","to":"OPR-0170-calage_interieur"} | — |

## A6 — Unités et modes de prix mélangés

**unité** (21) — *Raison :* Unité du vocabulaire contrôlé (20 unités + « Autre » côté atelier).

| # | Sujet | Ancien contenu | Nouveau contenu | Impact |
| --- | --- | --- | --- | --- |
| J-0263 | par ouvrage | par ouvrage | {"unit":"ouvrage"} | 148 entrées. |
| J-0264 | par volume | par volume | {"unit":"volume"} | 8 entrées. |
| J-0265 | par cahier | par cahier | {"unit":"cahier"} | 21 entrées. |
| J-0266 | par feuillet | par feuillet | {"unit":"feuillet"} | 20 entrées. |
| J-0267 | par tranche | par tranche | {"unit":"tranche"} | 10 entrées. |
| J-0268 | par plat | par plat | {"unit":"plat"} | 31 entrées. |
| J-0269 | par dos | par dos | {"unit":"dos"} | 21 entrées. |
| J-0270 | par garde | par garde | {"unit":"garde"} | 9 entrées. |
| J-0271 | par coin | par coin | {"unit":"coin"} | 3 entrées. |
| J-0272 | par coiffe | par coiffe | {"unit":"coiffe"} | 3 entrées. |
| J-0273 | par mors | par mors | {"unit":"mors"} | 3 entrées. |
| J-0274 | par nerf | par nerf | {"unit":"nerf"} | 9 entrées. |
| J-0275 | par titre | par titre | {"unit":"titre"} | 7 entrées. |
| J-0276 | par ligne | par ligne | {"unit":"ligne"} | 14 entrées. |
| J-0277 | par caractère | par caractère | {"unit":"caractère"} | 5 entrées. |
| J-0278 | par pièce | par pièce | {"unit":"pièce"} | 10 entrées. |
| J-0279 | par motif | par motif | {"unit":"motif"} | 20 entrées. |
| J-0280 | par boîte | par boîte | {"unit":"boîte"} | 12 entrées. |
| J-0281 | par cm | par cm | {"unit":"cm"} | 5 entrées. |
| J-0282 | par cm² | par cm² | {"unit":"cm²"} | 12 entrées. |
| J-0283 | par feuille | par feuille | {"unit":"feuillet"} | 1 entrées. |

**mode de prix** (1) — *Raison :* « par heure » est un mode de tarification, pas une unité : séparé de `unitCandidates`. *Impact :* 64 entrées.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0284 | par heure | {"unit_candidates":"par heure"} | {"pricingModes":"hourly"} |

**mode de prix** (1) — *Raison :* « forfait » est un mode de tarification, pas une unité : séparé de `unitCandidates`. *Impact :* 17 entrées.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0285 | forfait | {"unit_candidates":"forfait"} | {"pricingModes":"fixed"} |

**mode de prix** (1) — *Raison :* « sur devis » est un mode de tarification, pas une unité : séparé de `unitCandidates`. *Impact :* 64 entrées.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0286 | sur devis | {"unit_candidates":"sur devis"} | {"pricingModes":"on_quote"} |

**unité non retenue** (34) — *Raison :* Unité de longue traîne (hors du vocabulaire contrôlé court). L'atelier la saisit via « Autre » s'il la pratique.

| # | Sujet | Ancien contenu | Nouveau contenu | Impact |
| --- | --- | --- | --- | --- |
| J-0287 | par paire de plats | par paire de plats | — | 6 entrée(s) : OPR-0051, OPR-0052, OPR-0053, OPR-0055, OPR-0057, OPR-0058. Aucune information de prix perdue. |
| J-0288 | par filet | par filet | — | 5 entrée(s) : OPR-0114, OPR-0116, OPR-0120, OPR-0123, OPR-0131. Aucune information de prix perdue. |
| J-0289 | par page | par page | — | 5 entrée(s) : OPR-0146, OPR-0147, OPR-0148, OPR-0149, OPR-0155. Aucune information de prix perdue. |
| J-0290 | par étui | par étui | — | 5 entrée(s) : OPR-0157, OPR-0158, OPR-0159, OPR-0160, OPR-0176. Aucune information de prix perdue. |
| J-0291 | par zone | par zone | — | 4 entrée(s) : OPR-0101, OPR-0115, OPR-0150, OPR-0183. Aucune information de prix perdue. |
| J-0292 | par compartiment | par compartiment | — | 4 entrée(s) : OPR-0117, OPR-0121, OPR-0170, OPR-0171. Aucune information de prix perdue. |
| J-0293 | par peau | par peau | — | 3 entrée(s) : OPR-0074, OPR-0190, OPR-0193. Aucune information de prix perdue. |
| J-0294 | par mot | par mot | — | 3 entrée(s) : OPR-0102, OPR-0103, OPR-0104. Aucune information de prix perdue. |
| J-0295 | par vue | par vue | — | 2 entrée(s) : OPR-0003, OPR-0184. Aucune information de prix perdue. |
| J-0296 | par lacune | par lacune | — | 2 entrée(s) : OPR-0019, OPR-0137. Aucune information de prix perdue. |
| J-0297 | par couverture | par couverture | — | 2 entrée(s) : OPR-0022, OPR-0143. Aucune information de prix perdue. |
| J-0298 | par charnière | par charnière | — | 2 entrée(s) : OPR-0024, OPR-0089. Aucune information de prix perdue. |
| J-0299 | par tranchefile | par tranchefile | — | 2 entrée(s) : OPR-0047, OPR-0048. Aucune information de prix perdue. |
| J-0300 | par fleuron | par fleuron | — | 2 entrée(s) : OPR-0114, OPR-0118. Aucune information de prix perdue. |
| J-0301 | par déchirure | par déchirure | — | 1 entrée(s) : OPR-0018. Aucune information de prix perdue. |
| J-0302 | par hors-texte | par hors-texte | — | 1 entrée(s) : OPR-0020. Aucune information de prix perdue. |
| J-0303 | par point | par point | — | 1 entrée(s) : OPR-0025. Aucune information de prix perdue. |
| J-0304 | par ficelle | par ficelle | — | 1 entrée(s) : OPR-0029. Aucune information de prix perdue. |
| J-0305 | par ruban | par ruban | — | 1 entrée(s) : OPR-0031. Aucune information de prix perdue. |
| J-0306 | par couture | par couture | — | 1 entrée(s) : OPR-0032. Aucune information de prix perdue. |
| J-0307 | par couvrure | par couvrure | — | 1 entrée(s) : OPR-0061. Aucune information de prix perdue. |
| J-0308 | par bande | par bande | — | 1 entrée(s) : OPR-0067. Aucune information de prix perdue. |
| J-0309 | par palette | par palette | — | 1 entrée(s) : OPR-0117. Aucune information de prix perdue. |
| J-0310 | par chant | par chant | — | 1 entrée(s) : OPR-0135. Aucune information de prix perdue. |
| J-0311 | par élément | par élément | — | 1 entrée(s) : OPR-0144. Aucune information de prix perdue. |
| J-0312 | par tache | par tache | — | 1 entrée(s) : OPR-0152. Aucune information de prix perdue. |
| J-0313 | par chemise | par chemise | — | 1 entrée(s) : OPR-0161. Aucune information de prix perdue. |
| J-0314 | par ensemble | par ensemble | — | 1 entrée(s) : OPR-0162. Aucune information de prix perdue. |
| J-0315 | par portefeuille | par portefeuille | — | 1 entrée(s) : OPR-0167. Aucune information de prix perdue. |
| J-0316 | par coffret | par coffret | — | 1 entrée(s) : OPR-0168. Aucune information de prix perdue. |
| J-0317 | par plateau | par plateau | — | 1 entrée(s) : OPR-0169. Aucune information de prix perdue. |
| J-0318 | par étiquette | par étiquette | — | 1 entrée(s) : OPR-0172. Aucune information de prix perdue. |
| J-0320 | par exemplaire | par exemplaire | — | 1 entrée(s) : OPR-0192. Aucune information de prix perdue. |
| J-0321 | par mètre | par mètre | — | 1 entrée(s) : OPR-0195. Aucune information de prix perdue. |

**unité non retenue** (1) — *Raison :* Un pourcentage est un ajustement, pas un mode de prix de reliure : hors vocabulaire. *Impact :* 1 entrée(s) : OPR-0191. Aucune information de prix perdue.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0319 | pourcentage | pourcentage | — |

## A7 — Entrées qui ne sont pas des opérations

**nature de l'entrée** (23) — *Raison :* Prestation commerciale ou composée : proposée comme une prestation à part entière (jamais comme une checklist). *Impact :* Importable dans le catalogue de l'atelier.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0226 | OPR-0062 | {"entity_type":"commercial_service","name":"Reliure pleine toile"} | {"kind":"package"} |
| J-0227 | OPR-0063 | {"entity_type":"commercial_service","name":"Reliure pleine papier"} | {"kind":"package"} |
| J-0228 | OPR-0064 | {"entity_type":"composite_operation","name":"Reliure plein cuir"} | {"kind":"package"} |
| J-0229 | OPR-0065 | {"entity_type":"composite_operation","name":"Demi-reliure cuir"} | {"kind":"package"} |
| J-0230 | OPR-0066 | {"entity_type":"composite_operation","name":"Demi-reliure à coins"} | {"kind":"package"} |
| J-0231 | OPR-0067 | {"entity_type":"composite_operation","name":"Demi-reliure à bandes"} | {"kind":"package"} |
| J-0232 | OPR-0068 | {"entity_type":"commercial_service","name":"Quart de reliure"} | {"kind":"package"} |
| J-0233 | OPR-0069 | {"entity_type":"composite_operation","name":"Reliure plein parchemin"} | {"kind":"package"} |
| J-0234 | OPR-0070 | {"entity_type":"commercial_service","name":"Demi-parchemin"} | {"kind":"package"} |
| J-0235 | OPR-0071 | {"entity_type":"composite_operation","name":"Reliure Bradel"} | {"kind":"package"} |
| J-0236 | OPR-0072 | {"entity_type":"composite_operation","name":"Emboîtage"} | {"kind":"package"} |
| J-0239 | OPR-0157 | {"entity_type":"commercial_service","name":"Étui simple"} | {"kind":"package"} |
| J-0240 | OPR-0158 | {"entity_type":"commercial_service","name":"Étui bordé"} | {"kind":"package"} |
| J-0241 | OPR-0159 | {"entity_type":"commercial_service","name":"Étui gainé"} | {"kind":"package"} |
| J-0242 | OPR-0160 | {"entity_type":"commercial_service","name":"Étui cigare"} | {"kind":"package"} |
| J-0243 | OPR-0161 | {"entity_type":"commercial_service","name":"Chemise à rabats"} | {"kind":"package"} |
| J-0244 | OPR-0162 | {"entity_type":"composite_operation","name":"Chemise-étui"} | {"kind":"package"} |
| J-0245 | OPR-0163 | {"entity_type":"commercial_service","name":"Boîte cloche"} | {"kind":"package"} |
| J-0246 | OPR-0164 | {"entity_type":"commercial_service","name":"Boîte de conservation"} | {"kind":"package"} |
| J-0247 | OPR-0165 | {"entity_type":"commercial_service","name":"Boîte à dos"} | {"kind":"package"} |
| J-0248 | OPR-0166 | {"entity_type":"commercial_service","name":"Boîte à chasses"} | {"kind":"package"} |
| J-0249 | OPR-0167 | {"entity_type":"commercial_service","name":"Boîte portefeuille"} | {"kind":"package"} |
| J-0250 | OPR-0168 | {"entity_type":"commercial_service","name":"Coffret"} | {"kind":"package"} |

**nature de l'entrée** (1) — *Raison :* Diagnostic : proposé comme une prestation. *Impact :* Importable dans le catalogue de l'atelier.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0252 | OPR-0186 | {"entity_type":"diagnostic","name":"Diagnostic sur devis"} | {"kind":"diagnostic"} |

**nature de l'entrée** (1) — *Raison :* « Prestation sur devis » est la ligne libre du devis, déjà offerte partout : ce n'est pas une prestation à importer. *Impact :* Non importable dans le catalogue de l'atelier ; conservée dans la ressource.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0253 | OPR-0187 | {"entity_type":"commercial_service","name":"Prestation sur devis"} | {"kind":"generic_quote"} |

**entrée inactive** (1) — *Raison :* Remplacée par la ligne libre du devis (toujours disponible) : retirée des propositions. *Impact :* Jamais proposée ni importée.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0254 | OPR-0187 | {"active":true} | {"active":false} |

**nature de l'entrée** (5) — *Raison :* Majoration, remise ou forfait de préparation : un ajustement commercial, pas une opération technique. Il reste un mécanisme distinct du devis et n'est pas proposé dans la recherche métier. *Impact :* Non importable dans le catalogue de l'atelier ; conservée dans la ressource.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0255 | OPR-0188 | {"entity_type":"surcharge","name":"Forfait de préparation non standard"} | {"kind":"adjustment"} |
| J-0256 | OPR-0189 | {"entity_type":"surcharge","name":"Majoration de grand format"} | {"kind":"adjustment"} |
| J-0257 | OPR-0190 | {"entity_type":"surcharge","name":"Majoration de matériau"} | {"kind":"adjustment"} |
| J-0258 | OPR-0191 | {"entity_type":"surcharge","name":"Majoration d’urgence"} | {"kind":"adjustment"} |
| J-0259 | OPR-0192 | {"entity_type":"option","name":"Remise de série"} | {"kind":"adjustment"} |

**nature de l'entrée** (3) — *Raison :* Choix de matériau, pas une prestation : ne doit jamais remonter comme si c'en était une. *Impact :* Non importable dans le catalogue de l'atelier ; conservée dans la ressource.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0260 | OPR-0193 | {"entity_type":"material","name":"Choix de cuir"} | {"kind":"material_choice"} |
| J-0261 | OPR-0194 | {"entity_type":"material","name":"Choix de papier décoré"} | {"kind":"material_choice"} |
| J-0262 | OPR-0195 | {"entity_type":"material","name":"Choix de toile"} | {"kind":"material_choice"} |

## A8 — Hiérarchie mélangée

**hiérarchie** (7) — *Raison :* Vraie variante d'une même opération (type de couture, d'étui, de boîte) : conservée sous `variantOf`, un concept à part des prérequis. *Impact :* Aucun effet sur la recherche ; une variante n'est jamais un prérequis.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0213 | OPR-0029 | {"parent":"OPR-0027-couture_de_cahiers","level":4} | {"variantOf":"OPR-0027"} |
| J-0214 | OPR-0030 | {"parent":"OPR-0027-couture_de_cahiers","level":4} | {"variantOf":"OPR-0027"} |
| J-0215 | OPR-0031 | {"parent":"OPR-0027-couture_de_cahiers","level":4} | {"variantOf":"OPR-0027"} |
| J-0216 | OPR-0033 | {"parent":"OPR-0027-couture_de_cahiers","level":4} | {"variantOf":"OPR-0027"} |
| J-0217 | OPR-0036 | {"parent":"OPR-0027-couture_de_cahiers","level":4} | {"variantOf":"OPR-0027"} |
| J-0221 | OPR-0158 | {"parent":"OPR-0157-etui_simple","level":4} | {"variantOf":"OPR-0157"} |
| J-0222 | OPR-0166 | {"parent":"OPR-0164-boite_de_conservation","level":4} | {"variantOf":"OPR-0164"} |

**hiérarchie** (3) — *Raison :* Le « parent » (Couvrure) est aussi un composant de ce service (il l'inclut) : ce n'est pas une variante. La classification par domaine COUVRURE reste. *Impact :* Aucun effet visible. Le composant éventuel est décrit par les relations `operation_components`, pas par une hiérarchie.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0218 | OPR-0062 | {"parent":"OPR-0061-couvrure","level":4} | {"variantOf":null} |
| J-0219 | OPR-0064 | {"parent":"OPR-0061-couvrure","level":4} | {"variantOf":null} |
| J-0220 | OPR-0065 | {"parent":"OPR-0061-couvrure","level":4} | {"variantOf":null} |

## A9 — Identifiants instables

**identifiant** (195) — *Raison :* Le suffixe reprenait un slug du libellé : corriger le libellé aurait changé l'identité. *Impact :* Aucune dépendance ne doit utiliser un slug ; les liens du référentiel et des prestations d'atelier portent la clé stable.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0001 | OPR-0001 | OPR-0001-examen_de_l_ouvrage | OPR-0001 |
| J-0002 | OPR-0002 | OPR-0002-constat_d_etat | OPR-0002 |
| J-0003 | OPR-0003 | OPR-0003-releve_photographique_avant_intervention | OPR-0003 |
| J-0004 | OPR-0004 | OPR-0004-collationnement | OPR-0004 |
| J-0005 | OPR-0005 | OPR-0005-releve_de_structure | OPR-0005 |

… et 190 autres (liste complète dans `journal.json`).

## A10 — Codes de domaine irréguliers

**code de domaine** (1) — *Raison :* Code irrégulier : un accent au milieu de codes ASCII. *Impact :* 15 entrées ; aucun effet visible (le libellé affiché est « Examen & préparation »).

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0196 | EXAMEN_PRÉPARATION | EXAMEN_PRÉPARATION | EXAMEN_PREPARATION |

## A11 — Champs promis mais vides ou boilerplate

**champ retiré** (1) — *Raison :* Vide sur les 195 entrées : le référentiel ne porte aucune logique de prix. *Impact :* Aucune information perdue.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0197 | price_drivers | {"entriesWithAValue":0,"of":195,"samples":[]} | — |

**champ retiré** (2) — *Raison :* Vide sur les 195 entrées. *Impact :* Aucune information perdue.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0198 | complexity_drivers | {"entriesWithAValue":0,"of":195,"samples":[]} | — |
| J-0206 | incompatible_with | {"entriesWithAValue":0,"of":195,"samples":[]} | — |

**champ retiré** (2) — *Raison :* « unknown » sur les 195 entrées. *Impact :* Aucune information perdue.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0199 | condition_driver | {"entriesWithAValue":0,"of":195,"samples":[]} | — |
| J-0200 | preferred_unit_if_documented | {"entriesWithAValue":0,"of":195,"samples":[]} | — |

**champ retiré** (1) — *Raison :* Vide sur les 195 entrées : aucun terme historique n'est retenu dans cette version. *Impact :* Aucune information perdue.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0201 | historical_terms | {"entriesWithAValue":0,"of":195,"samples":[]} | — |

**champ retiré** (1) — *Raison :* Texte identique sur les 195 entrées (« possible selon politique de l'atelier ») : ce n'est pas une donnée. *Impact :* 195 valeur(s) non vide(s) abandonnée(s) : conservée(s) dans la source brute uniquement.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0202 | minimum_charge_possible | {"entriesWithAValue":195,"of":195,"samples":["\"possible selon politique de l’atelier\""]} | — |

**champ retiré** (1) — *Raison :* Texte quasi identique (« format, hauteur, largeur et épaisseur ») : boilerplate. *Impact :* 195 valeur(s) non vide(s) abandonnée(s) : conservée(s) dans la source brute uniquement.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0203 | dimension_driver | {"entriesWithAValue":195,"of":195,"samples":["\"format, hauteur, largeur et épaisseur\"","\"hauteur, largeur et épaisseur\""]} | — |

**champ retiré** (1) — *Raison :* « unknown » sur 193 entrées ; les 2 valeurs renseignées ne suffisent pas à un pilotage. *Impact :* 2 valeur(s) non vide(s) abandonnée(s) : conservée(s) dans la source brute uniquement.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0204 | quantity_driver | {"entriesWithAValue":2,"of":195,"samples":["\"nombre de cahiers et points de couture\"","\"nombre d’exemplaires homogènes\""]} | — |

**champ retiré** (1) — *Raison :* « unknown » sur 192 entrées ; les 3 valeurs renseignées ne suffisent pas à un pilotage. *Impact :* 3 valeur(s) non vide(s) abandonnée(s) : conservée(s) dans la source brute uniquement.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0205 | material_driver | {"entriesWithAValue":3,"of":195,"samples":["\"type de fil et supports de couture\"","\"qualité et type de matériau\"","\"espèce, tannage, qualité, couleur et surface\""]} | — |

**champ retiré** (3) — *Raison :* Non utilisé par le produit en V1.

| # | Sujet | Ancien contenu | Nouveau contenu | Impact |
| --- | --- | --- | --- | --- |
| J-0207 | tools_or_techniques | {"entriesWithAValue":17,"of":195,"samples":["[\"brosse\",\"aspiration filtrée\"]","[\"gomme\",\"poudre de gomme\"]","[\"presse\"]"]} | — | 17 valeur(s) non vide(s) abandonnée(s) : conservée(s) dans la source brute uniquement. |
| J-0208 | applicable_to | {"entriesWithAValue":195,"of":195,"samples":["[\"livre imprimé\",\"ouvrage cousu\"]","[\"ouvrage cousu\",\"livre à dos arrondi\"]","[\"livre relié\",\"ouvrage fragile\"]"]} | — | 195 valeur(s) non vide(s) abandonnée(s) : conservée(s) dans la source brute uniquement. |
| J-0210 | internal_only_possible | {"entriesWithAValue":195,"of":195,"samples":["true","false"]} | — | 195 valeur(s) non vide(s) abandonnée(s) : conservée(s) dans la source brute uniquement. |

**champ retiré** (1) — *Raison :* Texte libre non relié au référentiel des matériaux : ne doit pas faire remonter une opération sur un mot de matériau (recherche « cuir »). *Impact :* 42 valeur(s) non vide(s) abandonnée(s) : conservée(s) dans la source brute uniquement.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0209 | materials_commonly_used | {"entriesWithAValue":42,"of":195,"samples":["[\"brosse souple\"]","[\"gomme adaptée\"]","[\"papier de montage\",\"onglets\"]"]} | — |

**champ retiré** (1) — *Raison :* Niveaux mélangés (A8) : la hiérarchie est remplacée par le seul lien de variante `variantOf`. *Impact :* 195 valeur(s) non vide(s) abandonnée(s) : conservée(s) dans la source brute uniquement.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0211 | hierarchy_level | {"entriesWithAValue":195,"of":195,"samples":["3","4"]} | — |

**champ retiré** (1) — *Raison :* Texte répété sur 10 entrées ou plus : c'est du boilerplate. Les notes propres à une entrée sont conservées (`internalNotes`). *Impact :* Aucune information propre à une entrée perdue.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0212 | notes (texte répété) | {"repeatedTexts":["Unité et séquence à adapter aux usages de l’atelier."],"entries":191} | — |

## V3 — Doublons fonctionnels probables

**à valider** (3) — *Raison :* Trois « mises sous presse » au vocabulaire incohérent (« en presse » / « sous presse »). *Impact :* Signalée pour relecture par un relieur du pilote (interne : jamais affichée au relieur).

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0223 | OPR-0009 | {"needs_binder_validation":false} | {"needsBinderValidation":true} |
| J-0225 | OPR-0060 | {"needs_binder_validation":false} | {"needsBinderValidation":true} |
| J-0251 | OPR-0181 | {"needs_binder_validation":false} | {"needsBinderValidation":true} |

**à valider** (1) — *Raison :* Recouvrement fonctionnel probable avec deux autres « réparations de cahier » : à trancher par un relieur. *Impact :* Signalée pour relecture par un relieur du pilote (interne : jamais affichée au relieur).

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0224 | OPR-0016 | {"needs_binder_validation":false} | {"needsBinderValidation":true} |

**à valider** (1) — *Raison :* Son synonyme « réemboîtage » est aussi une entrée distincte (OPR-0073). *Impact :* Signalée pour relecture par un relieur du pilote (interne : jamais affichée au relieur).

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0237 | OPR-0072 | {"needs_binder_validation":false} | {"needsBinderValidation":true} |

**synonyme en collision** (1) — *Raison :* « réemboîtage » est aussi le nom canonique d'une autre entrée (OPR-0073) : un même mot ne désigne pas deux entrées. *Impact :* La recherche « réemboîtage » remonte OPR-0073 en premier.

| # | Sujet | Ancien contenu | Nouveau contenu |
| --- | --- | --- | --- |
| J-0238 | OPR-0072 | {"synonyms":["réemboîtage","emboîter"]} | {"synonyms":["emboîter"]} |

## V4 — Termes ambigus pour un particulier

Aucune correction.

## Relations issues de la normalisation

| Famille | Id | Description | Origine | À valider |
| --- | --- | --- | --- | :---: |
| operation_sequences | REL-0001 | Examen de l’ouvrage → Constat d’état (habituellement après ou avec) | relations | non |
| operation_sequences | REL-0002 | Examen de l’ouvrage → Débrochage (habituellement après ou avec) | relations | oui |
| operation_sequences | REL-0003 | Collationnement → Couture de cahiers (habituellement après ou avec) | relations | non |
| operation_sequences | REL-0004 | Grecquage → Couture à la grecque (habituellement après ou avec) | relations | oui |
| operation_sequences | REL-0005 | Couture de cahiers → Endossure (habituellement après ou avec) | relations | oui |
| operation_sequences | REL-0006 | Endossure → Formation des mors (habituellement après ou avec) | relations | oui |
| operation_sequences | REL-0007 | Couture sur ficelles → Passure des ficelles (habituellement après ou avec) | relations | non |
| operation_sequences | REL-0008 | Pose de nerfs véritables → Dorure des nerfs (habituellement après ou avec) | relations | non |
| operation_sequences | REL-0009 | Coupe des cartons → Montage des plats (habituellement après ou avec) | relations | non |
| operation_sequences | REL-0010 | Montage des plats → Couvrure (habituellement après ou avec) | relations | non |
| operation_sequences | REL-0011 | Parure générale du cuir → Couvrure (habituellement après ou avec) | relations | oui |
| operation_sequences | REL-0012 | Couvrure → Réalisation des remplis (habituellement après ou avec) | relations | non |
| operation_sequences | REL-0013 | Couvrure → Formation des coiffes (habituellement après ou avec) | relations | non |
| operation_sequences | REL-0014 | Pose de gardes blanches → Emboîtage (habituellement après ou avec) | relations | oui |
| operation_sequences | REL-0015 | Pose de pièce de titre → Dorure sur pièce de titre (habituellement après ou avec) | relations | non |
| operation_sequences | REL-0016 | Préparation à la dorure → Titrage au dos (habituellement après ou avec) | relations | oui |
| operation_sequences | REL-0017 | Préparation à la dorure → Dorure directe sur cuir (habituellement après ou avec) | relations | oui |
| operation_sequences | REL-0018 | Composition typographique → Titrage au dos (habituellement après ou avec) | relations | non |
| operation_sequences | REL-0019 | Mosaïque incrustée → Dorure associée à mosaïque (habituellement après ou avec) | relations | oui |
| operation_sequences | REL-0020 | Dépose de la couverture → Montage de couverture conservée (habituellement après ou avec) | relations | oui |
| operation_sequences | REL-0021 | Dépose du dos → Remontage d’ancien dos (habituellement après ou avec) | relations | oui |
| operation_sequences | REL-0022 | Réparation de cahier → Couture complète (habituellement après ou avec) | relations | oui |
| operation_sequences | REL-0023 | Étui simple → Titrage de boîte (habituellement après ou avec) | relations | non |
| operation_sequences | REL-0025 | Découpe de structure de boîte → Montage de structure de boîte (habituellement après ou avec) | relations | non |
| operation_sequences | REL-0026 | Montage de structure de boîte → Habillage de boîte (habituellement après ou avec) | relations | non |
| operation_sequences | REL-0027 | Couvrure → Contrôle final (habituellement après ou avec) | relations | non |
| operation_sequences | REL-0040 | Constat d’état → Relevé photographique avant intervention (habituellement après ou avec) | entry_prerequisites | oui |
| operation_sequences | REL-0041 | Examen de l’ouvrage → Choix du protocole d’intervention (habituellement après ou avec) | entry_prerequisites | oui |
| operation_sequences | REL-0042 | Constat d’état → Choix du protocole d’intervention (habituellement après ou avec) | entry_prerequisites | oui |
| operation_sequences | REL-0043 | Examen de l’ouvrage → Dépose de la couverture (habituellement après ou avec) | entry_prerequisites | oui |
| operation_sequences | REL-0044 | Couture de cahiers → Passure des ficelles (habituellement après ou avec) | entry_prerequisites | oui |
| operation_sequences | REL-0045 | Couture de cahiers → Arrondissure (habituellement après ou avec) | entry_prerequisites | oui |
| operation_sequences | REL-0046 | Couture de cahiers → Montage des plats (habituellement après ou avec) | entry_prerequisites | oui |
| operation_sequences | REL-0047 | Préparation à la dorure → Composition typographique (habituellement après ou avec) | entry_prerequisites | oui |
| operation_sequences | REL-0048 | Préparation à la dorure → Dorure sur pièce de titre (habituellement après ou avec) | entry_prerequisites | oui |
| operation_components | REL-0028 | Reliure plein cuir peut inclure Parure générale du cuir | relations | non |
| operation_components | REL-0029 | Reliure plein cuir peut inclure Couvrure | relations | non |
| operation_components | REL-0030 | Reliure plein cuir peut inclure Formation des coiffes | relations | non |
| operation_components | REL-0031 | Demi-reliure cuir peut inclure Pose des coins | relations | non |
| operation_components | REL-0032 | Reliure Bradel peut inclure Emboîtage | relations | oui |
| operation_components | REL-0033 | Boîte de conservation peut inclure Calage intérieur | relations | non |
| operation_components | REL-0034 | Chemise-étui peut inclure Chemise à rabats | relations | non |
| operation_components | REL-0035 | Chemise-étui peut inclure Étui simple | relations | non |
| operation_components | REL-0049 | Ajout de fausse garde peut inclure Emboîtage | commonly_bundled | oui |
| operation_components | REL-0050 | Couture de cahiers peut inclure Grecquage | commonly_bundled | oui |
| operation_alternatives | REL-0036 | Endossure ⇄ Dos brisé | relations | oui |
| operation_alternatives | REL-0037 | Dorure à la feuille ⇄ Dorure au film | relations | oui |
| operation_alternatives | REL-0038 | Pose de tranchefiles mécaniques ⇄ Broderie de tranchefiles main | relations | non |
| operation_alternatives | REL-0039 | Remplacement de gardes ⇄ Restauration de garde | relations | oui |
