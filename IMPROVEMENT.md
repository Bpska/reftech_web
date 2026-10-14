# RefTech Portal Improvement Plan

Last reviewed: 13 October 2026  
Project version: 0.2.3  
Scope: public website, authenticated ERP, driver and transporter experiences, shared UI, accessibility, content, performance, and frontend quality.

## 1. Purpose

This document is a repository-specific improvement plan for `reftech_portal`. It is based on inspection of the current source code, routes, shared components, website content, accessibility implementation, and build output. It is not a proposal to replace the application with a separate frontend. Improvements should be applied to the existing React application and should preserve its routes, permissions, API contracts, translations, and operational workflows.

The recommended approach is incremental:

1. strengthen shared UI foundations;
2. simplify the application shell and navigation;
3. improve the highest-value operational screens;
4. update the existing public website components;
5. migrate remaining screens module by module;
6. validate accessibility, responsiveness, performance, and content before release.

## 2. Current project baseline

### Architecture

- React 18, TypeScript, Vite 7, Tailwind CSS 4, React Router 7, Lucide icons, and Vitest.
- `169` route declarations in `src/App.tsx`.
- `26` business-module directories under `src/modules/`.
- `237` TSX files and `77` TypeScript files under `src/`.
- Public website components live in `src/website/`.
- Authenticated navigation and layout live in `src/shared/components/AppShell.tsx`.
- Common form and display primitives include `FormKit.tsx`, `DataTable.tsx`, `PagedList.tsx`, `ListNotice.tsx`, and `BrandMark.tsx`.
- Preferences support English, Hindi, and Odia, unit conversion, dates, time zones, and accessibility settings.
- The backend remains the source of truth; frontend improvements must not change endpoint contracts without a coordinated backend change.

### Product areas currently present

The application covers dashboard and trip operations, dispatch, cold-chain monitoring, tracking, warehouse management, transporters and tenders, C&F operations, fleet, billing, government checks, HR, driver workflows, public tracking, platform administration, analytics, integrations, energy, and public website requests.

### Verified quality baseline

The following commands passed on 13 October 2026:

```text
npm run typecheck
npm test -- --run
npm run build
```

Results:

- TypeScript check passed.
- `28` test files passed.
- `175` tests passed.
- Production build passed.
- The main JavaScript bundle was approximately `2,855 kB` uncompressed and `687 kB` gzip.
- Vite reported that chunks larger than `500 kB` should be split.

`npm run lint` is not currently a clean quality gate. The repository has a large existing ESLint backlog, dominated by explicit `any`, unused values, and hook-dependency findings. This should be reduced progressively rather than mixed into an unrelated visual redesign.

## 3. What is already good and should be preserved

- Role- and permission-aware navigation is already implemented.
- Company branding can supply primary/header colours.
- The sidebar width can be resized and collapsed.
- Shared table querying supports paging, sorting, filtering, and export.
- Shared quick forms support unit conversion.
- Accessibility support already includes keyboard focus, high-contrast mode, reduced motion, scalable text, and correct document language.
- The application already contains empty/error notices, server-backed data tables, localized formatting, and responsive utility classes.
- Driver, transporter, partner, public tracking, careers, and office workflows are separated appropriately.
- Existing tests provide a useful safety net for non-visual business behavior.

These capabilities should be refined, not discarded.

## 4. Main findings

### 4.1 The UI system is incomplete

`src/shared/components/FormKit.tsx` contains basic reusable strings and components, but it does not yet define a complete design system. Page files still assemble many one-off cards, headers, tabs, toolbars, tables, status badges, and action groups directly with Tailwind classes.

Repository indicators:

- Approximately `345` table elements/occurrences were found in TSX source.
- Only `24` `DataTable` usages were found.
- Approximately `195` forms, `1,542` buttons, `1,254` inputs, and `453` selects occur in the source.
- The common `rounded-2xl bg-white ... shadow-sm` panel pattern appears across many files, but its spacing and internal hierarchy are not standardized.

Impact:

- screens look related but not consistently designed;
- fixes must be repeated across modules;
- focus, loading, error, and responsive behavior can differ;
- a global visual change is risky because raw utility classes encode component decisions everywhere.

### 4.2 Navigation is functionally complete but too dense

`src/shared/components/AppShell.tsx` contains a very large role-dependent navigation tree in one component. It mixes authentication redirects, idle timeout, profile loading, branding, header rendering, sidebar state, permission checks, and all navigation declarations.

