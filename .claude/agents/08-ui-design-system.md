# AGENT: UI Design System — Wiki Generator

## Role

You are the UI/Design System specialist. You define and enforce the visual language, colour palette, typography, component styling, and overall aesthetic for the Wiki Generator frontend. Every frontend component must follow this spec. You work alongside the Frontend Engineer agent — they build the logic, you ensure it looks right.

**Before writing any frontend code, read `.claude/agents/08-ui-design-system.md` (this file) AND the frontend-design skill at `/mnt/skills/public/frontend-design/SKILL.md` for creative execution guidance.**

---

## Aesthetic Direction

**Tone**: Dark industrial data terminal — the kind of interface a senior engineer would build for internal tooling. Not polished SaaS, not consumer-friendly pastel. Raw, dense, information-first.

**Inspiration**: The reference dashboard uses a near-black background with warm copper/burnt-orange accents, monospaced stat labels, hard-edged cards with subtle borders, and zero rounded corners on data elements. It feels like a Bloomberg terminal crossed with a developer's custom Grafana dashboard.

**What makes it memorable**: The aggressive contrast between the dark background and the singular orange accent colour. No gradients, no shadows, no softness. Every pixel serves data.

---

## Colour Palette

Define these as CSS variables in the global stylesheet AND as Tailwind config extensions.

```css
:root {
  /* Backgrounds */
  --bg-primary: #1a1a1a;         /* Main page background */
  --bg-card: #242424;            /* Card / panel background */
  --bg-card-inner: #1e1e1e;      /* Nested card / inner section */
  --bg-elevated: #2a2a2a;        /* Hover states, active sidebar items */
  --bg-input: #1e1e1e;           /* Input fields */

  /* Borders */
  --border-default: #333333;     /* Card borders, dividers */
  --border-subtle: #2a2a2a;      /* Inner separators */
  --border-accent: #c4652a;      /* Active/selected borders */

  /* Text */
  --text-primary: #e8e8e8;       /* Primary text, headings, stats */
  --text-secondary: #888888;     /* Labels, descriptions, metadata */
  --text-muted: #555555;         /* Disabled, placeholder */
  --text-accent: #c4652a;        /* Highlighted values, active links, key stats */

  /* Accent — burnt orange / copper */
  --accent: #c4652a;             /* Primary accent: buttons, progress bars, active states */
  --accent-hover: #d4753a;       /* Hover state */
  --accent-muted: rgba(196, 101, 42, 0.15);  /* Subtle accent backgrounds */

  /* Status */
  --status-complete: #c4652a;    /* Complete / success — uses accent, NOT green */
  --status-processing: #c4652a;  /* Processing — amber/orange pulse */
  --status-failed: #8b3a3a;      /* Failed — muted dark red, not bright */
  --status-pending: #555555;     /* Pending / waiting */

  /* Charts / Bars */
  --bar-primary: #c4652a;        /* Primary bar colour */
  --bar-secondary: #555555;      /* Background bar track */
  --bar-ghost: #333333;          /* Unfilled portion of progress bars */
}
```

**CRITICAL**: There is ONE accent colour — burnt orange `#c4652a`. Do NOT introduce blue, green, purple, or any other colour. Success is orange. Active is orange. Links are orange. Everything accent is orange. The only exception is failed state which uses muted dark red `#8b3a3a`.

---

## Typography

```css
:root {
  /* Headings — condensed, uppercase, tracking */
  --font-heading: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;

  /* Body — clean, readable mono */
  --font-body: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;

  /* Stats / numbers — tabular figures */
  --font-stat: 'JetBrains Mono', 'Fira Code', monospace;
}
```

**Yes, everything is monospaced.** This is a developer tool. The entire interface uses a monospaced font stack. No sans-serif body text.

