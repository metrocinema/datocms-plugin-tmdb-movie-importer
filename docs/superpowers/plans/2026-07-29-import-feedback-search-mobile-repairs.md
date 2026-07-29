# Import Feedback, Search Actions, and Mobile Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the three UI issues found during live DatoCMS sandbox QA: missing import progress, indistinguishable search actions, and an awkward narrow Review layout.

**Architecture:** Keep import execution in the Dato field-extension context, where form updates are available, and let the launcher own a pending state for the full modal-plus-import promise. Keep search actions on the DatoCMS Button component while placing the movie title in visually hidden button content. Use CSS-only responsive changes for the Review table and footer so desktop behavior and data flow remain unchanged.

**Tech Stack:** React, TypeScript, datocms-react-ui, Vitest, Testing Library, CSS.

## Global Constraints

- Preserve all current uncommitted importer fixes.
- Do not change TMDB, DatoCMS, or import-plan data contracts.
- Use DatoCMS React UI components for buttons.
- Keep the visible search action label exactly `Use this`.
- Do not commit, push, deploy, or publish without a separate request.

---

### Task 1: Persistent import activity feedback

**Files:**
- Modify: `src/ui/FieldAddon.tsx`
- Modify: `src/App.tsx`
- Test: `src/ui/FieldAddon.test.tsx`

**Interfaces:**
- Consumes: `onOpen(mode: 'find' | 'refresh'): void | Promise<void>`
- Produces: a disabled launcher and `role="status"` message while the open-modal/import promise is pending

- [ ] **Step 1: Write the failing test**

Add a deferred `onOpen` promise, click the launcher, and assert that the button is disabled and the persistent status reads `Importing from TMDB…` until the promise resolves.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/FieldAddon.test.tsx`

Expected: FAIL because the launcher has no pending state or status.

- [ ] **Step 3: Write minimal implementation**

Track `isWorking` in `FieldAddon`, await `onOpen(mode)` in a `try/finally`, disable the button while pending, and render the status. Update the `PluginScreen` callback type so asynchronous handlers remain type-safe.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/FieldAddon.test.tsx`

Expected: PASS.

### Task 2: Muted, uniquely named search actions

**Files:**
- Modify: `src/ui/SearchStep.tsx`
- Modify: `src/ui/ImportModal.css`
- Test: `src/ui/ImportModal.test.tsx`

**Interfaces:**
- Consumes: each `TmdbSearchResult.title` and `TmdbSearchResult.id`
- Produces: a Dato muted button whose visible label is `Use this` and accessible name is `Use this for <movie title>, TMDB ID <id>`

- [ ] **Step 1: Write the failing test**

Search for two same-title movies and assert that each action is independently discoverable by its title-and-TMDB-ID accessible name while the visible label remains `Use this`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/ImportModal.test.tsx`

Expected: FAIL because the Dato Button does not forward the current `aria-label`.

- [ ] **Step 3: Write minimal implementation**

Set `buttonType="muted"` and include a visually hidden `for <movie title>, TMDB ID <id>` span inside the button.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/ImportModal.test.tsx`

Expected: PASS.

### Task 3: Compact narrow Review layout

**Files:**
- Modify: `src/ui/ImportModal.css`
- Test: `src/ui/ImportModal.css.test.ts`

**Interfaces:**
- Consumes: existing `data-label="Current"` and `data-label="Proposed"` table-cell attributes
- Produces: stacked field cards and a two-column footer summary at viewports up to 540px

- [ ] **Step 1: Write the failing test**

Assert that the 540px responsive rules place field name, Current, and Proposed in one column, and arrange the footer summary in two columns.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/ui/ImportModal.css.test.ts`

Expected: FAIL because one-column field layout currently begins only at 360px and the footer summary remains a wrapping flex row.

- [ ] **Step 3: Write minimal implementation**

Move the one-column field-row rules into the 540px breakpoint. Change the narrow footer summary to a two-column grid with compact spacing while retaining all four accessible summary phrases.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/ui/ImportModal.css.test.ts`

Expected: PASS.

### Task 4: Regression and rendered verification

**Files:**
- Verify only

**Interfaces:**
- Consumes: all three repaired behaviors
- Produces: automated and rendered evidence without committing or pushing

- [ ] **Step 1: Run focused and full checks**

Run: `npm test`, `npm run build`, and `git diff --check`.

- [ ] **Step 2: Verify the harness**

Check desktop and 390px Review states, search result buttons, and the import-pending launcher state with the available Browser workflow. Confirm page identity, meaningful content, no framework overlay, relevant console health, screenshots, and target interactions.

- [ ] **Step 3: Verify the DatoCMS sandbox**

Use a field-only import to confirm immediate pending feedback, completion feedback, and a successfully applied unsaved field value without creating unnecessary assets or duplicate people.
