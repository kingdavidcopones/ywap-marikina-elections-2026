# YWAP Marikina Elections 2026 — Design Direction

Status: confirmed MVP direction. Remaining governance and production-readiness questions are listed in **Open decisions**.

## 1. Product experience

The product has two deliberately different modes that share one brand system:

- **Admin:** a clean, efficient dashboard inside a persistent application shell. It prioritizes scanning, filtering, review, and confident operational actions.
- **Voter:** a focused, calm, two-column official ballot flow with a quiz-like step pattern. It prioritizes comprehension, progress, anonymity, and one clear decision at a time.

The visual character is civic, approachable, and trustworthy. Prefer generous whitespace, a clear reading order, restrained color, and direct language. Avoid campaign-like visual noise, decorative gradients, glass effects, excessive cards, and playful motion that could reduce confidence in the process.

### Confirmed platform baseline

- **Frontend framework:** React with Next.js App Router and TypeScript.
- **Hosting:** Vercel.
- **Backend and data platform:** Supabase.
- **Delivery:** Responsive web application.
- **Supported device classes:** Desktop, tablet browser, and mobile browser. Tablet and mobile are first-class responsive layouts, not reduced desktop views.

Implementation should favor React-compatible Astryx components, production-built theme assets, and responsive behavior expressed through the documented layout contracts. Final Vercel and Supabase integration details—such as rendering strategy, database policy, storage, backups, and regional deployment—remain technical architecture decisions.

Confirmed MVP constraints:

- The administrator interface intentionally has no authentication and is separated only by route. This is an accepted MVP risk, not a security boundary.
- Voters verify with Member ID and last name from an imported election voter list.
- Each eligible position accepts exactly one candidate or an optional Abstain choice.
- Candidate order is deterministically randomized per voter and position; Abstain remains last.
- Voter drafts persist only for the current browser session.
- Submitted ballots are anonymous, final, atomic, and stored separately from participation records.
- While an election is Scheduled or Open, deleting the election, its positions, or its candidates is disabled. Edit permissions remain separate from this deletion lock.
- Election status is changed through explicit lifecycle actions, never a freeform status selector: Draft can be published now or scheduled; Scheduled and Open can be unpublished to Draft; Archived can be restored to Draft.
- Publishing now and scheduling are blocked until the election has at least one eligible voter, at least one position, and at least one candidate for every position. A readiness dialog names each missing item and provides direct navigation to Eligible voters and, when needed, Positions.
- **Golden rule for lifecycle actions:** publishing, scheduling, unpublishing, archiving, restoring, deleting, and other consequential state changes always require a confirmation step that names the resulting status or outcome.
- Use **Publish** only as the action label. The live election status shown in badges and summaries is **Open**, including legacy records stored as Published.
- The interface and content are English-only for MVP.
- The visual system is light-only for MVP.
- Initial development and verification are local; Vercel deployment follows after approval.

## 2. Design principles

1. **Clarity before decoration.** Every screen has one lead message and one primary action.
2. **Neutral by default, branded with intent.** Brand colors identify navigation, progress, selection, and important moments rather than tinting every surface.
3. **Confidence through state visibility.** Saving, submission, validation, eligibility, completion, and system status are never implied by color alone.
4. **Focused voter flow.** Show one question or decision group at a time, preserve context in the supporting column, and keep progress visible.
5. **Efficient admin flow.** Use rows and tables for records, cards only for standalone summaries, and preserve filter/context state while navigating.
6. **Accessible and nonpartisan.** Candidate or option order, emphasis, imagery, and color must not suggest preference.

### Voice and UX writing

The platform should sound like a calm, capable election guide: warm enough to reduce anxiety, precise enough to earn trust, and neutral toward every candidate and choice. Copy must help someone understand what is happening, why it matters, and what they can do next.

#### Core voice

- **Friendly, not playful.** Use natural contractions and familiar words, but avoid jokes, exclamation-heavy language, or campaign-style enthusiasm.
- **Useful, not generic.** Replace filler such as “Something went wrong” with the specific problem and a realistic next step.
- **Empathetic, not apologetic.** Acknowledge the person’s situation without blaming them or overusing “sorry.” Say “We couldn’t find a matching voter record” rather than “Invalid credentials.”
- **Clear about consequences.** Before irreversible actions, state exactly what cannot be undone. Do not add urgency unless there is a real deadline.
- **Neutral and private by design.** Never imply that one candidate, position, or participation choice is preferred. Explain privacy in concrete terms instead of making broad claims such as “100% secure.”