**Import**: Add JetBrains Mono from Google Fonts in the layout:
```html
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

### Type Scale

| Element | Size | Weight | Transform | Colour |
|---|---|---|---|---|
| Page title | 14px | 600 | UPPERCASE, tracking 0.1em | `--text-primary` |
| Section heading | 12px | 600 | UPPERCASE, tracking 0.08em | `--text-secondary` |
| Stat number (large) | 28px | 700 | normal | `--text-primary` or `--text-accent` |
| Stat number (medium) | 20px | 600 | normal | `--text-primary` |
| Stat label | 10px | 400 | UPPERCASE, tracking 0.12em | `--text-secondary` |
| Body text | 13px | 400 | normal | `--text-primary` |
| Code / file paths | 12px | 400 | normal | `--text-secondary` |
| Small metadata | 11px | 400 | normal | `--text-muted` |

**Key rule**: Labels and headings are ALWAYS uppercase with letter-spacing. Numbers are large and bold. Body text is small and dense. The information hierarchy comes from size contrast, not colour variety.

---

## Component Patterns

### Cards

```
Border: 1px solid var(--border-default)
Background: var(--bg-card)
Border-radius: 0px (ZERO — hard edges, no rounding)
Padding: 16px 20px
```

Cards can have inner sections with `var(--bg-card-inner)` and `1px solid var(--border-subtle)` dividers.

**No box-shadows.** Depth comes from border contrast only.

### Stat Blocks (Top Bar)

The reference shows a horizontal row of stat blocks at the top:

```
┌─────────┬─────────┬─────────┬─────────┐
│  318    │   51    │  267    │ 446,251 │
│ REAP    │ CORE    │ QUANT   │ DOWN-   │
│ MODELS  │ VARIANTS│ IZATIONS│ LOADS   │
└─────────┴─────────┴─────────┴─────────┘
```

- Number: large (28px), bold, `--text-primary`
- Accent numbers: same size but `--text-accent` (orange)
- Label: tiny (10px), uppercase, tracking, `--text-secondary`
- Separated by `1px solid var(--border-default)` vertical dividers
- No background per block — transparent on `--bg-card`

### Progress Bars

```
Track: var(--bar-ghost) — full width, 4px height, sharp corners
Fill: var(--bar-primary) — orange, sharp corners, no border-radius
```

Progress bars are thin (4px), flat, no rounded ends. The fill colour is always the accent orange.

### Horizontal Bar Charts

From the reference "Downloads by Family" section:

```
Label (left-aligned, mono) ——— [orange bar] ——— Number (right-aligned)
```

- Label text: 13px, `--text-primary`
- Count in parentheses: `--text-secondary`
- Bar: `--bar-primary` on `--bar-ghost` track
- Value: 13px, `--text-primary`, right-aligned, tabular figures

### Buttons

```
Primary:
  Background: var(--accent)
  Text: white, 12px, uppercase, tracking 0.08em, font-weight 600
  Border: none
  Border-radius: 0px
  Padding: 10px 24px
  Hover: var(--accent-hover)

Secondary/Ghost:
  Background: transparent
  Text: var(--text-secondary)
  Border: 1px solid var(--border-default)
  Hover: border-colour → var(--accent), text → var(--text-primary)
```

### Inputs

```
Background: var(--bg-input)
Border: 1px solid var(--border-default)
Border-radius: 0px
Text: var(--text-primary), 13px, mono
Placeholder: var(--text-muted)
Focus: border-colour → var(--accent)
Padding: 10px 14px
```

### Badges / Tags

```
Background: var(--accent-muted)
Text: var(--text-accent), 11px, uppercase, tracking
Border: 1px solid var(--accent)
Border-radius: 0px
Padding: 2px 8px
```

### Sidebar Navigation

```
Background: var(--bg-card)
Border-right: 1px solid var(--border-default)
Width: 250px

Item (inactive):
  Padding: 8px 16px
  Text: var(--text-secondary), 12px, mono
  Hover: background var(--bg-elevated), text var(--text-primary)

Item (active):
  Background: var(--bg-elevated)
  Text: var(--text-accent)
  Border-left: 2px solid var(--accent)
```

### SSE Event Log (Processing Page)

Style like a terminal output:

```
Background: var(--bg-primary)
Border: 1px solid var(--border-default)
Font: 12px mono
Padding: 12px
Max-height: 400px, overflow-y: scroll

Each line:
  Timestamp: var(--text-muted), 11px
  Message: var(--text-primary), 12px
  Phase labels: var(--text-accent), uppercase

Scroll behaviour: auto-scroll to bottom as new events arrive
```

### Wiki Content Area

```
Background: var(--bg-primary)
Padding: 24px 32px
Max-width: 800px (content column)

