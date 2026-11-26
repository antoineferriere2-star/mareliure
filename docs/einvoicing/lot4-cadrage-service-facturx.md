# Facturation électronique — Lot 4 : cadrage du service Factur-X isolé

Document du 26 novembre 2026. Cadrage seulement : aucun service n'est construit, aucun hébergement n'est choisi, aucun code n'est modifié. Il prépare la décision d'Antoine et sert de base aux PR du lot 4.

## 1. Question préalable : le service est-il nécessaire ?

Factur-X est un fichier hybride : un PDF lisible avec le XML structuré en pièce jointe. La réforme impose de transmettre une facture **dans un format structuré** par une plateforme agréée (PA), mais pas nécessairement Factur-X : une PA accepte aussi le XML seul (UBL ou CII). Notre traduction EN 16931 du lot 3 (`enInvoice.ts`) produit déjà le modèle structuré, et ses noms de champs sont ceux que certaines PA acceptent en JSON.

Conséquence : **le service Factur-X n'est peut-être pas nécessaire à la conformité.** Il ne le devient que si (a) la PA retenue n'accepte pas notre modèle et exige un fichier CII ou Factur-X que nous devons fabriquer, ou (b) nous voulons remettre au client de l'atelier un fichier hybride (confort, archivage), ou (c) la PA ne fabrique pas elle-même le format de sortie.

**À faire avant de construire** : ajouter aux demandes de devis du lot 1 la question « votre API accepte-t-elle un JSON EN 16931, un XML CII ou un Factur-X en entrée, et produit-elle elle-même le format de sortie ? » (§5 de `lot1-decision-pa.md`). Selon la réponse, le lot 4 est réduit à un simple adaptateur de format (sans JVM), ou reste tel que décrit ci-dessous. Cette hypothèse n'est pas vérifiée.

## 2. Contraintes du système actuel