#### Writing patterns

- Lead headings with the person’s goal or the question they need to answer: “Choose a candidate for President,” “Review your ballot,” or “Set the voting schedule.”
- Use buttons for clear actions: “Find my ballot,” “Copy voting link,” “Keep reviewing,” or “Submit ballot.” Avoid vague labels such as “OK,” “Continue” when the destination is unclear, or “Process.”
- Keep one term for one concept. Use **candidate** in the interface, **voting link** for the URL shared with voters, **eligible voter list** for event access, and **ballot** for a voter’s set of choices.
- Use sentence case everywhere, including headings, buttons, table headers, dialogs, and status messages.
- Prefer active voice and name the outcome: “45 voter records were added” rather than “Import completed successfully.”
- Put essential information first. Supporting copy should explain purpose, consequence, privacy, or recovery—not repeat the heading.
- Write errors as: what happened + how to recover. Example: “We couldn’t find a matching voter record. Check your Member ID and last name, or contact the election committee.”
- Write confirmations as a direct question, followed by the consequence and two distinct choices. Example: “Submit your ballot?” + “Once submitted, you won’t be able to change your choices or submit another ballot.” + “Keep reviewing” / “Submit ballot.”
- Keep success messages specific and reassuring. Confirm what was recorded or saved, then give the next useful action.
- Explain unfamiliar election terms at the point of use. Keep **Abstain** as the official label and pair it with “Choose no candidate for this position.”

#### Tone by context

- **Voter flow:** reassuring, concise, and human. Use “you” and “we” to explain actions and privacy. Never expose implementation language such as session, record join, lifecycle, slug, or aggregate.
- **Admin flow:** direct and operational. Name the object being changed, when the change appears to voters, and whether it can be reversed. Technical terms such as CSV are acceptable when they match the administrator’s task, but explain required columns and recovery steps.
- **Errors and blocked states:** calm and nonjudgmental. Do not imply user fault. Preserve entered data whenever possible and say whether trying again is safe.
- **Destructive or final actions:** sober and explicit. The safer action receives the gentler label, while the irreversible action names the consequence exactly.

Before approving new interface copy, read it aloud and check that it is specific to this election platform. If the same sentence could appear unchanged in any generic dashboard, rewrite it with the voter’s or administrator’s actual task and next step.

## 3. Brand assets

Repository assets:

- Full wordmark: `public/brand/ywap-marikina-elections-logo-word.svg`
- Compact mark: `public/brand/ywap-marikina-elections-logo-mark.svg`

Usage:

- Use the wordmark in the admin side-navigation header, voter welcome/confirmation screens, and wide headers.
- Use the mark in compact/mobile navigation, favicons, and square avatar contexts.
- Preserve the original aspect ratio. Do not recolor individual paths, rotate, stretch, crop, add effects, or place over busy imagery.
- Keep clear space of at least one quarter of the logo height on every side.
- Recommended minimum rendered size: wordmark 110 px wide; mark 24 px square. Larger is preferred for primary branding.
- The supplied files are blue-only. A formally approved reversed/white variant is still required before placing the logo on blue or dark surfaces.

## 4. Color system

### Core palette

| Role | Value | Intended use |
|---|---:|---|
| Brand blue | `#3573B8` | Primary actions, selected navigation, progress, links, focus accents |
| Civic yellow | `#F8C217` | Highlights, attention markers, celebratory details |
| Action orange | `#EF5F29` | Warm emphasis and exceptional callouts; not the default destructive color |
| Sky blue | `#57B5E1` | Informational fills, charts, supporting illustration |
| Near white | `#FEFFFF` | Main canvas and high-emphasis surfaces |

Astryx Neutral supplies the necessary accessible neutrals for primary text, secondary text, borders, muted surfaces, success, warning, and error states. Do not replace semantic success/error colors with brand colors.

### 60–30–10 rule

