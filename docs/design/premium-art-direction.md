# Direction artistique — « La table d'atelier » (octobre 2026)

Refonte premium de Ma Reliure et Fine Bindery. Ce document fixe le
diagnostic, la direction retenue et ce qu'il reste à photographier. Les règles
de `docs/content-assets.md` (rien d'inventé, tout crédité) restent la loi :
cette refonte ne change aucun texte de preuve, n'ajoute aucun atelier, aucun
chiffre, aucun avis.

## 1. Diagnostic (sites en ligne, 2 octobre 2026)

**Ce qui tient.** Un système typographique sobre et lisible (corps 17 px,
contrastes vérifiés), un seul accent, une honnêteté de contenu rare, des
photographies réelles et créditées.

**Ce qui fait « gabarit ».**

1. *Une seule structure répétée.* Surtitre en capitales, titre serif, chapô,
   grille : huit fois de suite sur l'accueil Ma Reliure, sept sur Fine
   Bindery. Rien ne hiérarchise les sections entre elles.
2. *Les photographies sont recadrées pour remplir.* `object-cover` en 4:3
   impose un cadrage que les prises de vue documentaires (flash, fond gris,
   balance des blancs variable) ne supportent pas : dos coupés, fonds gris
   bord à bord, ouvrages tronqués. Le défaut des images devient le défaut de
   la page.
3. *Le premier écran ne montre presque rien.* L'image du héros occupe 5/12
   sur bureau et passe sous la ligne de flottaison sur mobile.
4. *Les deux marques sont la même page.* Fine Bindery ne diffère de Ma
   Reliure que par une teinte d'accent ; rien ne dit « réseau européen de
   collectionneurs » plutôt que « service français ».
5. *Écarts de contenu.* L'étape 3 de Ma Reliure annonce encore un transport
   « en attendant un envoi organisé », alors que l'aller-retour organisé
   (15 € TTC, France métropolitaine) est en production. Sur Fine Bindery, le
   bouton principal mène à un annuaire vide (aucun profil publié), et la
   section de confiance aligne quatre titres sans phrase.

## 2. Direction : « La table d'atelier »

Un relieur ne met pas ses pièces en scène : il les pose sur la table, les
numérote et les décrit. La direction reprend ce geste, qui est aussi celui des
catalogues de bibliothèque et de vente.

- **Planches.** Chaque photographie devient une planche : posée entière
  (jamais recadrée) dans un passe-partout de papier, numérotée « Pl. n »,
  légendée comme une notice. Les fonds gris des prises de vue deviennent la
  photographie elle-même, encadrée — l'hétérogénéité se lit comme une série.
- **Le double filet.** Filet gras et filet maigre, exactement l'ornement que
  pose le doreur (prestation « Filets » de la grille). C'est la signature :
  il ouvre chaque section, à la place du surtitre seul.
- **Folios.** Les sections sont numérotées en chiffres romains, comme les
  chapitres d'un livre. Le sommaire des savoir-faire se lit comme une table
  des matières, pas comme une grille de cartes.
- **Une seule voix serif.** Fraunces reste (auto-hébergée, OFL). Elle porte
  les titres, les folios et les numéros de planche ; la sans-serif système
  garde tout ce qui s'utilise. Aucune nouvelle police, aucun octet de plus.
- **Rien ne simule une matière.** Pas de grain, pas de dorure en dégradé, pas
  d'ombre portée. Le premium vient de l'espace, de l'échelle et de la
  précision des légendes.

### Deux registres

| | Ma Reliure — « le carnet » | Fine Bindery — « le cabinet » |
|---|---|---|
| Public | Particulier en France, un livre auquel il tient | Collectionneurs, bibliophiles, international |
| Fond dominant | Ivoire, respiration pierre | Premier écran brun profond, puis ivoire |
| Accent | Bordeaux, en trait | Cognac, en trait |
| Héros | Texte à gauche, planche à droite, aplomb éditorial | Cabinet sombre, planche unique, notice en petites capitales |
| Ton | Proche, rassurant, prix d'abord | Réseau, disciplines, langues |

## 3. Règles d'implémentation

- `Plate` (landing) : passe-partout, `object-contain`, numéro et légende ;
  dimensions intrinsèques déclarées, aucun décalage de mise en page.
- `SectionHead` accepte un `folio` ; le double filet est `.mr-filet`.
- Couleurs : uniquement les jetons `mr-*` (et leur surcharge `.fb-site`).
- Contraste AA vérifié sur chaque nouvelle combinaison (légendes sur
  passe-partout, texte sur brun).
- Aucune route, aucun lien, aucun texte juridique, aucune donnée structurée
  ne change ; les parcours `/m/:publicToken`, `/{locale}/project`, paiement et
  transport ne sont pas touchés.

## 4. Photographies à produire

Aucune de ces images n'existe ; aucune ne sera simulée. Chacune demande
l'autorisation écrite du propriétaire (et de la personne, si elle est
reconnaissable), puis une ligne au registre `docs/content-assets.md`.

| # | Sujet | Emplacement prévu | Consignes |
|---|---|---|---|
| 1 | Mains au travail : pose d'un filet doré au fer | Héros Ma Reliure (alternative à la planche) | Lumière du jour latérale, fond d'établi, net sur le fer ; 3:2, 3000 px |
| 2 | L'atelier en plan large, établis et presses | Section ateliers | Lumière naturelle, sans retouche d'ambiance ; 16:9 |
| 3 | Fers à dorer et roulettes rangés | Tarifs — dorure | Fond neutre, éclairage doux ; 4:3 |
| 4 | Échantillons de cuirs, toiles et papiers marbrés | Tarifs — matières | Vue de dessus, lumière diffuse, balance des blancs fixée |
| 5 | Réception d'un colis et constat d'état à l'atelier | Transport aller-retour | Un vrai colis du réseau, sans adresse lisible |
| 6 | Portrait de l'artisan à l'établi | Fiche atelier Fine Bindery | Accord de la personne en plus de celui de l'atelier |
| 7 | Série avant/après sur fond unique gris clair | Réalisations | Même cadrage, même lumière avant et après |

Consigne commune : fond neutre constant, balance des blancs fixée, pas de
flash direct, fichiers originaux conservés. La présentation en planches
supporte des images hétérogènes ; elle ne remplace pas une série cohérente.
