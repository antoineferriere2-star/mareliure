# Front public Ma Reliure — audit du 24 septembre 2026 et lot 1

Méthode : robot sur le HTML servi (SSR) de mareliure.fr, parcours Playwright
desktop 1440 px et mobile 390 px, mesures LCP/CLS/poids, axe-core (WCAG 2.1 AA).
Lecture seule en production : aucun parcours de demande démarré.

## Ce qui va bien

- Accueil : promesse claire, action unique, photo réelle créditée ; contenu
  précis et fidèle au métier.
- Rendu serveur, titres, descriptions et adresses canoniques en place sur les
  pages Ma Reliure ; `robots.txt` et plan du site cohérents.
- Performances à chaud : LCP < 0,6 s sur mobile, CLS 0, aucun défilement horizontal.

## Corrigé dans ce lot

| Constat | Correction |
| --- | --- |
| Pages Métré Build servies sur mareliure.fr en anglais, indexables (`/pricing` « Project Intake Pricing from $19.99/mo », `/how-it-works`, `/contact`, `/privacy`, `/terms`…) | `beforeLoad: metreOnly` : vraie 404 sur le déploiement Ma Reliure, rien ne change sur Métré |
| Page introuvable et page d'erreur du gabarit, en anglais (« Page not found », « Go home ») | Pages Ma Reliure en français, avec présenter son livre, tarifs, accueil |
| Aucune image de partage : un lien envoyé s'affichait sans visuel | Carte typographique 1200×630 (sans photographie, déclarée dans `content-assets.md`), `og:image`, `og:locale`, `og:site_name`, `twitter:image` |
| `/candidature-atelier` au plan du site mais rendue côté client (`ssr: false`), sans H1 ni canonique pour un moteur | Rendue côté serveur, canonique et `og:url` |
| Pied de page : « CGV — publiées avant l'ouverture du paiement » alors qu'elles sont publiées (et listées juste au-dessus) | Ligne retirée |
| Vocabulaire interdit visible des ateliers : « leads », « formulaire » (candidature, page partenaires, connexion atelier, message d'erreur serveur) | « projets », « candidature » — le mot de la navigation atelier |
| `/partenaires-relieurs` : tableau défilant inaccessible au clavier (axe `scrollable-region-focusable`) | Zone focalisable et nommée |
| Parcours de demande (panneau « Votre projet », `ProjectCanvas`) : `<dl>` mal formée et `aria-label` interdit — 16 violations axe par page | Statut en second `<dd>`, libellé en texte lu ; rendu identique au pixel près |

## À décider (non traité)

1. **Navigation mobile.** Sous 1024 px, l'entête n'offre que « Se connecter »
   et « Présenter mon livre » ; Tarifs, Comment ça marche, Savoir-faire et
   Pour les relieurs ne sont atteignables que par le pied de page. C'est un
   choix documenté (pas de hamburger pour trois ancres). Option proposée : un
   lien « Tarifs » visible sur mobile, sans menu.
2. **Filet sous le logo invisible.** `bg-mr-brass` / `text-mr-brass` /
   `border-mr-brass` n'existent plus depuis le retrait volontaire du laiton
   (« deux accents, c'est zéro accent », 12 septembre) : le filet du logo, le
   filet FineBindery et des bordures de `/tarifs` ne s'affichent pas. Soit
   retirer ces classes, soit passer le filet en bordeaux (l'accent unique).
3. **Contrastes de `/tarifs`** : 8 violations axe sur les surtitres — la page
   est en cours de modification dans la PR #36, à traiter après sa fusion.
4. **Poids du JavaScript** : 670 Ko à 1 Mo par page publique, CGV comprises
   (bundle applicatif chargé partout). Chantier technique à part : découpage
   par route des pages éditoriales.
5. **Données structurées** : seulement `Organization` et `WebSite` (et un fil
   d'Ariane) ; pas de `Service` ni de `FAQPage`. À ajouter seulement avec un
   contenu visible correspondant (FAQ réelle), jamais pour le seul balisage.
6. **Pages FineBindery sous mareliure.fr** (`/en`, `/de`, `/professionnels`…) :
   canonique vers finebindery.com, mais `lang="fr"` quand elles sont servies
   sous mareliure.fr. Domaine FineBindery.
