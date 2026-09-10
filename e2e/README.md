# E2E tests (Playwright)

Run with `npm run test:e2e` (starts the dev server automatically) or
`npm run test:e2e:ui` for the interactive runner.

## Current default scope: public marketing site

`public-site.spec.ts` covers the anonymous surface — page loads, nav (desktop
header + mobile footer), the `/private-beta` stepper's client-side validation
gating, and the `/free-inquiry-audit` form rendering. These tests never click
a final Submit button, because both of those forms write real rows to the
live Supabase project — there is no separate test/staging project configured
for this app yet.

## Optional authenticated smoke test

`authenticated-portal.spec.ts` is skipped by default. It runs only when both
`E2E_CLIENT_EMAIL` and `E2E_CLIENT_PASSWORD` are set, and expects that account
to already exist and have portal access. It signs in through `/auth` and checks
that the client reaches `/portal`. Do not use a personal or production customer
account for this; use a disposable staging client account.

## Optional managed marketplace reference journey

`managed-marketplace-reference.spec.ts` covers the P0.5 journey across three
separate browser sessions: admin validates 490/400 EUR, sends the fixed offer,
the workshop accepts, the admin selects it, and the customer sees one 490 EUR
price plus the selected workshop. It is skipped unless every
`E2E_MARKETPLACE_*` variable named at the top of the spec is set. Point it only
at the development Supabase project with a fresh case already owned by the
disposable customer account and a compatible approved workshop; the scenario
changes that case and is intentionally not aimed at production.

## Visitor summary + Deck visual preview (seeded, self-tearing-down)

`visitor-summary-visual-preview.spec.ts` is skipped by default. It runs only
when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are both set (same
credentials `scripts/seedDeckPlaybook.ts` already uses). Unlike the seed
script, it does NOT touch the real demo Mission — `e2e/fixtures/
deckPreviewFixtures.ts` provisions two brand-new, clearly-tagged
("E2E TEST — ...") Missions sharing the already-published Deck Playbook
version, drives real visitor submissions through them, and deletes every
row it created (workspace, Missions, sessions, dossiers, access tokens) in
`afterAll` — this project has only one Supabase project (production, see
above), so nothing test-shaped should ever be left behind. The visitor
email used throughout is `contact@oppe.fr`, a safe address the project
owner controls.

## Deliberately out of scope for now

The self-service journey the mission cares about most — sign up, AI-driven
onboarding (site analysis, draft generation), publish a Mission, submit as an
anonymous visitor, see the Dossier appear back in the owner's portal — is not
covered end-to-end here yet. Automating it safely needs a design decision, not
just more test code:

- **Signup**: self-service auth requires a confirmed email. The clean way to
  get a confirmed test user without solving email retrieval is a Playwright
  global-setup script that pre-provisions one via the Supabase admin client
  (`createUser({ email_confirm: true })`, using the same service-role key
  already used by scripts/seedDeckPlaybook.ts) — never expose that as an
  HTTP route.
- **AI onboarding**: site analysis and draft generation call the real
  Anthropic API against a real website fetch. Every CI run would cost real
  tokens and the output isn't byte-identical run to run, making assertions
  fragile. The pragmatic middle ground is to exercise publish/pause/visitor
  submission against a Playbook seeded directly in the DB (bypassing the AI
  step, same pattern as `scripts/seedDeckPlaybook.ts`) rather than driving
  the wizard's AI steps through the UI.
- **Teardown**: any test that provisions a workspace/user must delete it
  afterward (global teardown, same admin client) so test runs never
  accumulate real-looking data in production tables.

Building that harness is a separate, deliberate piece of work — flagged here
rather than done partially and left half-safe.

## Optional order-tracking journey (Ma Reliure)

`project-thread.spec.ts` covers the order-tracking scenario from start to
finish across three browser sessions, with no e-mail or phone number exchanged
between the customer and the workshop: Ma Reliure confirms the order; the
workshop confirms reception, posts a message, starts the work and asks for a
leather colour with one photo per option; the customer chooses Bordeaux; the
workshop sees the confirmed choice and asks the customer to confirm the text to
gild; the customer confirms it; the workshop posts a progress photo and marks
the work finished; the customer reads "Votre livre est terminé". It also checks
that a phone number is refused in the thread.

It is skipped unless every `E2E_PROJECT_*` variable named at the top of the spec
is set. Point it only at the development Supabase project, with a case already
in `binder_selected`, owned by the disposable customer account, whose selected
workshop is the disposable workshop account. The scenario moves that case
forward and cannot be replayed on the same case.