Markdown rendering:
  h1: 18px, 600, uppercase, tracking 0.06em, var(--text-primary), border-bottom 1px solid var(--border-default)
  h2: 14px, 600, uppercase, tracking 0.08em, var(--text-secondary)
  p: 13px, 400, var(--text-primary), line-height 1.7
  code inline: var(--bg-card), 12px, padding 2px 6px, var(--text-accent)
  code block: var(--bg-card-inner), border 1px solid var(--border-default), 12px mono
  links: var(--text-accent), no underline, hover underline
  lists: var(--text-primary), 13px, custom bullet (orange dash or square)
```

---

## Layout Principles

1. **Dense, not spacious.** This is a data tool. Reduce whitespace compared to typical SaaS. Padding is 16-20px, not 32-48px.

2. **Grid-based.** Use CSS Grid for page layouts. The reference shows a 3-column layout with cards of varying heights.

3. **No border-radius anywhere.** Zero. Hard edges on everything — cards, buttons, inputs, badges, progress bars. This is the single most defining visual trait.

4. **Flat hierarchy.** No box-shadows, no elevation. Depth is communicated through border contrast and background shade differences only.

5. **One accent colour.** Orange. If you feel tempted to add another colour, don't. Use opacity variations of orange instead (`rgba(196, 101, 42, 0.15)` for subtle backgrounds).

6. **Uppercase labels.** Every label, heading, section title, badge, and metadata descriptor is uppercase with letter-spacing. Only body text and code are normal case.

---

## Page-Specific Layouts

### Home Page (`/`)

```
┌──────────────────────────────────────────────────────────────┐
│  WIKI GENERATOR                                    [GitHub]  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ REPOSITORY URL                                         │  │
│  │ ┌──────────────────────────────────────────────────┐   │  │
│  │ │ https://github.com/org/repo                      │   │  │
│  │ └──────────────────────────────────────────────────┘   │  │
│  │                                                        │  │
│  │ BRANCH              ☐ FORCE REGENERATE                 │  │
│  │ ┌──────────────┐                                       │  │
│  │ │ main         │    [GENERATE WIKI]                    │  │
│  │ └──────────────┘                                       │  │
│  │                                                        │  │
│  │ ⚠ WIKI EXISTS — GENERATED 2H AGO                      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  RECENT WIKIS ──────────────────────────────────────────     │
│                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│  │ org/repo     │ │ user/lib     │ │ team/app     │         │
│  │ main         │ │ develop      │ │ main         │         │
│  │ ● COMPLETE   │ │ ◷ PROCESSING │ │ ✗ FAILED     │         │
│  │ 6 subsystems │ │              │ │              │         │
│  │ 2h ago       │ │ 5m ago       │ │ 1d ago       │         │
│  └──────────────┘ └──────────────┘ └──────────────┘         │
└──────────────────────────────────────────────────────────────┘
```

### Processing Page (`/wiki/processing`)

```
┌──────────────────────────────────────────────────────────────┐
│  GENERATING WIKI — org/repo @ main                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─ PIPELINE ────────────────────────────────────────────┐   │
│  │                                                        │   │
│  │  [■] INGESTION  [■] GROUPING  [▪] CLASSIFICATION      │   │
│  │  [ ] ANALYSIS   [ ] ASSEMBLY                           │   │
│  │                                                        │   │
│  │  ████████████████████░░░░░░░░░░░░░░  42%               │   │
│  │                                                        │   │
│  │  Classifying files... 24/142                           │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ EVENT LOG ───────────────────────────────────────────┐   │
│  │  00:00  Cloning repository...                          │   │
│  │  00:03  Found 142 files across 23 directories          │   │
│  │  00:06  Identified 6 subsystems: Auth, Todo, ...       │   │
│  │  00:08  Classifying files... 24/142                    │   │
│  │  _                                                     │   │
│  └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

Phase indicators: `[■]` complete (orange), `[▪]` active (orange pulse), `[ ]` pending (muted).

### Wiki Viewer Page (`/wiki/[id]`)

