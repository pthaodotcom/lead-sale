---
name: "Lead Sale · AhaMove"
description: "Giao diện vận hành nội bộ gọn, rõ, dễ làm việc."
colors:
  brand: "#f26624"
  primary: "#c44c16"
  brand-ink: "#a83f0e"
  brand-soft: "#fff0e7"
  brand-line: "#f9cfb6"
  nav-background: "#10334b"
  nav-foreground: "#c6d5e0"
  nav-muted: "#a4becf"
  brand-navy: "#075081"
  navy-soft: "#e6f0f7"
  canvas: "#f4f6f8"
  surface: "#ffffff"
  surface-2: "#f7f9fb"
  line: "#dfe6ec"
  line-strong: "#c7d2dc"
  ink: "#172d3e"
  ink-2: "#434c5e"
  ink-3: "#5d6d7c"
  slate-soft: "#eef0f4"
  amber: "#8a5300"
  amber-soft: "#fdf3d6"
  green: "#137a39"
  green-soft: "#e5f5ea"
  violet: "#6d3fd1"
  violet-soft: "#f0eafd"
  red: "#c42b2b"
  red-soft: "#fdeaea"
typography:
  headline:
    fontFamily: '"Inter Variable", sans-serif'
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: '"Inter Variable", sans-serif'
    fontSize: "15px"
    fontWeight: 650
  body:
    fontFamily: '"Inter Variable", sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: '"cv11"'
  label:
    fontFamily: '"Inter Variable", sans-serif'
    fontSize: "12px"
    fontWeight: 600
rounded:
  chip: "6px"
  control: "8px"
  record: "10px"
  panel: "12px"
  dialog: "14px"
  pill: "999px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-5: "20px"
  space-6: "24px"
  space-7: "28px"
  space-8: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
  button-secondary:
    backgroundColor: "{colors.slate-soft}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 10px"
    height: "40px"
  navigation-active:
    backgroundColor: "{colors.brand-soft}"
    textColor: "{colors.brand-ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  status-chip:
    backgroundColor: "{colors.navy-soft}"
    textColor: "{colors.brand-navy}"
    rounded: "{rounded.chip}"
    padding: "0 8px"
    height: "22px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
  mobile-record:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.record}"
    padding: "16px"
---

# Design System: Lead Sale · AhaMove

## Overview

**Creative North Star: "Gọn, rõ, dễ làm việc"**

Lead Sale is an internal operations interface. Keep the established AhaMove orange and navy identity, restrained surfaces, compact information density, and consistent controls. Page titles establish the task; filters narrow the work; records expose identity, state, and the next available action.

This is a code-led refinement of the existing brand. The current light operations workspace is the visual authority, including when a dark class is present. This document records reused behavior from the application rather than introducing a replacement visual world.

**Key Characteristics:**

- Clear task hierarchy and persistent work context.
- Orange actions, navy navigation, white work surfaces.
- Compact desktop density with readable mobile records.
- Visible focus and reduced-motion support.

## Colors

Warm orange marks action and selection against cool navy and neutral surfaces. Frontmatter values are normative.

### Primary

- **AhaMove Orange** (`brand`): established brand and active navigation icon.
- **Action Orange** (`primary`): filled primary controls, focus, selected tab underline.
- **Orange Ink / Soft / Line**: readable selected labels, quiet selection fill, and associated borders.

### Secondary

- **Navigation Navy**: sidebar background; pale foreground and muted text preserve hierarchy within navigation.
- **AhaMove Navy**: contextual links and supporting identity accents; soft navy accompanies scheduled/informational states.

### Neutral

- **Canvas / Surface / Surface 2**: page background, white work panels, quiet grouped or secondary regions.
- **Ink / Ink 2 / Ink 3**: primary text, secondary detail, and muted context.
- **Line / Strong Line**: dividers and control boundaries.
- **Slate Soft**: neutral statuses, counts, and secondary controls.

Semantic green, amber, red, and violet pair readable text with soft fills for existing workflow statuses. Always retain the status label; color supports it.

**The Action Contrast Rule.** Use Action Orange for a filled action with white text; reserve the brighter brand orange for the brand and supporting accents.

## Typography

Use Inter Variable throughout, with sans-serif fallback. The UI uses fixed sizes rather than a fluid display scale. No separate display or decorative face is established.

### Hierarchy

- **Headline**: page title, using the frontmatter role; reduces to (25px) at the drawer breakpoint and (24px) on phones.
- **Title**: panel and section headings; dialog titles use (20px) with slightly tightened tracking.
- **Body**: records and forms; supporting descriptions and navigation commonly use (13px). Page descriptions cap at (70ch).
- **Label**: buttons and compact supporting text; filter and mobile record labels use (11px), keeping their secondary role.
- **Numeric emphasis**: KPI values use (30px), reducing to (26px) on phones. Table cells, counts, and KPI values use tabular numerals.

## Layout

The desktop shell has a fixed-width navigation column (236px), a sticky header (72px), and a flexible content column. Content is centered with a maximum width (1680px), desktop inset (28px), and bottom space (48px). Use the existing four-pixel spacing scale for repeated rhythm; local optical gaps may differ.