Current issues:

- the default sidebar is wide and contains many nested operational destinations;
- users must remember which section owns a page;
- the active state is inconsistent for nested/query/hash destinations;
- there is no navigation search or command palette;
- on smaller screens the large menu is difficult to scan;
- the oversized banner-style logo consumes valuable header space;
- page context relies mostly on individual page headings rather than a consistent breadcrumb/page-header pattern.

### 4.3 Operational pages are information-dense without shared hierarchy

The product is an ERP, so density is appropriate; the problem is inconsistent hierarchy. Tables, filters, edit forms, summaries, warnings, and actions often compete visually.

A standard page should clearly separate:

1. page identity and primary action;
2. important alerts or status;
3. filters and search;
4. the main data view;
5. secondary actions and supporting detail.

This structure is not uniformly enforced today.

### 4.4 Native browser dialogs are overused

The source contains approximately `170` calls to `window.alert`, `window.confirm`, or `window.prompt`.

Examples occur across billing, warehouse, dispatch, HR, tracking, platform, transporters, cold-chain records, and shared form utilities.

Problems:

- browser dialogs cannot match the product design;
- prompts have weak validation and error handling;
- confirmations often contain important irreversible-action information;
- dialogs are difficult to localize consistently;
- they interrupt keyboard and mobile workflows;
- sensitive input, such as passwords or reasons, should use purpose-built forms.

### 4.5 Public website content is not production-ready

Concrete findings in `src/website/`:

- `Contact.tsx` displays a successful submission without calling an API.
- The phone number `+91 98765 43210` is used in website content and navigation and appears to be placeholder data.
- Social links in `data.ts` use `href: '#'`.
- Statistics and testimonials are hard-coded and need business verification and permission.
- Eleven website image references load from Pexels rather than controlled RefTech assets.
- The homepage combines many attractive sections but repeats similar marketing claims and card patterns.
- Newsletter submission in `Footer.tsx` prevents the default action but does not subscribe the visitor.
- Privacy and Terms links are placeholders.

These are trust and conversion issues, not only visual issues.

### 4.6 Public website and ERP need related but different design modes

The website should be editorial, spacious, and brand-led. The ERP should be compact, predictable, and task-led. Applying the same dark cinematic styling to every operational screen would reduce usability. Both experiences should share brand colours, type fundamentals, icon style, and quality standards while using different density and surface rules.

### 4.7 Performance needs route-level code splitting

`src/App.tsx` imports the full route surface eagerly. The production bundle is about `2.85 MB` before gzip and triggers Vite's large-chunk warning.

Recommended direction:

- use `React.lazy` and `Suspense` for module/page routes;
- create stable vendor chunks for React/router and map/chart dependencies where useful;
- preload only the likely next destination;
- measure initial route JavaScript rather than hiding the warning by raising the limit;
- optimize public images and video independently from ERP assets.

### 4.8 Responsive behavior requires workflow-specific design

Tailwind breakpoints exist across the project, but many data-heavy screens primarily fall back to horizontal table scrolling. Mobile requirements differ by user:

- drivers need large touch targets and single-task flows;
- warehouse teams need scanner-first forms;
- transporters need rapid offers/awards actions;
- office users need dense desktop tables;
- public visitors need short forms and clear calls to action.

One universal responsive rule will not serve all of these contexts.

### 4.9 Accessibility foundations exist, but components need systematic validation

Strengths in `src/shared/a11y/` include visible focus, high contrast, reduced motion, text scaling, and language selection.

Remaining work:

- verify every icon-only button has an accessible name;
- add accessible shared dialogs with focus trapping and focus restoration;
- verify table captions/headers and responsive alternatives;
- connect field errors with `aria-describedby`;
- ensure asynchronous success/error notices use suitable live regions;
- test all workflows at 200% zoom and keyboard-only;
- verify colour contrast for status badges, disabled controls, charts, maps, and branded tenant colours.

## 5. Recommended design system

Create shared tokens and primitives before redesigning pages.

### 5.1 Tokens

Define semantic tokens rather than page-specific colours:

- `surface-page`, `surface-panel`, `surface-subtle`, `surface-inverse`;
- `text-primary`, `text-secondary`, `text-muted`, `text-inverse`;
- `border-default`, `border-strong`, `focus-ring`;
- `action-primary`, `action-secondary`, `action-danger`;
- `status-info`, `status-success`, `status-warning`, `status-danger`, `status-neutral`;
- consistent spacing, radius, shadow, type scale, motion, and control heights.

