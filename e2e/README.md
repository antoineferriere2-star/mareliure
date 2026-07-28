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
