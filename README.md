# YWAP Marikina Elections 2026

A responsive election platform built with Next.js, Astryx Design, Supabase, and Vercel.

## Architecture

- Elections, positions, candidates, voter eligibility, participation, anonymous ballots, results, and audit events are persisted in Supabase.
- The Supabase service-role key is used only by Next.js route handlers and is never sent to the browser.
- Voter verification creates a signed, HTTP-only session. Participation and anonymous selections are stored separately.
- Ballots are validated and submitted in one PostgreSQL transaction, including duplicate-vote prevention.
- Admin access uses an environment-backed credential and a signed, HTTP-only session.
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

Apply `supabase/migrations/202609150001_initial_schema.sql` to the Supabase project. Do not expose `SUPABASE_SERVICE_ROLE_KEY` as a `NEXT_PUBLIC_` variable.

## Run and verify

```bash
npm install
npx playwright install chromium
npm run typecheck
npm run build
npm run test:e2e
npx astryx doctor
```

The end-to-end test imports all 45 rows from `tests/fixtures/mock-voters.csv`, creates a temporary election, verifies a voter, submits a ballot, checks duplicate prevention, validates results and the audit log, and removes the temporary election.

## Deploy

Set the five environment variables above for Preview and Production in Vercel, apply the migration to Supabase first, then deploy the Next.js project. Validate the deployment with:

```bash
PLAYWRIGHT_BASE_URL=https://your-deployment.vercel.app npm run test:e2e
```