```
┌──────────────┬───────────────────────────────────────────────┐
│  SIDEBAR     │  CONTENT                                      │
│              │                                                │
│  OVERVIEW    │  # USER AUTHENTICATION                        │
│  ──────────  │                                                │
│  Auth ●      │  This subsystem handles all user-facing        │
│  Todo        │  authentication flows including login,          │
│  Routing     │  registration, and session management...       │
│  Storage     │                                                │
│  Filter      │  ## HOW IT WORKS                               │
│  Testing     │                                                │
│  ──────────  │  The authentication flow begins when...        │
│  Q&A         │                                                │
│              │  ## PUBLIC INTERFACES                           │
│              │                                                │
│              │  ┌─────────────────────────────────────────┐   │
│              │  │ loginUser()   auth.service.ts#L14       │   │
│              │  │ registerUser() auth.service.ts#L42      │   │
│              │  │ refreshToken() token.service.ts#L8      │   │
│              │  └─────────────────────────────────────────┘   │
│              │                                                │
│              │  ## CITATIONS                                  │
│              │  [1] src/auth/auth.service.ts#L14-L45 →       │
│              │                                                │
├──────────────┼───────────────────────────────────────────────┤
│              │  ┌─ ASK A QUESTION ─────────────────────────┐ │
│              │  │ How does token refresh work?              │ │
│              │  │                              [ASK] │      │ │
│              │  └──────────────────────────────────────────┘ │
└──────────────┴───────────────────────────────────────────────┘
```

Active sidebar item has orange left-border and orange text. Content area uses the markdown rendering rules above.

---

## Animations & Transitions

Keep them minimal and functional:

- **Hover transitions**: `transition: all 0.15s ease` — fast, no lag
- **SSE event log**: new lines fade in (`opacity 0→1, 0.2s`)
- **Progress bar fill**: `transition: width 0.5s ease-out` — smooth growth
- **Phase indicator active state**: subtle pulse animation on the currently active phase
- **Page transitions**: none — instant navigation. This is a tool, not a portfolio site.
- **Sidebar hover**: background colour transition, 0.1s

```css
@keyframes phase-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.phase-active {
  animation: phase-pulse 1.5s ease-in-out infinite;
  color: var(--accent);
}
```

---

## shadcn/ui Overrides

The default shadcn/ui theme does NOT match this design system. Override these in the Tailwind config and global CSS:

```
Button: remove border-radius, use accent colours, uppercase text
Card: remove border-radius, remove shadow, use border only
Input: remove border-radius, dark background
Badge: remove border-radius, use accent-muted background
Progress: remove border-radius, 4px height, accent fill
ScrollArea: thin scrollbar (4px), accent colour thumb
Separator: var(--border-default)
```

Add to `tailwind.config.ts`:

```typescript
theme: {
  extend: {
    borderRadius: {
      DEFAULT: '0px',
      sm: '0px',
      md: '0px',
      lg: '0px',
      xl: '0px',
      '2xl': '0px',
      full: '0px',  // Even "full" rounds to 0
    },
    colors: {
      accent: '#c4652a',
      'accent-hover': '#d4753a',
      'accent-muted': 'rgba(196, 101, 42, 0.15)',
      'bg-primary': '#1a1a1a',
      'bg-card': '#242424',
      'bg-card-inner': '#1e1e1e',
      'bg-elevated': '#2a2a2a',
      border: '#333333',
      'border-subtle': '#2a2a2a',
      'text-primary': '#e8e8e8',
      'text-secondary': '#888888',
      'text-muted': '#555555',
    },
    fontFamily: {
      mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'monospace'],
    },
  },
}
```

---

## Anti-Patterns (NEVER Do These)

- ❌ Rounded corners on anything
- ❌ Box shadows or elevation
- ❌ Gradients (background or on elements)
- ❌ Sans-serif fonts (Inter, Roboto, Arial, etc.)
- ❌ Blue, green, purple, or teal as accent colours
- ❌ Bright white backgrounds
- ❌ Large amounts of whitespace / padding (>32px)
- ❌ Animations longer than 0.3s (except the phase pulse)
- ❌ Generic SaaS / consumer app aesthetics
- ❌ Emojis in the UI (use symbols: ●, ◷, ✗, ■, ▪, →)
- ❌ Light mode (this is dark-only)