Tenant branding must map safely to semantic tokens and retain accessible contrast.

### 5.2 Shared components to add

Recommended components under `src/shared/components/`:

- `PageHeader` with title, description, breadcrumb, primary action, and secondary actions;
- `Panel` and `MetricCard`;
- `Button` variants with loading and icon states;
- `Field`, `SelectField`, `TextareaField`, and field-error support;
- `StatusBadge` with one central status-to-tone mapping;
- `Tabs` and `SegmentedControl`;
- `Toolbar` for search, filters, saved views, and exports;
- `Dialog`, `ConfirmDialog`, and `ReasonDialog`;
- `Toast`/notification region;
- `EmptyState`, `ErrorState`, and skeleton loaders;
- `ResponsiveDataView` using table on wide screens and structured cards on narrow screens;
- `OverflowMenu` for repeated row actions;
- `DetailList` for label/value summaries.

Do not create one giant component library in a single change. Implement primitives as real screens are migrated.

## 6. Application-shell improvements

Primary files:

- `src/shared/components/AppShell.tsx`
- `src/shared/components/BrandMark.tsx`
- `src/shared/components/SidebarResizeHandle.tsx`
- `src/shared/components/sidebarWidth.ts`
- `src/modules/platform/NotificationBell.tsx`

Recommended changes:

1. Move navigation configuration into typed data grouped by permission and login type.
2. Split desktop sidebar, mobile drawer, top bar, and profile menu into components.
3. Use a compact logo treatment in the application shell.
4. Add global navigation search or a command palette.
5. Auto-expand and highlight the section containing the active route.
6. Add consistent breadcrumbs and page titles.
7. Move account, preferences, password, support context, and sign-out into a profile menu.
8. Preserve collapse and resize preferences.
9. Make mobile navigation a proper focus-trapped drawer.
10. Keep notification and critical-alert access visible without crowding the header.

Acceptance criteria:

- the current page is identifiable at a glance;
- every visible navigation item remains permission-correct;
- all routes remain reachable;
- desktop and mobile navigation are fully keyboard accessible;
- no horizontal page overflow at 390 px;
- a user can find any permitted page by search.

## 7. Dashboard improvements

Primary files:

- `src/modules/dashboard/DashboardPage.tsx`
- `src/modules/dashboard/PartnerDashboardPage.tsx`

The staff dashboard should answer:

1. What needs attention now?
2. What is moving now?
3. What happens next?

Recommended layout:

- compact page header with last-refresh time and refresh action;
- prioritized alert strip ordered by severity;
- live trips/map as the main working area;
- upcoming and completed trips below;
- inventory overview as secondary information;
- loading skeletons rather than initially empty panels;
- clear API error states rather than silent `.catch(() => {})` behavior;
- user-configurable or role-specific tiles where appropriate.

Do not use colour decoratively. Red, amber, green, and blue must communicate stable meanings.

## 8. Forms and dialogs

Primary files:

- `src/shared/components/FormKit.tsx`
- module pages containing native browser dialogs

Improvements:

- replace browser prompts with typed dialogs;
- use field-level validation and server-error summaries;
- group long forms into sections with descriptions;
- distinguish primary, secondary, destructive, and quiet actions;
- place destructive actions away from the primary save action;
- show units next to values consistently;
- preserve entered data when a server request fails;
- prevent duplicate submissions;
- use explicit success messages that describe what changed;
- require confirmation text or a reason for high-risk actions when appropriate.

Migration priority for dialogs:

1. passwords, API keys, destructive platform actions;
2. billing reversals and approvals;
3. warehouse cancellations, stock changes, and disposals;
4. HR rejection/cancellation actions;
5. remaining low-risk confirmations.

## 9. Tables and high-density data

Primary files:

- `src/shared/components/DataTable.tsx`
- `src/shared/components/PagedList.tsx`
- `src/shared/components/dataTableQuery.ts`

Improvements:

- standardize header, density, zebra/hover behavior, and empty/loading/error states;
- make headers sticky where tables are long;
- move filters into a consistent toolbar;
- support clear-all filters and visible active-filter chips;
- provide column visibility and saved views for complex lists;
- keep identifiers, statuses, dates, and numeric values aligned consistently;
- use an overflow menu when rows have more than two actions;
- freeze the key identifying column only where it materially helps;
- retain server-side pagination, sorting, filtering, and exports;
- provide card alternatives for essential mobile workflows instead of forcing every table into horizontal scrolling.

