---
name: Logikality Design System
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#464555'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#777587'
  outline-variant: '#c7c4d8'
  surface-tint: '#4d44e3'
  primary: '#3525cd'
  on-primary: '#ffffff'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#c3c0ff'
  secondary: '#00687a'
  on-secondary: '#ffffff'
  secondary-container: '#57dffe'
  on-secondary-container: '#006172'
  tertiary: '#7e3000'
  on-tertiary: '#ffffff'
  tertiary-container: '#a44100'
  on-tertiary-container: '#ffd2be'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#acedff'
  secondary-fixed-dim: '#4cd7f6'
  on-secondary-fixed: '#001f26'
  on-secondary-fixed-variant: '#004e5c'
  tertiary-fixed: '#ffdbcc'
  tertiary-fixed-dim: '#ffb695'
  on-tertiary-fixed: '#351000'
  on-tertiary-fixed-variant: '#7b2f00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-sm:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '450'
    lineHeight: '1.4'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  container-max: 1440px
  gutter: 24px
---

## Brand & Style

The design system is engineered for high-performance AI-driven recruitment workflows. It projects a personality of **intelligence, reliability, and executive-grade precision**. Drawing inspiration from the utilitarian elegance of developer-centric platforms like Linear and Vercel, the aesthetic balances extreme functional density with generous whitespace to prevent cognitive overload during complex candidate evaluations.

The visual style is **Modern Corporate Minimalism**. It utilizes a "layered paper" approach: high-contrast typography sits atop pristine white surfaces, which are further defined by surgical-grade borders and soft, atmospheric shadows. The interface feels operational and "live," reacting to user intent with subtle state changes rather than heavy ornamentation.

## Colors

The palette is rooted in a sophisticated "Slate" neutral scale to ensure the AI-generated insights remain the focal point. 

- **Primary Indigo (#4F46E5):** Used for primary actions and "Deep Logic" states.
- **Cyan Accent (#06B6D4):** Reserved for AI-specific features, data visualizations, and highlighting "Smart" insights.
- **System States:** High-saturation Emerald, Amber, and Rose are used sparingly for status indicators (Pass/Fail/Warning) to ensure maximum glanceability against the neutral backdrop.
- **Surface Strategy:** The background is a soft `#F8FAFC`, providing enough contrast for white cards (`#FFFFFF`) to appear elevated. Borders use a subtle Slate-200/300 mix to define structure without adding visual noise.

## Typography

This design system uses a hybrid typographic approach. **Geist** is employed for headings to provide a technical, sharp edge that reflects AI precision. **Inter** handles the heavy lifting for body copy and UI controls due to its peerless legibility at small sizes. 

**JetBrains Mono** is introduced for secondary metadata, timestamps, and confidence scores, reinforcing the "analytical" nature of the platform. Tighten letter-spacing on display styles to achieve the "Stripe/Vercel" premium feel.

## Layout & Spacing

The layout follows a **Fixed-Fluid Hybrid** model. Dashboards utilize a 12-column grid with a max-width of 1440px, centering the content for focus. Internal padding within modules is generous (24px) to ensure data-heavy tables don't feel claustrophobic.

- **Desktop:** 12 columns, 24px gutter, 40px+ outer margins.
- **Tablet:** 8 columns, 16px gutter, 24px outer margins.
- **Mobile:** 4 columns, 12px gutter, 16px outer margins.

Spacing follows a strict 4px / 8px scale. Use `md` (16px) for standard grouping and `lg` (24px) for distinct section separation.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** and **Subtle Shadows**. 

1.  **Level 0 (Base):** `#F8FAFC` — The canvas.
2.  **Level 1 (Cards/Surface):** `#FFFFFF` — All main content modules. These use a 1px border of `#E2E8F0` and a very soft, diffused shadow: `0 1px 3px 0 rgba(0, 0, 0, 0.02), 0 1px 2px -1px rgba(0, 0, 0, 0.03)`.
3.  **Level 2 (Hover/Active):** Slightly deeper shadow: `0 4px 6px -1px rgba(0, 0, 0, 0.05)`.
4.  **Level 3 (Modals/Dropdowns):** Crisp, high-contrast borders with a focused ambient shadow to suggest a physical overlay.

Avoid heavy blurs or colorful glows; maintain a clean, "paper-like" stack.

## Shapes

The shape language is **Structured but Approachable**. 

- **Cards & Containers:** Use `rounded-xl` (1rem / 16px) to soften the professional aesthetic.
- **Inputs & Buttons:** Use `rounded-md` (0.375rem / 6px) to maintain a sense of precision and "tooling."
- **Status Pills:** Fully rounded (9999px) to contrast against the rectangular grid.

Borders are consistently 1px. Avoid 2px borders except for focus states.

## Components

### Buttons
- **Primary:** Solid Indigo, white text. No gradient. Subtle brightness increase on hover.
- **Secondary:** White background, Slate-200 border, Slate-900 text.
- **Ghost:** No background/border, Slate-600 text. Background shifts to Slate-100 on hover.

### Data Tables (The Core)
- **Header:** Slate-50 background, tiny uppercase caps for labels, 1px bottom border.
- **Rows:** White background. On hover, a subtle `slate-50` tint.
- **Cells:** Use `data-mono` for numeric values or ID strings.

### Cards
- Always `rounded-xl`. 
- 24px internal padding. 
- Header section separated by a thin 1px horizontal rule.

### Input Fields
- White background with a subtle inner shadow. 
- Focus state: 1px Indigo border with a 3px soft Indigo ring (`ring-opacity-20`).

### AI Insights (Custom Component)
- Background: Very faint Cyan (`#ECFEFF`). 
- Left-border: 2px solid `#06B6D4`. 
- Iconography: Always paired with a "Spark" icon to denote machine-generated content.