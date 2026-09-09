<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

## Ma Reliure

This repository serves two public brands from one codebase: **Métré Build**
(the generic qualification engine) and **Ma Reliure** (the bookbinding
marketplace built on it, live at https://mareliure.fr).

Before modifying Ma Reliure:

1. Read `docs/CODEX_HANDOFF.md` — start with its `## Latest handoff` block,
   which says what the previous agent finished and what to do next.
2. Inspect `git status` and the current branch. Only one agent works at a time,
   and never two on the same branch.
3. Do not put marketplace business rules in `src/build/` — the engine must stay
   generic. Express them in the Playbook
   (`src/build/playbooks/bookbindingPlaybookSchema.ts`, which is data) or in
   `src/marketplace/`.
4. Never commit credentials. `.env*` is ignored except `.env.example`, and
   `src/marketplace/secretsContract.test.ts` fails if a secret reaches the
   client bundle.
5. **Never invent a price.** No amount belongs in `src/marketplace/pricing/`
   outside the commercial policy (target margin, floor, rounding). Real
   amounts come from binder rate cards; without them the engine returns
   `manual_review` and no figure at all. `noFabricatedPrices.test.ts` reads the
   files to enforce it. Same rule for images: nothing ships that is not
   registered in `docs/content-assets.md` with an identifiable authorisation.
6. Run `npm test` and `npm run typecheck` before handing work back, then update
   the `## Latest handoff` block.

`CLAUDE.md` at the repository root carries the product vocabulary rules and
applies to every agent, not only Claude.
