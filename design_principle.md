# Markdot Dotcore Design System & Theme Principles
> **Theme Name:** Sci-Fi Cyber-Terminal & Bento Grid  
> **Target Aesthetic:** High-performance, dark-space command center with tactical neon accents, rigid geometric corners, glassmorphism, animated scanlines, and monospaced telemetry elements. Includes a light mode ("Scientific Console") override system.

---

## 1. Aesthetic Identity & Design Philosophy

The design identity balances modern **Bento Grid** modular layout principles with a **Sci-Fi Cyber-Terminal** aesthetic. It evokes a futuristic HUD (Heads-Up Display) and executive tactical dashboard.

### Key Visual Pillars
1. **Dark Space Foundation**: Deep void black (`#020204`) combined with subtle dark elevated surfaces (`#050508`, `rgba(12, 8, 8, 0.85)`).
2. **Neon Crimson Accents**: High-contrast brand red (`#ef4444`) used for key interactive triggers, status indicators, glowing borders, and focus rings.
3. **Glassmorphism & Micro-Glows**: Subtle backdrop blurs (`backdrop-filter: blur(16px)`), thin semi-transparent crimson borders (`rgba(239, 68, 68, 0.15)`), and ambient box shadows (`0 0 15px rgba(239, 68, 68, 0.04)`).
4. **Tactical Micro-Details**: Monospaced font for buttons, badges, labels, inputs, and status metrics, combined with animated cyber grid lines and scanline overlays.
5. **Rigid Geometry**: Sharp/medium border radius (`4px` - `8px` for inputs/buttons, `12px` - `16px` for cards) instead of overly soft pills, featuring custom top-right corner cut highlights on card hover.

---

## 2. Color Palette & Design Tokens

### Core Color Tokens (Dark Mode / Default)

| Token Name | Hex / Value | Usage |
| :--- | :--- | :--- |
| `--bg` | `#020204` | Main page background (Deep Void Black) |
| `--bg-subtle` | `#050508` | Sidebar background, subtle section fills |
| `--bg-card` | `rgba(12, 8, 8, 0.85)` | Primary Bento cards, modal bodies, glass panels |
| `--bg-elevated` | `rgba(24, 16, 16, 0.95)` | Dropdowns, flyout menus, tooltips |
| `--bg-hover` | `rgba(239, 68, 68, 0.08)` | Item hover background fill |
| `--bg-input` | `#020204` | Input fields, textareas, select boxes |
| `--brand` | `#ef4444` | Primary brand accent (Neon Crimson Red) |
| `--brand-hover` | `#dc2626` | Darker brand crimson for button hover/active |
| `--brand-glow` | `rgba(239, 68, 68, 0.25)`| Focus ring & button shadow glow |
| `--brand-subtle` | `rgba(239, 68, 68, 0.06)`| Active navigation item fill |

### Border Tokens

| Token Name | Hex / Value | Usage |
| :--- | :--- | :--- |
| `--border` | `rgba(239, 68, 68, 0.15)` | Default card, input, and panel borders |
| `--border-strong` | `rgba(239, 68, 68, 0.30)` | Hovered element borders, modal outlines |
| `--border-focus` | `#ef4444` | Active input & element focus rings |

### Text & Typography Colors

| Token Name | Hex / Value | Usage |
| :--- | :--- | :--- |
| `--text-primary` | `#f8fafc` (Slate 50) | Main headings, primary content body |
| `--text-secondary` | `#94a3b8` (Slate 400) | Subtitles, labels, secondary metadata |
| `--text-muted` | `#475569` (Slate 600) | Placeholders, disabled states, footers |
| `--text-link` | `#ef4444` | Interactive hyper-links, active indicators |

### Status Indicators & Badges

| Status | Primary Accent | Subtle Fill | Usage |
| :--- | :--- | :--- | :--- |
| **Success / Active** | `#10b981` (Emerald) | `rgba(16, 185, 129, 0.08)` | Clocked in, completed tasks, online |
| **Warning / Pending** | `#f59e0b` (Amber) | `rgba(245, 158, 11, 0.08)` | Pending approval, upcoming shifts |
| **Danger / Alert** | `#f43f5e` (Rose) | `rgba(244, 63, 94, 0.08)` | Overdue tasks, rejected leaves, offline |
| **Info / Secondary** | `#6366f1` / `#06b6d4` | `rgba(99, 102, 241, 0.08)` | System notices, telemetry badges |

---

## 3. Light Mode Theme ("Scientific Console")

