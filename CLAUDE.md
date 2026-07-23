# Métré Build — guide de conception

Ce projet implémente **Métré Build**, une *AI Project Conversion Platform* :
elle transforme des visiteurs de site web en **Dossiers Commerciaux**
exploitables via des **Missions** (parcours intelligents) alimentées par des
**Playbooks** (expertise métier) et des **Agents IA**.

Sources de référence complètes (à consulter avant tout travail de conception
produit, pas seulement de code) :
- `D:\Dropbox\Dropbox\Projet X\metre\resume bible v1.pdf` (version condensée, 22 sections)
- `D:\Dropbox\Dropbox\Projet X\metre\bible metre buildAI v2.pdf` (version longue, 30 chapitres)

Ce fichier est un résumé opérationnel à appliquer par défaut à tout code
touchant ce dépôt. En cas de doute, se référer aux PDF ci-dessus.

## Vocabulaire imposé

Ne jamais utiliser dans le code, l'UI, les commentaires ou les commits :
`Formulaire`, `Questionnaire`, `Lead`, `Conversion` (comme nom d'objet),
`Prompt`, `Utilisateur`.

Toujours utiliser à la place : `Mission`, `Projet`, `Visiteur`, `Playbook`,
`Commercial Knowledge`, `Dossier Commercial`. Le code existant (tables
`build_missions`, `build_playbooks`, `build_dossiers`,
`build_knowledge_notes`, routes `/build/*`, `/m/:publicToken`) suit déjà cette
convention — la conserver pour tout ajout.

## La chaîne d'objets (ne jamais casser cet ordre)

```
Mission → Playbook → Components → AI Agents → Commercial Knowledge Engine
        → Commercial Dossier → CRM
```

- **Mission** : un parcours qui guide/explique/adapte/vérifie/rassure — jamais
  un simple formulaire linéaire.
- **Playbook** : porte l'expertise métier (questions, ordre, règles, pièges,
  décisions). C'est l'atout différenciant, pas le code ni l'IA.
- **Components** : interactions réutilisables (photo, plan, mesure, choix,
  comparaison, simulation) — **génériques, ne connaissent jamais le métier**.
  Toute règle métier appartient au Playbook, jamais à un composant ni à
  l'interface.
- **AI Agents** : plusieurs agents spécialisés (Guide, Analyste, Technicien,
  Vérificateur, Rédacteur...), jamais un chatbot généraliste unique. L'IA
  propose, **ne décide jamais** — le commercial garde toujours la décision
  finale.
- **Commercial Knowledge Engine** : la mémoire collective (Playbooks +
  données + résultats + documentation). C'est le vrai patrimoine de
  l'entreprise, pas le code.
- **Dossier Commercial** : LA sortie du système (contexte, besoin,
  contraintes, preuves, analyse, recommandations). Tout le produit existe
  pour le produire.

## Architecture — six moteurs, une responsabilité chacun

Mission Engine · Component Engine · AI Engine · Knowledge Engine · Delivery
Engine · Insights Engine. Ne jamais faire porter deux responsabilités à un
même moteur (ex. ne pas mélanger logique de parcours et rendu de composant).

## Avant d'ajouter une fonctionnalité, répondre à ces 5 questions

1. Produit-elle un meilleur Dossier Commercial ?
2. Réduit-elle une incertitude pour le visiteur ou le commercial ?
3. Est-elle réutilisable (pas spécifique à un seul client) ?
4. Renforce-t-elle un Playbook ?
5. Enrichit-elle le Commercial Knowledge Engine ?

Si une réponse est non, remettre la fonctionnalité en question avant de
coder.

## Anti-patterns refusés

Une IA qui décide seule · une Mission qui connaît le CRM · un composant
spécifique à un métier · une règle métier codée dans l'interface · une
donnée jamais exploitée · une fonctionnalité demandée par un seul client ·
optimiser le taux de complétion au détriment de la qualité du dossier.

## Ce que Métré Build n'est pas

Pas un formulaire, pas un chatbot généraliste, pas un CRM, pas un
configurateur/CPQ, pas un CMS/outil marketing. Le produit **alimente** ces
systèmes (CRM, CPQ) en aval, il ne les remplace pas.
