# Phase 1 — recette de la numérotation en concurrence

PGlite n'ouvre qu'une connexion : les tests du dépôt prouvent l'absence de trou après une émission
refusée, pas le comportement sous accès simultanés. Cette recette se joue **sur une copie** de la base
(jamais la production), avec un PostgreSQL natif et `psql`.

Elle vise la brique dont dépend toute numérotation de facture et d'avoir :
`marketplace_binder_next_document_number`, qui incrémente le compteur par un `INSERT … ON CONFLICT DO
UPDATE` (verrou de ligne). L'émission (`marketplace_binder_issue_invoice`) verrouille en plus la facture
(`FOR UPDATE`) avant de demander un numéro.

## 1. Préparer

```bash
export COPY_URL="postgresql://…copie…"   # jamais l'URL de production
export BINDER=$(psql "$COPY_URL" -Atc "SELECT id FROM marketplace_binders ORDER BY created_at LIMIT 1")
```

L'année 2999 isole le compteur de la recette de toute série réelle de la copie.

## 2. Lancer 200 demandes de numéro, 20 à la fois

```bash
seq 1 200 | xargs -P 20 -I{} psql "$COPY_URL" -Atc \
  "SELECT public.marketplace_binder_next_document_number('$BINDER', 'invoice', 2999)" > numeros.txt
```

## 3. Vérifier

```bash
wc -l < numeros.txt                      # 200
sort numeros.txt | uniq -d | wc -l       # 0 : aucun doublon
sed 's/.*-//' numeros.txt | sort -n | awk 'NR != $1 + 0 { bad = 1 } END { exit bad }' && echo "continu de 0001 à 0200"
psql "$COPY_URL" -Atc "SELECT last_value FROM marketplace_binder_document_counters
  WHERE binder_id = '$BINDER' AND kind = 'invoice' AND year = 2999"   # 200
```

Attendu : 200 numéros, aucun doublon, suite continue de `…-2999-0001` à `…-2999-0200`, compteur à 200.

## 4. Nettoyer la copie

```sql
DELETE FROM marketplace_binder_document_counters WHERE binder_id = :'BINDER' AND kind = 'invoice' AND year = 2999;
```

(Sur la copie seulement : la production ne reçoit ni la recette ni ce nettoyage.)
