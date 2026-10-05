#!/usr/bin/env python3
"""Refresh Métré prospection exclusion lists from ALL sources.

Market split is derived from the CSV the address came from — the only
reliable signal, since French independents sit on .com/Gmail/Orange as
often as on .fr.

Sources:
  1. Market CSVs: data/prospects-fr*.csv + tmp/fr-*.csv   -> FR
                  tmp/us-prospects*.csv + tmp/us-*.csv    -> US
  2. Full Brevo transactional history (60 days) -- added to the MASTER
     list and to both buckets, because an address contacted once must
     never be contacted again regardless of market.

Outputs:
  tmp/exclusion-all.txt   master, every email ever contacted
  tmp/exclusion-fr.txt    French-market addresses
  tmp/exclusion-us.txt    US-market addresses

Run before every prospection batch.
"""
import os, re, json, subprocess, glob

BASE = r'C:\Users\antoi\Buil AI'
ENV = os.path.expanduser(r'~\AppData\Local\hermes\profiles\build\.env')
EMAIL_RE = re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
SKIP = ('metre-pro', 'smtp-relay', 'mailin', 'example.com')


def emails_in(path):
    try:
        with open(path, encoding='utf-8', errors='ignore') as f:
            return {e.lower() for e in EMAIL_RE.findall(f.read())
                    if not any(s in e.lower() for s in SKIP)}
    except Exception:
        return set()


def brevo_history():
    key = None
    with open(ENV, encoding='utf-8') as f:
        for line in f:
            if line.startswith('BREVO_API_KEY='):
                key = line.strip().split('=', 1)[1]
    if not key:
        return set()
    r = subprocess.run(
        ['curl', '-s',
         'https://api.brevo.com/v3/smtp/statistics/events?limit=2000&days=60',
         '-H', f'api-key: {key}'],
        capture_output=True, text=True, timeout=60)
    raw = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]', '', r.stdout)
    try:
        ev = json.loads(raw)
    except Exception:
        return set()
    return {(e.get('email') or '').lower() for e in ev.get('events', [])
            if e.get('email') and not any(s in e['email'].lower() for s in SKIP)}


def main():
    fr, us = set(), set()

    # --- Market buckets from CSV provenance (authoritative) ---
    for path in glob.glob(os.path.join(BASE, 'data', '*.csv')):
        name = os.path.basename(path).lower()
        if 'prospect' in name and ('us' in name or 'build' in name):
            us |= emails_in(path)
        elif 'prospect' in name:
            fr |= emails_in(path)
    for path in glob.glob(os.path.join(BASE, 'tmp', '*.csv')):
        name = os.path.basename(path).lower()
        if not ('prospect' in name or name.startswith('us-') or name.startswith('fr-')):
            continue
        if name.startswith('us-'):
            us |= emails_in(path)
        elif name.startswith('fr-'):
            fr |= emails_in(path)
        elif 'us' in name:
            us |= emails_in(path)
        else:
            fr |= emails_in(path)

    # --- Brevo history: authoritative for "already contacted", market-agnostic ---
    hist = brevo_history()

    # Never let an address live in both buckets.
    fr -= us
    us -= fr

    # Addresses seen in Brevo but absent from every CSV predate the CSV
    # discipline — add them to the master and to the bucket they look like.
    master = fr | us | hist
    for e in (hist - fr - us):
        if e.split('@')[-1].endswith('.fr'):
            fr.add(e)
        else:
            us.add(e)

    os.makedirs(os.path.join(BASE, 'tmp'), exist_ok=True)
    for name, data in (('exclusion-all.txt', master),
                       ('exclusion-fr.txt', fr),
                       ('exclusion-us.txt', us)):
        with open(os.path.join(BASE, 'tmp', name), 'w', encoding='utf-8') as f:
            f.write('\n'.join(sorted(data)))

    print(f"FR bucket : {len(fr)}")
    print(f"US bucket : {len(us)}")
    print(f"MASTER    : {len(master)} (dont {len(hist)} vus dans Brevo)")


if __name__ == '__main__':
    main()