# Sprint: foundation - Mantine Foundation Setup

Generated: 2026-02-05
Confidence: HIGH: 4, MEDIUM: 0, LOW: 0
Status: READY FOR IMPLEMENTATION

## Sprint Goal

Install Mantine, configure theme provider, and create the foundation for incremental component migration.

## Scope

**Deliverables:**
- Mantine packages installed and configured
- MantineProvider with custom dark theme
- Design tokens mapped to Mantine theme
- App entry point wrapped with provider

## Work Items

### P0: Install Mantine Packages [HIGH]

**Acceptance Criteria:**
- [ ] `@mantine/core` v7 installed
- [ ] `@mantine/hooks` installed
- [ ] `@mantine/dates` installed (for date picker)
- [ ] `postcss` and `postcss-preset-mantine` configured
- [ ] `pnpm install` completes without errors

**Technical Notes:**
- Use pnpm (project uses pnpm-lock.yaml)
- Mantine v7 requires postcss configuration
- Keep Tailwind temporarily for gradual migration

**Files:**
- `frontend/package.json`
- `frontend/postcss.config.cjs` (new)

---

### P1: Create MantineProvider with Custom Theme [HIGH]

**Acceptance Criteria:**
- [ ] MantineProvider wraps the app in `main.tsx`
- [ ] Dark color scheme set as default
- [ ] Primary color mapped to existing blue (#3b82f6)
- [ ] Custom colors include all semantic colors (success, warning, error, info)
- [ ] Font family matches existing (system fonts)

**Technical Notes:**
- Create `frontend/src/theme.ts` for Mantine theme configuration
- Map CSS custom properties to Mantine theme tokens:
  - `--color-accent` → primaryColor
  - `--color-success/warning/error/info` → custom colors
- Preserve dark mode aesthetic

**Files:**
- `frontend/src/theme.ts` (new)
- `frontend/src/main.tsx` (modify)

---

### P2: Configure Custom Spacing and Typography [HIGH]

**Acceptance Criteria:**
- [ ] Spacing scale matches existing tokens (2px, 4px, 8px, 12px, 16px, 24px, 32px)
- [ ] Font sizes match existing scale (12px-48px)
- [ ] Border radius variants configured (4px, 8px, 12px, 16px)
- [ ] Shadow/elevation mapped

**Technical Notes:**
- Mantine uses named spacing (xs, sm, md, lg, xl)
- Map to approximate values from current system
- Document mapping in theme file

**Files:**
- `frontend/src/theme.ts` (extend)

---

### P3: Verify App Still Runs [HIGH]

**Acceptance Criteria:**
- [ ] `pnpm dev` starts without errors
- [ ] App loads in browser with existing styling intact
- [ ] No console errors related to Mantine
- [ ] Hot reload still works

**Technical Notes:**
- Mantine and Tailwind can coexist temporarily
- This sprint changes no existing components
- Purely additive changes

## Dependencies

- None (first sprint)

## Risks

| Risk | Mitigation |
|------|------------|
| PostCSS conflicts with Tailwind v4 | Configure postcss carefully, test both work |
| Bundle size increase | Mantine tree-shakes well, monitor in later sprints |
