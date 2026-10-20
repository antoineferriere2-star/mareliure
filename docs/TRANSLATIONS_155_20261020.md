# Relecture des traductions de #155 — 20 octobre 2026, soir

Relecture des titres, descriptions et introductions DE/IT/ES des quatre disciplines sur `origin/main abfe72b`. **25 chaînes ajustées** dans `disciplines.ts` : un titre, douze descriptions et douze introductions. Les onze autres titres de ces langues sont conservés après relecture. Les textes EN/FR, les libellés, les routes, les prestations et les autres fichiers Fine Bindery restent inchangés.

| Langue | Corrections principales |
| --- | --- |
| DE | Handeinbände **aus** Leder plutôt que in ; Gelenke pour les mors, à distinguer des plis ; vocabulaire Buchbinderei, Ledermosaik et Vorsatzpapiere. Phrases actives, adresse Sie conservée ; calques sur le livre « ouvert pendant des générations » et le travail « autour du livre » reformulés. |
| IT | Legatoria, coperta et carte di guardia précisent le métier. Esemplari d’omaggio remplace le calque copie di presentazione, cartelle remplace camicie dans cette énumération de protections. L’adresse vostro/voi est uniforme ; le transport n’est plus appelé viaggio. |
| ES | Charnelas et costuras conservés ; guardas de papel marmoleado remplace marmoladas. Edición apreciada et libro al que tenga especial apego évitent les calques ; adresse usted conservée, transport explicite et phrases plus naturelles. |

Repères terminologiques : [glossaire du Kompetenzzentrum Einbandforschung](https://einbandforschung.staatsbibliothek-berlin.de/glossar/), [Treccani, Legatura](https://www.treccani.it/enciclopedia/legatura/), [Biblioteca Nacional de España, reliures baroques](https://www.bne.es/es/colecciones/encuadernaciones/estilos/barroco). Ces sources étayent les termes ; elles ne constituent pas une validation humaine native de l’ensemble de la copie.

Périmètre commercial conservé : mêmes prestations et procédure de proposition avant décision, aucun prix, délai, avis ou avantage ajouté. La finalité d’un livre conservé pour les générations est reformulée sans garantie nouvelle. Aucun ajout de traduction aux dictionnaires ou aux autres pages.

Validation locale : les **six tests existants `disciplines.test.ts` passent**, dont les limites titre ≤ 70 / description ≤ 160 et l’absence de montant, délai ou avis ; typecheck réussi. Les descriptions changées font 133–157 caractères et le titre changé 56. Les bornes s’appliquent aussi aux textes conservés, vérifiés par le test. CI standard verte sur ff26294 : quality et recette client simulée.

Aucune écriture en production, compte, e-mail, achat, paiement, fusion de PR ou déploiement. La note du propriétaire indiquant #153 fusionnée mais non encore déployée est conservée comme contexte ; aucun déploiement n’est entrepris ici.
