# Journal chaîné des émetteurs — format

Migration : `supabase/migrations/20261024100000_einvoicing_phase2_journal.sql`.
Vérification hors base : `src/marketplace/ledger/journalChain.ts`.

## Émetteurs
Chaque émetteur a sa propre chaîne :
- `binder:<uuid>` : un atelier. La chaîne porte ses factures, ses avoirs, ses règlements déclarés, ses paiements en ligne, ses factures à OPPE et les paiements qu'OPPE lui verse.
- `oppe` : OPPE SAS. La chaîne porte ses factures, ses avoirs, les paiements Stripe des commandes et les remboursements.

## Une entrée
| Colonne | Contenu |
| --- | --- |
| `seq` | Rang dans la chaîne de l'émetteur, à partir de 1, sans trou. |
| `event` | `issued`, `payment`, `refund`, `submitted`, `pdf_stored`, `prefix_change`, `closure`, `export`, `pdf_integrity_failure`, `modification_refused`, `attestation_draft`. |
| `event_key` | Clé d'unicité : un même fait n'est jamais journalisé deux fois. |
| `document_kind`, `document_id` | La pièce concernée, s'il y en a une. |
| `occurred_at` | L'instant d'écriture, lu par l'horloge d'émission. |
| `actor` | `system`, `backfill`, ou l'identifiant de la personne. |
| `payload` | Le contenu (voir plus bas). |
| `canonical` | La forme canonique de l'enveloppe (voir plus bas). |
| `prev_hash` | L'empreinte de l'entrée précédente du même émetteur ; 64 zéros pour la première. |
| `hash` | `SHA-256` (hexadécimal, minuscules) des octets UTF-8 de `prev_hash + "\n" + canonical`. |

## Enveloppe et forme canonique
L'enveloppe hachée est l'objet suivant :

```
{ "issuer", "seq", "event", "event_key", "document_kind", "document_id",
  "occurred_at" (UTC, "AAAA-MM-JJTHH:MM:SS.ffffffZ"), "actor", "payload" }
```

La forme canonique d'une valeur JSON suit ces règles :
- **Objet** : `{` puis les paires `"clé":valeur` séparées par `,`, triées par point de code de la clé (ordre `COLLATE "C"`), puis `}`. Aucun espace.
- **Tableau** : `[` puis les valeurs dans leur ordre, séparées par `,`, puis `]`.
- **Chaîne** : échappement JSON standard (`\"`, `\\`, `\b`, `\f`, `\n`, `\r`, `\t`, `\u00XX` pour les autres caractères de contrôle). Les autres caractères restent tels quels, en UTF-8.
- **Nombre** : tel que PostgreSQL l'écrit. Les montants sont des centimes entiers et les taux des points de base entiers. Une quantité `numeric(10,2)` s'écrit par exemple `1.00`.
- **`true`, `false`, `null`.**

Le journal stocke la forme canonique telle qu'elle a été hachée. Vérifier une archive ne demande donc que de recalculer les empreintes, sans reconstruire le JSON.

## Contenu (`payload`)
Pour une pièce, c'est la ligne entière telle qu'à l'émission, moins ses seules colonnes légitimement mobiles. Pour les factures, ces colonnes sont :
- le statut ;
- l'état de paiement ;
- l'état de transmission électronique ;
- le PDF.

Les lignes de la pièce sont ajoutées sous `lines`.

Lors de la vérification, ce contenu est **relu dans la table** et comparé, restreint aux clés journalisées. Ainsi, une colonne ajoutée plus tard ne fait pas passer une pièce intacte pour modifiée ; en revanche, une colonne retirée est signalée. C'est le cas pour :
- les factures et avoirs d'atelier ;
- les règlements déclarés ;
- les factures d'atelier à OPPE et leurs paiements ;
- les factures et avoirs OPPE.

Pour les paiements en ligne, les paiements OPPE et les remboursements, le contenu est un instantané pris au moment de l'événement : leurs lignes changent légitimement (statut Stripe). La chaîne seule les protège.

## Vérification (`marketplace_journal_verify`)
Pour chaque entrée, dans l'ordre :
1. Le rang suit le précédent (`seq_gap`).
2. `prev_hash` égale l'empreinte précédente (`prev_hash_mismatch`).
3. La forme canonique recalculée depuis les colonnes égale celle qui est stockée (`canonical_mismatch`).
4. L'empreinte se recalcule (`hash_mismatch`).
5. La pièce existe encore (`document_missing`) et n'a pas changé (`document_modified`).
6. Pour un PDF, l'empreinte enregistrée sur la pièce n'a pas changé (`pdf_hash_changed`).

Enfin, toute pièce émise de l'émetteur doit figurer au journal (`document_not_journaled`).

## Clôtures
Une clôture est une entrée `closure`, chaînée comme les autres. Son contenu porte :
- la période ;
- l'empreinte de la clôture précédente du même type ;
- le rang et l'empreinte de la dernière entrée couverte ;
- les totaux : nombre de factures et d'avoirs, HT, TVA, TTC (avoirs en négatif), TVA par taux, encaissements par mode.

Une entrée appartient à la période de son instant d'écriture, en jour civil à Paris. Une entrée ne peut donc jamais tomber dans une période déjà close.

Il y a trois types de clôture :
- **Jour** : seulement les jours où il s'est passé quelque chose. Le coût est négligeable et aucune entrée n'est vide.
- **Mois** et **année** : continus, y compris vides, de la première activité de l'émetteur à la dernière période échue.

Elles sont générées chaque nuit par `pg_cron` quand il est disponible, et dans tous les cas rattrapées avant chaque vérification et chaque export (`marketplace_journal_close_due`).

## Limites connues
- **Tentatives de modification refusées** : un refus de la base annule la transaction qui le porte, donc la base ne peut pas inscrire elle-même ce refus. L'application l'inscrit, par un appel séparé, quand elle reçoit une erreur d'immuabilité ou refuse elle-même la modification d'une pièce émise. Une écriture SQL directe refusée, hors application, n'est pas journalisée ; elle ne change rien non plus.
- **Contournement des déclencheurs** : un accès d'administration de la base peut suspendre les déclencheurs. La chaîne ne l'empêche pas, elle le **révèle** à la vérification suivante.
