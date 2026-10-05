#!/usr/bin/env python3
"""Discover new prospection candidates when search engines are unavailable.

Why this exists: as of Sept 2026 every free search path is blocked for us --
web_search billing is exhausted, Brave returns 429, DuckDuckGo bills fail,
Ecosia/Mojeek return 403, Startpage/Yandex redirect. Without a discovery
source the daily 1:1 cadence stops.

Pipeline:
  1. Gemini (Google AI) proposes candidate company domains for a niche+region.
  2. EVERY domain is verified over HTTP before use -- the model returns no
     grounding sources, so an unverified list would be fabrication.
  3. Contact emails are extracted from the live pages only.
  4. Candidates are filtered against the exclusion lists.

Nothing here sends email. Output is a candidate file for the sending step.

Usage:
  python scripts/discover_prospects.py --market us --niche "deck builders" \
      --region Texas --want 12
  python scripts/discover_prospects.py --market fr \
      --niche "négoces de bois indépendants" --region "Occitanie" --want 12
"""
import argparse, json, os, re, subprocess, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = os.path.expanduser(r'~\AppData\Local\hermes\profiles\build\.env')
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/120 Safari/537.36')
EMAIL_RE = re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
GEMINI_MODEL = 'gemini-3.8-flash'
BAD_EMAIL = ('metre-pro', 'smtp-relay', 'mailin', 'example.', 'sentry', 'wixpress',
             'noreply', 'no-reply', 'wordpress', 'cloudflare', 'domain.com',
             'email.com', 'yourdomain', 'sentry.io', 'godaddy', 'squarespace')
# Asset filenames trip the email regex ("logo@2x.png"), and template
# placeholders do too ("you@email.com"). Both were ~40% of raw candidates in
# the first real runs, so they are filtered here rather than downstream.
BAD_SUFFIX = ('.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.css', '.js')
BAD_LOCAL = ('you', 'your', 'yourname', 'email', 'name', 'user', 'someone',
             'example', 'test', 'info@info', 'contact@contact')


def is_bad_email(addr):
    a = addr.lower()
    if any(b in a for b in BAD_EMAIL):
        return True
    if a.endswith(BAD_SUFFIX):
        return True
    local = a.split('@')[0]
    if local in BAD_LOCAL:
        return True
    return False


def load_key(name):
    with open(ENV, encoding='utf-8', errors='ignore') as f:
        for line in f:
            if line.startswith(name + '='):
                return line.strip().split('=', 1)[1].strip('"')
    raise SystemExit(f'{name} not found in {ENV}')


def gemini_domains(api_key, niche, region, want):
    prompt = (
        f"List {want + 8} real {region} {niche} companies. "
        "Independent businesses only, never franchises or national groups. "
        "Return ONLY the official website domains, one per line, no numbering, "
        "no commentary. Domains must be ones you are confident exist. "
        "If unsure about a domain, omit it."
    )
    payload = {
        'contents': [{'parts': [{'text': prompt}]}],
        'tools': [{'google_search': {}}],
    }
    tmp = os.path.expanduser(r'~\AppData\Local\Temp\discover_payload.json')
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(payload, f)
    r = subprocess.run(
        ['curl', '-s', '-m', '90', '-X', 'POST',
         f'https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}',
         '-H', 'Content-Type: application/json', '--data-binary', f'@{tmp}'],
        capture_output=True, text=True, timeout=120)
    try:
        res = json.loads(r.stdout)
        text = ''.join(p.get('text', '')
                       for p in res['candidates'][0]['content']['parts'])
    except Exception:
        return []
    out = []
    for tok in re.findall(r'[a-z0-9][a-z0-9.-]*\.[a-z]{2,}', text.lower()):
        if tok not in out and 'google' not in tok and len(tok) > 5:
            out.append(tok)
    return out[:want + 8]


def alive(domain):
    r = subprocess.run(
        ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', '-m', '14', '-L',
         '-A', UA, f'https://{domain}'],
        capture_output=True, text=True, timeout=25,
        encoding='utf-8', errors='replace')
    code = (r.stdout or '').strip()
    return code.startswith(('2', '3')), code


def emails_on(domain):
    for url in (f'https://{domain}', f'https://{domain}/contact',
                f'https://{domain}/contact-us', f'https://{domain}/nous-contacter'):
        r = subprocess.run(['curl', '-s', '-L', '-m', '18', '-A', UA, url],
                           capture_output=True, text=True, timeout=25,
                           encoding='utf-8', errors='replace')
        found = {e.lower() for e in EMAIL_RE.findall(r.stdout or '')
                 if not is_bad_email(e)}
        if found:
            return sorted(found)
    return []


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--market', choices=['us', 'fr'], required=True)
    ap.add_argument('--niche', required=True)
    ap.add_argument('--region', required=True)
    ap.add_argument('--want', type=int, default=10)
    args = ap.parse_args()

    api_key = load_key('GOOGLE_API_KEY')
    excl_path = os.path.join(BASE, 'tmp', f'exclusion-{args.market}.txt')
    excl_all = os.path.join(BASE, 'tmp', 'exclusion-all.txt')
    excl = set()
    for p in (excl_path, excl_all):
        if os.path.exists(p):
            with open(p, encoding='utf-8') as f:
                excl |= {l.strip().lower() for l in f if l.strip()}
    excl_domains = {e.split('@')[-1] for e in excl if '@' in e}

    print(f'Gemini: {args.region} / {args.niche} ...')
    cands = gemini_domains(api_key, args.niche, args.region, args.want)
    print(f'  {len(cands)} domaines proposes')

    rows, seen = [], set()
    for d in cands:
        if d in seen or d in excl_domains:
            continue
        seen.add(d)
        ok, code = alive(d)
        if not ok:
            print(f'  ✗ {d:38} HTTP {code}')
            continue
        mails = emails_on(d)
        mails = [m for m in mails if m not in excl
                 and m.split('@')[-1] not in excl_domains]
        if not mails:
            print(f'  ~ {d:38} vivant, aucun email public')
            continue
        print(f'  ✓ {d:38} {mails[0]}')
        rows.append({'domain': d, 'email': mails[0], 'all_emails': ';'.join(mails)})
        if len(rows) >= args.want:
            break

    out = os.path.join(BASE, 'tmp', f'candidats-{args.market}.csv')
    with open(out, 'w', encoding='utf-8', newline='') as f:
        f.write('domain,email,all_emails\n')
        for r in rows:
            f.write(f"{r['domain']},{r['email']},{r['all_emails']}\n")
    print(f'\n{len(rows)} candidats utilisables -> {out}')
    print('Verifier visuellement avant tout envoi.')


if __name__ == '__main__':
    main()