- At (1500px) and below, the task queue navigation becomes a labeled select and the task workspace becomes one column.
- At (1100px) and below, ticket table actions stop sticking to the edge. Preserve ordinary horizontal table scrolling and its explanatory note while the table format remains visible.
- At (900px) and below, navigation becomes a drawer (272px) with a backdrop and close control. The header becomes (64px); content inset becomes (24px 20px 36px). Detailed work columns stack.
- At (600px) and below, lead, user, and task tables using the mobile-record pattern become labeled record blocks with a two-column detail grid. Task identity and action rows span the record. The task list exposes a labeled sort control; its horizontal-scroll note disappears.
- Phone content inset is (20px 16px 32px). Page actions wrap and share available width; filters wrap, and the search field takes a complete row. General app fields grow to (44px), ordinary buttons to at least (40px), and task record actions to at least (36px).

Reports preserve a separate printable sheet inside a horizontally scrollable viewer. Keep that print presentation distinct from interactive operations tables; report filters wrap and retain their labels.

**The Record Identity Rule.** Keep the identifier, person, status, and available action readable together as the workspace narrows.

## Elevation & Depth

Depth is restrained: canvas, white surfaces, quiet fills, and one-pixel borders do most of the work. Panels use the existing low shadow; dialogs, open navigation drawers, and floating surfaces use the stronger pop shadow. Buttons are flat. Exact shadows and drawer motion are carried in the sidecar.

The report viewer may give its printable sheet a paper shadow; printing removes interface chrome and shadows. This is a document-viewer treatment, not the default panel elevation.

## Shapes

Use gently rounded controls and navigation items, larger panel corners, and slightly larger dialog corners as recorded in frontmatter. Mobile records use their intermediate radius. Status chips have compact corners; tab counts use pills and avatars remain circles. Separate panel headers and table regions with thin neutral dividers.

## Components

### Buttons

Compact, legible, and consistent. Primary actions use orange with white labels; outline actions use a white surface with a neutral stroke; secondary controls use slate; ghost controls remain quiet until hover. Existing destructive actions use semantic red. General app buttons have a minimum height (38px), page actions (40px), pagination (32px), and desktop ticket actions (30px). Icon-only actions require an accessible name.

Hover changes background or border over (160ms ease-out). Keep the existing keyboard focus treatment and disabled states. Primary hover uses the component's translucent primary treatment; do not substitute an unused palette value.

### Inputs / Fields

White fill, strong neutral outline, control radius, inherited body font, and an associated label. Inputs and selects start at (40px); textareas start at (72px) and resize vertically. Focus shifts the border to Action Orange with the existing subtle three-pixel orange ring. Disabled fields use a quiet surface and muted ink. Report controls retain their denser existing variant (36px, 13px text, 6px radius).

### Navigation

Navy sidebar with grouped, sentence-case labels and recognizable SVG icons. Links have a minimum height (44px); hover uses a subtle white overlay. Active navigation uses a pale orange surface, orange ink, and a bright orange icon. Tabs use a two-pixel orange underline plus a text change. Preserve visible current location and the existing skip link, keyboard dismissal, backdrop, and focus behavior of the drawer.

### Chips / Tags

Workflow chips pair a short text label with the status color and soft fill. Neutral tags have a quiet background and thin border. Keep semantic status treatments separate from primary-action emphasis.

### Cards / Containers

White bordered panels group related work. Headers align a section title with related controls; typical header padding is (16px 20px). Use the shared spacing scale for body content and avoid overlapping panel margins within grids. Active KPI tiles add a pale orange fill and a two-pixel orange bottom inset.

### Tables / Mobile Records

Desktop tables prioritize stable identity, concise state labels, readable dates, sortable headings, and explicit actions. Keep the scroll region keyboard reachable and labeled. Paginate long lists with visible result counts. Mobile record labels come from the table's data labels; sorting remains available after task table headings disappear.

### Dialogs / Motion / Focus

Dialogs use a clear title, related fields, and a footer separated by a neutral divider. Buttons in dialogs have a minimum height (40px). Preserve accessible dialog behavior from the existing UI primitive.

Global keyboard focus uses a two-pixel Action Orange outline with a two-pixel offset; native fields use the dedicated focus border and ring. When reduced motion is requested, remove transitions, minimize animation duration and repetition, and use automatic scroll behavior. Drawer motion normally uses the existing (200ms) easing.

## Do's and Don'ts

### Do:

- **Do** preserve AhaMove orange/navy and the light operations canvas.
- **Do** use the existing type hierarchy, spacing scale, and component states.
- **Do** show labels, status text, useful empty states, and clear next actions.
- **Do** verify desktop tables, the drawer, mobile records, dialogs, focus, and reduced motion when adding a screen.

### Don't:

- **Don't** use bright brand orange as the default white-text action fill.
- **Don't** hide task identity behind sticky action columns at narrow widths.
- **Don't** convey workflow state through color alone.
- **Don't** replace consistent operations controls with decorative surfaces or a new visual identity without an explicit request.