Migrate frequently used tables first: operations, trips, tracking alerts, warehouse inbound/outbound/stock, billing, and transporter tenders.

## 10. Existing public website improvements

Primary files:

- `src/website/Navbar.tsx`
- `src/website/Hero.tsx`
- `src/website/About.tsx`
- `src/website/VisionMission.tsx`
- `src/website/Services.tsx`
- `src/website/Industries.tsx`
- `src/website/Technology.tsx`
- `src/website/ErpAccess.tsx`
- `src/website/Stats.tsx`
- `src/website/Testimonials.tsx`
- `src/website/Contact.tsx`
- `src/website/Footer.tsx`
- `src/website/data.ts`

Improve these existing components rather than creating a second independent landing page.

### Content order

Recommended order:

1. navigation;
2. hero with a single value proposition;
3. proof/trust using verified facts only;
4. services;
5. cold-chain journey/process;
6. platform/control-tower demonstration;
7. industries;
8. verified case study;
9. network/coverage using approved data;
10. quote/contact action;
11. footer.

### Required content corrections

- Replace the placeholder phone number everywhere.
- Replace `#` social, Privacy, and Terms links with real destinations or remove them.
- Connect contact and newsletter forms to real endpoints; never show success without persistence.
- Verify every statistic with an owner and a source date.
- Publish testimonials only with client approval.
- Confirm temperature ranges and regulated-service claims with operations/quality teams.
- Replace remote stock imagery with licensed, optimized, locally controlled assets where possible.
- Add image dimensions, responsive sources, lazy loading below the fold, and meaningful alt text.
- Keep the existing public tracking, pickup, quote, locations, careers, and login routes visible.

### Visual direction

- premium cold-chain technology, not a generic transport template;
- one dominant hero image/video with strong readable contrast;
- generous spacing and fewer repeated card grids;
- a restrained cold-blue brand palette;
- amber/red reserved for actions and alerts;
- concise copy written for supply-chain and quality decision makers;
- 48 px mobile targets and a short quote/contact path.

## 11. Content governance

Create a content inventory with an owner and verification date for:

- legal company name and CIN;
- addresses and service locations;
- phone numbers and monitored hours;
- emails;
- certifications and licences;
- fleet, city, hub, shipment, capacity, delivery, and compliance figures;
- temperature/service ranges;
- partner/customer logos;
- testimonials and case studies;
- social profiles;
- privacy, terms, and data-retention information.

Do not invent missing values in the interface. Hide an item or label demo data clearly until approved.

## 12. Performance plan

1. Convert route pages in `src/App.tsx` to lazy imports by product area.
2. Add route-level loading boundaries.
3. Measure initial JavaScript for `/`, `/login`, `/dashboard`, `/driver`, and `/transporter` separately.
4. Split mapping/chart code from routes that do not use it.
5. Optimize `public/media/reftech_video.mp4` and supply poster/fallback behavior.
6. Convert large photography to modern formats with responsive sizes.
7. Self-host or carefully preload only required font weights.
8. Avoid unnecessary polling and re-rendering in dashboards/maps.
9. Add a bundle-analysis command for release reviews.

Initial target: remove the Vite `500 kB` chunk warning through meaningful route splitting, not configuration suppression.

## 13. Accessibility and responsive acceptance criteria

Every migrated screen should meet these checks:

- keyboard-only completion of primary workflow;
- visible focus in default and high-contrast modes;
- meaningful accessible names for icon buttons;
- no information conveyed by colour alone;
- fields have labels, descriptions, and linked errors;
- dialogs trap focus, close predictably, and restore focus;
- status changes are announced when needed;
- reduced-motion setting disables non-essential animation;
- usable at 200% zoom;
- no unintended horizontal viewport overflow at 390 px;
- minimum 44–48 px touch targets for mobile operational actions;
- tables have correct headers and a usable narrow-screen strategy.

## 14. Testing improvements

Current unit tests are valuable but focus mostly on pure business helpers. Add:

- component tests for shared buttons, fields, dialogs, status badges, tables, and page headers;
- permission/navigation tests for each login type;
- integration tests for login, dashboard, trip detail, load request, warehouse receipt, transporter offer, billing approval, and public contact flows;
- accessibility tests for shared components and critical pages;
- visual regression coverage at desktop, tablet, and 390 px mobile widths;
- tests confirming forms do not report success when an API request fails;
- route lazy-loading and error-boundary tests.