When toggled via `<body class="light">`, the site switches to a high-legibility light theme:

| Token Name | Hex / Value |
| :--- | :--- |
| `--bg` | `#f8fafc` |
| `--bg-subtle` | `#f1f5f9` |
| `--bg-card` | `rgba(255, 255, 255, 0.90)` |
| `--bg-elevated` | `#ffffff` |
| `--brand` | `#dc2626` |
| `--text-primary` | `#0f172a` |
| `--text-secondary` | `#1e293b` |
| `--border` | `rgba(220, 38, 38, 0.14)` |

---

## 4. Typography & Fonts

### Font Families
1. **Primary Sans-Serif**: `Plus Jakarta Sans`
   - **Google Fonts Import:** `family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800`
   - **Usage:** Page titles, body paragraphs, descriptions, section headings.
2. **Technical Monospace**: `JetBrains Mono` (or Next.js `Geist Mono`)
   - **Google Fonts Import:** `family=JetBrains+Mono:wght@300;400;500;600;700;800`
   - **Usage:** Navigation links, buttons, form inputs, badge text, table headers, timestamps, IDs, code snippets, tactical status indicators.

### Type Scale & Hierarchy

| Role | Font Family | Size | Weight | Letter Spacing | Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Page Title** | `Plus Jakarta Sans` | `24px - 32px` | `800` (Extra Bold) | `-0.02em` | Sentence |
| **Section Header** | `Plus Jakarta Sans` | `18px - 20px` | `700` (Bold) | `-0.01em` | Sentence |
| **Card Title** | `Plus Jakarta Sans` | `15px - 16px` | `600` (Semi Bold) | `normal` | Sentence |
| **Form Label** | `JetBrains Mono` | `11px` | `700` (Bold) | `0.05em` | UPPERCASE |
| **Button Text** | `JetBrains Mono` | `13px` | `700` (Bold) | `0.05em` | UPPERCASE |
| **Nav Item** | `JetBrains Mono` | `13px` | `500` - `700` | `normal` | Sentence/UPPERCASE |
| **Badge Tag** | `JetBrains Mono` | `10px` | `700` (Bold) | `0.05em` | UPPERCASE |
| **Body Copy** | `Plus Jakarta Sans` | `14px` | `400` (Regular) | `normal` | Sentence |

---

## 5. Layout Architecture & Structural Outline

A site adhering to this theme should follow a standard **Bento Dashboard Frame**:

```
+-----------------------------------------------------------------------------+
|                                    TOPBAR                                   |
| [Logo: MARKDOT] [Search Command Input...]           [Status Light] [User]   |
+-------------------+---------------------------------------------------------+
|                   |                                                         |
|  SIDEBAR NAV      |                    MAIN WORKSPACE                       |
|                   |                                                         |
|  * Overview       |  +---------------------------------------------------+  |
|  * Time Clock     |  | BENTO HERO CARD / TELEMETRY BANNER                |  |
|  * Tasks Board    |  +-------------------+-------------------------------+  |
|  * Team Directory |  | BENTO CARD 1      | BENTO CARD 2                  |  |
|  * Analytics      |  | (Stats / Graph)   | (Live Feed / Quick Actions)   |  |
|                   |  +-------------------+-------------------------------+  |
|  [Collapse]       |  | BENTO CARD 3 (Full Width Data Table)              |  |
|                   |  +---------------------------------------------------+  |
+-------------------+---------------------------------------------------------+
```

### Dimensions & Grid Rules
- **Sidebar Width**: `260px` (fixed/sticky)
- **Topbar Height**: `68px` (fixed/sticky with `backdrop-filter: blur(16px)`)
- **Card Spacing**: `24px` grid gap (`gap-6`)
- **Container Max-Width**: Fluid responsive with horizontal padding (`px-6 py-8`)
- **Mobile Behavior**: Grid columns collapse to `1fr` below `768px`; sidebar becomes collapsible drawer.

---

## 6. Core CSS Components & Code Blueprints

Include the following CSS tokens & utility classes in your stylesheet (`globals.css` / `style.css`):