- **Le Worker ne peut pas faire tourner Mustangproject ni veraPDF** : ce sont des programmes Java, et le Worker n'exécute que JavaScript et WebAssembly (`docs/factur-x-feasibility.md`). Le service est donc externe.
- **Le PDF émis est figé** : `pdf_path` et `pdf_sha256` ne s'écrivent qu'une fois, la pose du PDF est journalisée dans la chaîne de l'émetteur, et le fichier n'est jamais régénéré (`issuedDocumentPdf.server.ts`). Le fichier hybride ne peut donc pas remplacer le PDF figé.
- **Les documents sont en PDF/A-3B** (`da8323e`) avec polices et profil colorimétrique embarqués : la base nécessaire existe.
- **Les données sont personnelles** (nom, adresse, montants du client de l'atelier) : hébergement dans l'Union européenne, aucune conservation dans le service, aucune donnée dans les journaux.
- **Le prototype local du 3 novembre** a produit un Factur-X conforme : veraPDF conforme (146 règles, 3 294 contrôles), XML conforme aux XSD, aucun échec Schematron CEN et FNFE. Il n'a pas été industrialisé et ne comporte pas de rapport Mustangproject sur la chaîne finale.

## 3. Architecture proposée

```
Worker (Ma Reliure)                          Service Factur-X (hors Worker)
  pièce émise ─▶ buildEnInvoice (lot 3)
  ├─ refus ? ─▶ statut « à corriger » (catalogue des refus)
  └─ ok ─▶ file de travail ─────────────────▶ POST /v1/facturx
        (idempotence : pièce + empreinte           ├─ lit le PDF figé (URL signée courte)
         du PDF figé + version de norme)           ├─ XML CII EN 16931 depuis le JSON du Worker
                                                   ├─ attache le XML, métadonnées XMP, relation AF
        ◀──────────────── réponse ────────────────├─ valide XSD + Schematron + PDF/A + hybride
        stocke, journalise, met à jour le statut   └─ renvoie fichier + rapport (ou erreur motivée)
```

**Principes**
1. **Le service ne décide rien.** Il reçoit une pièce déjà traduite et validée côté Worker (lot 3), la transforme et la contrôle. Aucune règle fiscale n'y vit.
2. **Asynchrone.** L'émission d'une facture ne dépend jamais du service : s'il tombe, la facture est émise et son fichier structuré est produit plus tard, avec reprise.
3. **Un artefact invalide n'est jamais transmissible.** Seul un fichier dont les quatre contrôles passent reçoit le statut « valide ». Le rapport de validation est conservé avec le fichier.
4. **Le PDF figé n'est jamais modifié.** Le fichier hybride est un second artefact, lié au premier par son empreinte.

### Contrat du service (proposition)

Entrée : identifiant de pièce, empreinte SHA-256 du PDF figé, lien signé de lecture du PDF figé (valable quelques minutes), JSON EN 16931 de la pièce, version de la norme et profil `EN16931`.
Sortie : fichier hybride, XML seul, rapport de validation (contrôle, règle, gravité), versions des outils utilisés, empreintes.
Erreurs motivées : entrée invalide, PDF non conforme PDF/A-3, règle Schematron échouée, délai dépassé. Jamais un « succès » accompagné d'un rapport en échec.
Idempotence : même pièce, même empreinte et même version de norme ⇒ même réponse, sans produire un second artefact.

### Stockage et traçabilité (une migration, plus tard)

Table d'artefacts structurés, en écriture unique, accessible au service avec la clé de service seulement : pièce, empreinte du PDF source, format, version de la norme, chemin et empreinte du fichier hybride, du XML et du rapport, statut de validation, versions des outils, dates. Fichiers dans un compartiment privé, comme les PDF émis. Chaque production et chaque échec alimentent la chaîne de l'émetteur, comme l'anomalie d'intégrité du PDF. Cette table se rattache aux colonnes déjà réservées (`structured_format`, `provider_invoice_id`, `reporting_status`).

### Sécurité

Appel du Worker au service authentifié par signature (secret partagé, horodatage, courte validité) ou certificat mutuel ; le service n'est pas public. Aucun stockage persistant : fichiers temporaires effacés après réponse. Journaux sans contenu ni donnée de client. Secrets gérés comme les autres du Worker. Dépendances Java épinglées et analysées.

## 4. Options d'hébergement du service

Aucun prix n'a été relevé : à obtenir avant décision. Volume attendu très faible (de l'ordre de 10 000 factures par an pour une centaine d'ateliers actifs), le coût d'exploitation sera dominé par l'abonnement à l'hébergeur, pas par l'usage.

| Option | Pour | Contre ou à vérifier |
|---|---|---|
| **Conteneur Cloudflare** (même plateforme que le Worker) | Un seul fournisseur, appel direct depuis le Worker, déploiement unique | Offre récente : disponibilité, régions et conditions à vérifier ; localisation des données non garantie en Union européenne à ce stade |
| **Conteneur à la demande en Union européenne** (Cloud Run Paris, Scaleway France, Fly.io Paris) | Mise à zéro quand inactif, région européenne choisie, simple | Second fournisseur à administrer, démarrage à froid de quelques secondes (acceptable en asynchrone) |
| **Petite machine virtuelle dédiée en France** | Prix fixe, maîtrise totale | Mises à jour, surveillance et sauvegardes à notre charge, disponibilité à assurer |
| **Aucun service** (si la plateforme fabrique le format) | Rien à héberger | Dépend de la réponse de la plateforme (§1) |

Ma recommandation provisoire : **conteneur à la demande en Union européenne**, si le service est nécessaire. À confirmer après les devis des plateformes.

## 5. Versions à épingler

- **Factur-X :** le rapport de faisabilité cite la 1.08 ; Codex a relevé la 1.09.2 comme publication actuelle du FNFE. La version acceptée par la plateforme décide : à figer avec elle.
- **Mustangproject, veraPDF, Schematron CEN et FNFE :** versions précises à choisir au lancement du prototype et inscrites dans le rapport de chaque validation. Toute mise à jour se qualifie sur le corpus avant d'être déployée.

## 6. Tests et qualification

- Le **corpus du lot 3** (deux et trois taux, remise, lot de livres, franchise, particulier, avoir partiel) sert de base : mêmes pièces, produites jusqu'au fichier hybride.
- Contrôle centime par centime entre la base, le XML et le texte extrait du PDF.
- Validation automatique à chaque production, et dans l'intégration continue sur un corpus de non-régression.
- Cas négatifs : XML invalide, métadonnées incohérentes, pièce jointe absente, PDF non conforme, arrondis divergents.
- Idempotence et reprise : une même pièce ne produit qu'un artefact ; une nouvelle tentative conserve l'historique.
- Aucune recette contre une plateforme avant d'avoir un accès à son environnement d'essai.

## 7. Découpage en PR (une fois le §1 tranché)

| PR | Contenu | Sortie |
|---|---|---|
| 4a | Prototype du service hors production, sur le corpus du lot 3, avec rapport complet (Mustangproject, veraPDF, Schematron) | Fichiers valides et rapports reproductibles |
| 4b | Contrat du service et client côté Worker, derrière un drapeau fermé | Tests de contrat, mock du service |
| 4c | Migration des artefacts structurés (écriture unique, journal) | Migration rejouée dans PGlite, appliquée par Codex |
| 4d | File de travail, reprise, statuts, écran de l'atelier | Parcours bout en bout sur pièces d'essai |
| 4e | Déploiement du service, secrets, surveillance | Mise en service progressive, ateliers pilotes |

## 8. Décisions à prendre

1. **Le service est-il nécessaire ?** Réponse attendue des plateformes (§1).
2. **Hébergement** (§4), après relevé des prix.
3. **Version de Factur-X** à viser, avec la plateforme.
4. **Faut-il remettre un fichier hybride au client de l'atelier**, ou la facture structurée transmise par la plateforme suffit-elle ?