Required release commands should eventually be:

```text
npm run typecheck
npm run lint
npm test
npm run build
```

## 15. Prioritized delivery plan

### Phase 0 — Content and workflow decisions

- confirm real public contact details and legal links;
- identify the ten most-used office workflows;
- identify mobile devices used by drivers and warehouse teams;
- approve semantic colours, type, density, and branding constraints;
- capture baseline screenshots and performance measurements.

### Phase 1 — Foundations

- create semantic tokens;
- implement `PageHeader`, `Panel`, buttons, fields, badges, dialogs, notifications, and states;
- document component usage;
- add shared-component tests;
- do not redesign all pages yet.

### Phase 2 — Shell and navigation

- split `AppShell.tsx`;
- add typed navigation configuration and search;
- implement desktop sidebar and mobile drawer;
- add breadcrumbs/profile menu;
- verify every role and permission combination.

### Phase 3 — Highest-value workflows

Recommended first screens:

1. staff and partner dashboards;
2. operations/trip detail;
3. live tracking/control tower;
4. load requests and dispatch;
5. warehouse inbound, stock, and outbound;
6. transporter tenders/offers;
7. billing review and payment flows.

### Phase 4 — Public website

- revise content using approved company facts;
- update existing website components;
- connect contact/newsletter actions;
- replace placeholder links and remote stock dependencies;
- optimize media and mobile conversion flow.

### Phase 5 — Remaining modules

Migrate remaining cold-chain, government, HR, platform, C&F, trading, maintenance, and reporting screens using the shared components.

### Phase 6 — Performance and release hardening

- route-level code splitting;
- visual regression and accessibility audits;
- cross-browser/device checks;
- eliminate critical lint issues;
- documentation and release checklist.

## 16. Suggested priority matrix

| Priority | Work | Reason |
|---|---|---|
| P0 | Real contact submission and removal of false-success behavior | Prevents lost leads and misleading feedback |
| P0 | Replace placeholder contact/legal/social information | Public trust and legal readiness |
| P0 | Shared confirmation/reason dialogs for sensitive actions | Safety, validation, localization, accessibility |
| P1 | Design tokens and shared UI primitives | Reduces risk and duplicated styling across 169 routes |
| P1 | App shell/navigation restructuring | Improves access to the entire product |
| P1 | Dashboard and core operations redesign | Highest daily operational value |
| P1 | Route-level code splitting | Improves initial load and removes current bundle warning |
| P2 | Shared table migration | Improves consistency and mobile behavior across modules |
| P2 | Existing public website redesign | Improves credibility and conversion |
| P2 | Responsive variants for driver/warehouse/transporter workflows | Improves field usability |
| P3 | Full module migration and lint reduction | Long-term maintainability |

## 17. Definition of done for the improvement programme

The programme is complete when:

- existing routes and API contracts remain functional;
- all primary screens use documented shared primitives;
- navigation is searchable, responsive, permission-correct, and accessible;
- native browser prompts are removed from production workflows;
- public forms persist data before reporting success;
- placeholder public content is removed or replaced with approved information;
- the largest routes are code-split and the initial-load budget is met;
- critical workflows have integration and accessibility coverage;
- all release commands pass;
- desktop, tablet, driver mobile, transporter mobile, and 390 px public layouts are approved by their actual users.

## 18. Files to avoid rewriting blindly

The following files contain central behavior and should be changed in small, reviewed steps:

- `src/App.tsx` — all route declarations;
- `src/shared/components/AppShell.tsx` — permissions, navigation, profile, idle logout, and layout;
- `src/shared/components/FormKit.tsx` — form behavior and unit conversion;
- `src/shared/components/DataTable.tsx` — server queries, exports, localization, and formatting;
- `src/shared/i18n/PrefsProvider.tsx` and `src/shared/i18n/` — language, date, units, and accessibility;
- `src/shared/services/api.ts` — authentication and API behavior;
- map/tracking components — provider configuration and live operational behavior.

Visual improvements must not remove their business logic.

## 19. Immediate next action

Start with a small UI-foundation pull request, not a full-site restyle. Implement semantic tokens plus `PageHeader`, `Panel`, `Button`, `StatusBadge`, and accessible `ConfirmDialog`; migrate the dashboard and one representative table/form screen; validate the approach with users; then expand it across the application.