### A. CSS Reset & Variables Blueprint
```css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');

:root {
  --bg: #020204;
  --bg-subtle: #050508;
  --bg-card: rgba(12, 8, 8, 0.85);
  --bg-elevated: rgba(24, 16, 16, 0.95);
  --bg-hover: rgba(239, 68, 68, 0.08);
  --bg-input: #020204;

  --border: rgba(239, 68, 68, 0.15);
  --border-strong: rgba(239, 68, 68, 0.3);
  --border-focus: #ef4444;

  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-muted: #475569;
  --text-link: #ef4444;

  --brand: #ef4444;
  --brand-hover: #dc2626;
  --brand-glow: rgba(239, 68, 68, 0.25);
  --brand-subtle: rgba(239, 68, 68, 0.06);

  --radius-sm: 4px;
  --radius: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;

  --shadow-card: 0 0 15px rgba(239, 68, 68, 0.04), inset 0 0 10px rgba(255, 255, 255, 0.01);
  --shadow-card-hover: 0 0 25px rgba(239, 68, 68, 0.15), inset 0 0 15px rgba(239, 68, 68, 0.03);
  --shadow-btn: 0 0 10px rgba(239, 68, 68, 0.15);
  --shadow-btn-hover: 0 0 20px rgba(239, 68, 68, 0.35);

  --sidebar-width: 260px;
  --topbar-height: 68px;
}

body {
  background-color: var(--bg);
  color: var(--text-primary);
  font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
  line-height: 1.6;
}

.font-mono {
  font-family: 'JetBrains Mono', monospace !important;
}
```

### B. Cards & Glassmorphism (`.card`)
```css
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-card);
  backdrop-filter: blur(16px);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  padding: 24px;
  position: relative;
}

/* Sci-fi top corner cut accent line on hover */
.card::after {
  content: "";
  position: absolute;
  top: -1px;
  right: 12px;
  width: 24px;
  height: 2px;
  background: var(--brand);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.card:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-card-hover);
  transform: translateY(-1px);
}

.card:hover::after {
  opacity: 0.8;
}
```

### C. Buttons (`.btn`)
```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 44px;
  padding: 0 20px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: var(--radius);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
}

.btn-primary {
  background: var(--brand);
  color: #020204;
  box-shadow: var(--shadow-btn);
  border: 1px solid var(--border-strong);
}

.btn-primary:hover {
  background: var(--brand-hover);
  box-shadow: var(--shadow-btn-hover);
  transform: translateY(-1px);
}

.btn-secondary {
  background: rgba(16, 16, 24, 0.6);
  color: var(--text-secondary);
  border-color: var(--border);
}

.btn-secondary:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-strong);
}
```

### D. Inputs (`.input`)
```css
.input {
  display: block;
  width: 100%;
  height: 44px;
  padding: 0 14px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-primary);
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  outline: none;
  transition: all 0.2s ease;
}

.input:focus {
  border-color: var(--border-focus);
  box-shadow: 0 0 12px var(--brand-glow);
}
```

### E. Badges (`.badge`)
```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  border: 1px solid transparent;
}

.badge-success {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.25);
}

.badge-warning {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
  border-color: rgba(245, 158, 11, 0.25);
}
```

### F. Special Background Effects (Grid & Scanlines)
```css
/* Animated Cyber Grid Overlay */
.cyber-grid-bg {
  background-image: 
    linear-gradient(to right, rgba(99, 102, 241, 0.04) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(99, 102, 241, 0.04) 1px, transparent 1px);
  background-size: 32px 32px;
  animation: cyber-grid-slide 8s linear infinite;
}

@keyframes cyber-grid-slide {
  from { background-position: 0 0; }
  to { background-position: 0 32px; }
}

/* Digital Scanlines CRT Overlay */
.scanlines::before {
  content: " ";
  display: block;
  position: absolute;
  top: 0; left: 0; bottom: 0; right: 0;
  background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.15) 50%);
  background-size: 100% 4px;
  z-index: 10;
  pointer-events: none;
  opacity: 0.45;
}
```

---

## 7. Guidelines for Implementing a New Site on This Theme

When building a new website or micro-app with this design system:

1. **Import Fonts First**: Ensure both `Plus Jakarta Sans` and `JetBrains Mono` are imported via Google Fonts or loaded locally.
2. **Apply Default Dark Class**: Add `bg-[#020204] text-slate-100 min-h-screen` to the main root wrapper.
3. **Use Bento Grids for Dashboard Layouts**: Use CSS Grid with `grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6` for content organization.
4. **Enforce Monospaced Typography on Interactive Elements**: All buttons, nav links, tags, and inputs MUST use `font-mono` (`JetBrains Mono`).
5. **Maintain Crimson Glowing Accents**: Interactive active states should always highlight in `#ef4444` with glowing box-shadows.
6. **Use Glass Cards**: Wrap major feature modules in `.card` or `.glass-card` rather than flat solid boxes.
