# Chargement mobile — 20 octobre 2026, soir

**Rapport de travail : les mesures finales après correctif sont en cours. L’objectif LCP < 2,5 s n’est pas encore déclaré atteint.**

Base `origin/main abfe72b`. Référence sur build de production local servi par Wrangler, Lighthouse mobile 13.5.0 : trois passages par page, navigateur neuf, même profil 412 × 823 / CPU ×4 / réseau simulé, appels externes et écritures bloqués. Médianes LCP avant : accueil 3,52 s ; tarifs 3,31 s ; réparation 3,50 s ; partenaires 3,44 s ; Fine Bindery /en 4,14 s.

Les diagnostics LCP identifient le titre de l’accueil et des partenaires, le chapô des tarifs et de réparation, et la planche Baudelaire sur /en. Les nombreux modulepreload précèdent la police et l’image dans le HTML. Le candidat place les ressources critiques avant ces modules et attribue une priorité basse à leurs préchargements sur les cinq pages ciblées ; les pages privées gardent HeadContent natif. Préchargement responsive de l’image sur l’accueil Fine Bindery seulement, priorité haute de la police déjà préchargée, cache de police un jour avec revalidation.

Aucun rendu visible, fichier Fine Bindery réservé, dictionnaire ou route $locale.* modifié. Le CSS intégré au HTML a été évalué puis écarté. L’AVIF qualité 80 essayé est plus lourd que le WebP existant (41 474 contre 27 962 octets) ; aucun nouvel encodage n’est publié.

Validation disponible : 314 fichiers / 3 844 tests, typecheck réussi, lint sans erreur et 19 avertissements existants. Recette client et build final en cours. Le rapport sera remplacé par les résultats achevés avant remise de la PR.