Treat 60–30–10 as a composition guideline, not a literal DOM or token count:

- **60% neutral:** near-white canvas, white surfaces, whitespace, neutral text and borders.
- **30% brand structure:** blue navigation, selected states, links, progress, and blue-tinted supporting surfaces.
- **10% accents combined:** yellow, orange, and sky blue across highlights, data visualization, and moments of emphasis.

No individual accent is entitled to the full 10%. A screen may use less accent color when clarity benefits.

### Contrast rules

- Brand blue on near white is suitable for normal text and controls (approximately 4.89:1 against white).
- Yellow, orange, and sky blue do **not** meet normal-text contrast on white. Use them as fills, borders, icons, or large decorative elements with an accessible dark foreground.
- Use `--color-on-accent` only after verifying the active theme token against the actual accent. Yellow and sky blue need dark foregrounds.
- Never communicate selection, correctness, errors, status, or progress through color alone; pair color with text, shape, icon, or position.
- Initial release is **light mode only**. A dark mode needs a separately tested brand palette and reversed logo asset.

### Theme implementation

- Extend Astryx Neutral into a project theme rather than overriding `--color-*` values in `:root`.
- Map brand blue to the accent family and create muted/tinted derivatives through the theme pipeline.
- Keep yellow, orange, and sky blue as named local/data tokens with explicit semantic usage.
- Build the final custom theme with `npx astryx theme build <theme-file>` for production and import both its generated module and CSS.
- Use StyleX only where an Astryx component prop cannot express the requirement. Style values must reference Astryx tokens; no raw color or spacing values in component code.

## 5. Typography

Use **Figtree** for all interface and content text. The outlined wordmark remains unchanged and does not inherit the UI font.

- Preferred weights: 400 regular, 500 medium, 600 semibold, 700 bold.
- Body defaults to regular; labels and actions use medium; headings use semibold or bold.
- Use sentence case for headings, navigation, buttons, and table labels.
- Create hierarchy mainly through weight and text color, then size. Do not shrink supporting copy until it becomes hard to read.
- Keep voter instructions and question text within a comfortable 40–60 character line length where possible.
- Use tabular numerals for turnout, counts, dates, percentages, and result tables.
- Load Figtree through the framework's Google Fonts integration when available (for example, `next/font/google`), otherwise self-host the required WOFF2 subsets. Use `font-display: swap` and a system sans-serif fallback.

Use the Astryx typography scale and semantic components (`Heading`, `Text`) rather than hardcoded font sizes or line heights.

## 6. Spacing, shape, and elevation

- Use the Astryx spacing scale exclusively for interior padding and gaps.
- Tight gaps bind labels, values, and controls; larger gaps separate sections. Do not repeat one spacing value everywhere.
- Use the neutral theme radius as the baseline. Controls, tables, and cards should feel crisp rather than pill-heavy.
- Use borders and dividers before shadows. Elevation is reserved for overlays, menus, dialogs, and genuinely floating elements.
- Maintain one left content line within each region. Containers own padding; children do not add competing insets.
- Interactive targets should be at least 44 by 44 CSS pixels on touch layouts, using Astryx control sizes rather than custom padding.

## 7. Admin application shell

### Frame

- Use `AppShell` with a 256 px `SideNav`, a content region that fills available width, and `MobileNav` below the medium breakpoint.
- Side navigation header uses the wordmark. Primary destinations should be grouped and remain usable if the list grows.
- Recommended information architecture: Overview, Voters, Quiz content, Submissions, Results, Audit log, and Settings. Names remain provisional until the product scope is confirmed.
- Put account/help/session actions at the bottom of the navigation, separated from operational destinations.
- Each page uses `LayoutHeader` for the title, supporting context, and one primary action. Use `Toolbar` when filters or view controls are the real header content.

### Content patterns

- Overview: a restrained grid of standalone KPI `Card`s, followed by charts or operational sections.
- Voters, submissions, results, and logs: `Table` or `List` rows with sorting, filtering, pagination, and selection as needed. Do not wrap every record in a card.
- Detail inspection: open a 380 px end `LayoutPanel` on wide screens; switch it to a `Dialog` or `BottomSheet` at 1024 px and below.
- Filters belong in a toolbar or a defined 240 px filter rail, not in the primary navigation.
- Use `StatusDot` or `Token` for states and metadata. Reserve `Badge` for counts.
- Empty areas use `EmptyState` with a title, explanation, and useful next action.

