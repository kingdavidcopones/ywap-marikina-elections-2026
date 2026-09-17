# YWAP Marikina Elections 2026

A responsive election platform built with Next.js, Astryx Design, Supabase, and Vercel.

## Architecture

- Elections, positions, candidates, voter eligibility, participation, anonymous ballots, results, and audit events are persisted in Supabase.
- The Supabase service-role key is used only by Next.js route handlers and is never sent to the browser.
- Voter verification creates a signed, HTTP-only session. Participation and anonymous selections are stored separately.
- Ballots are validated and submitted in one PostgreSQL transaction, including duplicate-vote prevention.
- Admin access uses an environment-backed credential and a signed, HTTP-only session.
- Nominations have separate Youth Records, paged admin tables, and atomic public submissions. Anyone with a published form link can nominate, including more than once.
- There is no application seed data. The CSV under `tests/fixtures/` is used only by the end-to-end test.

## Environment

Copy `.env.example` to `.env.local` and configure:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=use-a-strong-password
SESSION_SECRET=use-a-long-random-secret
```

Apply the SQL files in `supabase/migrations/` in filename order to the Supabase project, including `202609170003_nominations.sql` and `202609180001_nomination_age_groups.sql` for the nomination feature. Apply the new age-group migration before deploying the updated nomination form. Do not expose `SUPABASE_SERVICE_ROLE_KEY` as a `NEXT_PUBLIC_` variable.

## Run and verify

```bash
npm install
npx playwright install chromium
npm run typecheck
npm run build
node --test tests/nomination-csv.test.mjs tests/nomination-age-groups.test.mjs
npm run test:e2e
npx astryx doctor
```

The end-to-end test imports all 45 rows from `tests/fixtures/mock-voters.csv`, creates a temporary election, verifies a voter, submits a ballot, checks duplicate prevention, validates results and the audit log, and removes the temporary election.

The nomination live test is opt-in because it writes synthetic records to the configured Supabase project. It deletes its test nomination when finished:

```bash
NOMINATION_LIVE_TEST=1 npx playwright test tests/e2e/nomination-live.spec.ts
```

## Deploy

Set the five environment variables above for Preview and Production in Vercel, apply the migration to Supabase first, then deploy the Next.js project. Validate the deployment with:

```bash
PLAYWRIGHT_BASE_URL=https://your-deployment.vercel.app npm run test:e2e
```