### Responsive contract

| Width | Behavior |
|---|---|
| Above 1024 px | 256 px side navigation + fluid content; optional 380 px detail panel |
| 769–1024 px | Side navigation may remain; detail panel becomes an on-demand overlay |
| 768 px and below | Navigation swaps to `MobileNav`; tables prioritize key columns and expose secondary details on demand |

## 8. Voter ballot flow

### Frame

- Use a content-only shell with a simple branded header and no admin navigation.
- On wide screens, use two columns: a 320–360 px supporting column and a main column capped around 640–720 px.
- Supporting column contains the wordmark/mark, election context, `Stepper`, help/privacy access, and a short reassurance about saving or submission.
- Main column contains one question group, concise helper text, validation, and navigation actions.
- Keep Back secondary and Continue primary. On the final step, replace Continue with a specific action such as Review answers; submission must be a separate, explicit confirmation.

### Question and selection patterns

- Use `RadioList` for one choice, `CheckboxList` for multiple choices, and `SelectableCard` only when choices genuinely need richer supporting information.
- Never preselect a candidate, answer, or political option.
- Candidate/option order needs an approved neutral rule (for example, randomized per ballot or officially defined order) and must be recorded for auditability.
- Show limits in plain language (for example, “Choose up to 3”) and announce remaining/invalid selection states accessibly.
- Preserve answers when moving backward. Warn before discarding an in-progress response or leaving the flow.
- If saving is automatic, show a quiet text status such as “Saved” rather than a recurring toast.

### Responsive contract

| Width | Behavior |
|---|---|
| Above 1024 px | Supporting column + capped main question column |
| 769–1024 px | Narrower supporting column + fluid main column |
| 768 px and below | Stack into one column; collapse step detail to current step/total; keep actions reachable after content |

### Completion and recovery

- Review screen summarizes every answer in the same order as the flow and offers an explicit Edit action per section.
- Final submission requires a confirmation step that clearly states whether the action is reversible.
- Confirmation screen shows a non-sensitive reference/receipt only if the election policy permits it. It must not reveal choices on a shared screen by default.
- Refresh, timeout, offline, duplicate submission, and failed submission states need dedicated recovery copy and actions.

## 9. Components and implementation conventions

Use the installed Astryx system as the source of truth:

- Import `@astryxdesign/core/reset.css` and `@astryxdesign/core/astryx.css` once at the app entry.
- Frame pages outside-in with `AppShell`, `Layout`, `LayoutContent`, `LayoutPanel`, and navigation components.
- Use `Section` as the default page grouping; use `Card` only for self-contained widgets or critical boundaries.
- Use `Grid`, `VStack`, `HStack`, and `StackItem` for layout. Do not hand-roll layout with raw `<div>` or `<span>` elements.
- Discover components and props before implementation with `npx astryx build`, `npx astryx template`, `npx astryx component`, and `npx astryx search`.
- Prefer component props. For exceptional styling, use `style`/`className` or StyleX with `var(--color-*)`, `var(--spacing-*)`, `var(--radius-*)`, and other system tokens.
- Never hardcode brand hex values or interior pixel spacing inside application components.

Suggested mapping:

| Need | Astryx pattern |
|---|---|
| Admin frame | `AppShell`, `SideNav`, `MobileNav`, `Layout` |
| Page heading/actions | `LayoutHeader` or `Toolbar` |
| Dense records | `Table` or `List` with dividers |
| Summary metric | standalone `Card` |
| Selection status | `StatusDot` / `Token` |
| Count | `Badge` |
| Voter progress | `Stepper` |
| Single/multiple answers | `RadioList` / `CheckboxList` |
| Rich visual choice | `SelectableCard` |
| Form structure | semantic `<form>` + `FormLayout` |
| No content | `EmptyState` |
| Persistent issue | `Banner` |
| Narrow-screen detail | `Dialog` or `BottomSheet` |

## 10. Interaction states and motion

Every interactive control must define default, hover, active, focus-visible, selected, disabled, loading, error, and success states where applicable.

- Focus rings use the semantic accent/focus token and remain visible against all permitted surfaces.
- Selection changes include a control/icon and text change, not only a border color.
- Destructive actions use the semantic danger treatment and a confirmation proportionate to impact.
- Use Astryx motion tokens for short state transitions and overlays. No decorative page transitions in the voter flow.
- Respect `prefers-reduced-motion`; progress and status changes must remain understandable without animation.
- Never use indefinite spinners when a known content shape can use `Skeleton`, and always give long-running processes a visible label.

## 11. Accessibility and content

- Target WCAG 2.2 AA as the minimum acceptance bar.
- Use semantic landmarks, real headings in order, labels for every field, and descriptive page titles.
- Keyboard order follows the visual order. Dialogs trap and restore focus; errors move focus to an error summary or first invalid field.
- Announce asynchronous save, validation, and submission state with an appropriate live region (`useAnnounce` when needed).
- Provide text alternatives for meaningful icons and imagery. Decorative marks are hidden from assistive technology when adjacent text already names the product.
- Do not rely on hover. All actions must work with keyboard, touch, zoom, and reduced motion.
- Use plain, direct language. Avoid jargon such as “cast,” “invalidate,” or “abstain” without a short explanation appropriate to the actual election rules.
- Establish an approved English/Filipino language strategy before final content production; do not mix languages inconsistently within a flow.

## 12. Required states and design deliverables

Before implementation is considered design-complete, define these states:

- Loading, empty, filtered-empty, partial data, error, offline, permission denied, and maintenance.
- Draft, unsaved, saving, saved, validation error, submitting, submitted, duplicate, expired session, and locked election.
- Admin destructive confirmations and audit feedback.
- Voter welcome/eligibility, every question type, review, submission confirmation, completion, and recovery.
- Desktop, tablet, mobile, keyboard focus, 200% zoom/reflow, and reduced-motion behavior.

## 13. Open decisions — currently lacking

These inputs are needed before high-fidelity screens or production flows can be considered final:

### Product and election governance

- Final retention periods for imported voter data, participation records, ballots, audit history, and backups.
- Committee policy for a zero-valid-vote position, emergency closure, candidate withdrawal after opening, correction, recount, and disputed results.
- Who is authorized operationally to use the unauthenticated admin URL and how that URL is distributed or rotated.
- Final result certification and publication approval process outside the software.

### Information and content

- Final candidate biographies, profile images, position descriptions, responsibilities, voter instructions, help copy, and privacy notice. Seed content is provisional.
- Support/escalation channel and emergency/maintenance messaging.

### Brand and visual system

- Approved reversed/white, monochrome, favicon, and social-preview logo variants.
- An accessible dark text/ink color is not included in the supplied palette; this document currently inherits Astryx Neutral text colors.
- Approved icon family, illustration/photo policy, chart palette, and whether candidate photography is allowed.
- Formal rules for the relative use of yellow, orange, and sky blue beyond the combined 10% accent budget.

### Platform and compliance

- Finalize Supabase schema, server-only service-role boundary, Row Level Security policies, Storage rules, Realtime usage, backups, and regional/data-residency configuration.
- Confirm the browser-version support matrix within the agreed desktop, tablet, and mobile web device classes.
- Define analytics, consent, and content-management requirements.
- Accessibility testing owner and required assistive-technology/browser matrix.
- Security, privacy, data residency, retention, audit logging, incident response, and applicable election/legal review.
- Performance targets, offline/poor-network expectations, printable/exported views, and observability requirements.

Until those decisions are made, the defaults in this document are safe design assumptions—not election policy.

## 14. Definition of done for future UI work

A screen is ready for review when it:

- follows the appropriate admin or voter frame and responsive contract;
- uses Figtree and the project theme without hardcoded design values;
- uses Astryx components and tokens according to `AGENTS.md`;
- includes all relevant loading, empty, error, validation, and success states;
- passes keyboard, focus, contrast, reflow, zoom, reduced-motion, and screen-reader checks;
- makes one primary action obvious without visually favoring a political choice; and
- has product, privacy, accessibility, and election-policy copy approved by the responsible owner.
