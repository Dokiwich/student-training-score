# Design System Inspired by Linear

## 1. Visual Theme & Atmosphere

Linear's website is a masterclass in dark-mode-first product design — a near-black canvas (`#08090a`) where content emerges from darkness like starlight. The overall impression is one of extreme precision engineering: every element exists in a carefully calibrated hierarchy of luminance, from barely-visible borders (`rgba(255,255,255,0.05)`) to soft, luminous text (`#f7f8f8`). This is not a dark theme applied to a light design — it is darkness as the native medium, where information density is managed through subtle gradations of white opacity rather than color variation.

The typography system is built entirely on Inter Variable with OpenType features `"cv01"` and `"ss03"` enabled globally, giving the typeface a cleaner, more geometric character. Inter is used at a remarkable range of weights — from 300 (light body) through 510 (medium, Linear's signature weight) to 590 (semibold emphasis). The 510 weight is particularly distinctive: it sits between regular and medium, creating a subtle emphasis that doesn't shout. At display sizes (72px, 64px, 48px), Inter uses aggressive negative letter-spacing (-1.584px to -1.056px), creating compressed, authoritative headlines that feel engineered rather than designed. Berkeley Mono serves as the monospace companion for code and technical labels, with fallbacks to ui-monospace, SF Mono, and Menlo.

The color system is almost entirely achromatic — dark backgrounds with white/gray text — punctuated by a single brand accent: Linear's signature indigo-violet (`#5e6ad2` for backgrounds, `#7170ff` for interactive accents). This accent color is used sparingly and intentionally, appearing only on CTAs, active states, and brand elements. The border system uses ultra-thin, semi-transparent white borders (`rgba(255,255,255,0.05)` to `rgba(255,255,255,0.08)`) that create structure without visual noise, like wireframes drawn in moonlight.

**Key Characteristics:**
- Dark-mode-native: `#08090a` marketing background, `#0f1011` panel background, `#191a1b` elevated surfaces
- Inter Variable with `"cv01", "ss03"` globally — geometric alternates for a cleaner aesthetic
- Signature weight 510 (between regular and medium) for most UI text
- Aggressive negative letter-spacing at display sizes (-1.584px at 72px, -1.056px at 48px)
- Brand indigo-violet: `#5e6ad2` (bg) / `#7170ff` (accent) / `#828fff` (hover) — the only chromatic color in the system
- Semi-transparent white borders throughout: `rgba(255,255,255,0.05)` to `rgba(255,255,255,0.08)`
- Button backgrounds at near-zero opacity: `rgba(255,255,255,0.02)` to `rgba(255,255,255,0.05)`
- Multi-layered shadows with inset variants for depth on dark surfaces
- Radix UI primitives as the component foundation (6 detected primitives)
- Success green (`#27a644`, `#10b981`) used only for status indicators

## 2. Color Palette & Roles

### Background Surfaces
- **Marketing Black** (`#010102` / `#08090a`): The deepest background — the canvas for hero sections and marketing pages. Near-pure black with an imperceptible blue-cool undertone.
- **Panel Dark** (`#0f1011`): Sidebar and panel backgrounds. One step up from the marketing black.
- **Level 3 Surface** (`#191a1b`): Elevated surface areas, card backgrounds, dropdowns.
- **Secondary Surface** (`#28282c`): The lightest dark surface — used for hover states and slightly elevated components.

### Text & Content
- **Primary Text** (`#f7f8f8`): Near-white with a barely-warm cast. The default text color — not pure white, preventing eye strain on dark backgrounds.
- **Secondary Text** (`#d0d6e0`): Cool silver-gray for body text, descriptions, and secondary content.
- **Tertiary Text** (`#8a8f98`): Muted gray for placeholders, metadata, and de-emphasized content.
- **Quaternary Text** (`#62666d`): The most subdued text — timestamps, disabled states, subtle labels.

### Brand & Accent
- **Brand Indigo** (`#5e6ad2`): Primary brand color — used for CTA button backgrounds, brand marks, and key interactive surfaces.
- **Accent Violet** (`#7170ff`): Brighter variant for interactive elements — links, active states, selected items.
- **Accent Hover** (`#828fff`): Lighter, more saturated variant for hover states on accent elements.
- **Security Lavender** (`#7a7fad`): Muted indigo used specifically for security-related UI elements.

### Status Colors
- **Green** (`#27a644`): Primary success/active status. Used for "in progress" indicators.
- **Emerald** (`#10b981`): Secondary success — pill badges, completion states.

### Border & Divider
- **Border Primary** (`#23252a`): Solid dark border for prominent separations.
- **Border Secondary** (`#34343a`): Slightly lighter solid border.
- **Border Tertiary** (`#3e3e44`): Lightest solid border variant.
- **Border Subtle** (`rgba(255,255,255,0.05)`): Ultra-subtle semi-transparent border — the default.
- **Border Standard** (`rgba(255,255,255,0.08)`): Standard semi-transparent border for cards, inputs, code blocks.
- **Line Tint** (`#141516`): Nearly invisible line for the subtlest divisions.
- **Line Tertiary** (`#18191a`): Slightly more visible divider line.

### Light Mode Neutrals (for light theme contexts)
- **Light Background** (`#f7f8f8`): Page background in light mode.
- **Light Surface** (`#f3f4f5` / `#f5f6f7`): Subtle surface tinting.
- **Light Border** (`#d0d6e0`): Visible border in light contexts.
- **Light Border Alt** (`#e6e6e6`): Alternative lighter border.
- **Pure White** (`#ffffff`): Card surfaces, highlights.

### Overlay
- **Overlay Primary** (`rgba(0,0,0,0.85)`): Modal/dialog backdrop — extremely dark for focus isolation.

## 3. Typography Rules

### Font Family
- **Primary**: `Inter Variable`, with fallbacks: `SF Pro Display, -apple-system, system-ui, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Open Sans, Helvetica Neue`
- **Monospace**: `Berkeley Mono`, with fallbacks: `ui-monospace, SF Mono, Menlo`
- **OpenType Features**: `"cv01", "ss03"` enabled globally — cv01 provides an alternate lowercase 'a' (single-story), ss03 adjusts specific letterforms for a cleaner geometric appearance.

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|------|--------|-------------|----------------|-------|
| Display XL | Inter Variable | 72px (4.50rem) | 510 | 1.00 (tight) | -1.584px | Hero headlines, maximum impact |
| Display Large | Inter Variable | 64px (4.00rem) | 510 | 1.00 (tight) | -1.408px | Secondary hero text |
| Display | Inter Variable | 48px (3.00rem) | 510 | 1.00 (tight) | -1.056px | Section headlines |
| Heading 1 | Inter Variable | 32px (2.00rem) | 400 | 1.13 (tight) | -0.704px | Major section titles |
| Heading 2 | Inter Variable | 24px (1.50rem) | 400 | 1.33 | -0.288px | Sub-section headings |
| Heading 3 | Inter Variable | 20px (1.25rem) | 590 | 1.33 | -0.24px | Feature titles, card headers |
| Body Large | Inter Variable | 18px (1.13rem) | 400 | 1.60 (relaxed) | -0.165px | Introduction text, feature descriptions |
| Body Emphasis | Inter Variable | 17px (1.06rem) | 590 | 1.60 (relaxed) | normal | Emphasized body, sub-headings in content |
| Body | Inter Variable | 16px (1.00rem) | 400 | 1.50 | normal | Standard reading text |
| Body Medium | Inter Variable | 16px (1.00rem) | 510 | 1.50 | normal | Navigation, labels |
| Body Semibold | Inter Variable | 16px (1.00rem) | 590 | 1.50 | normal | Strong emphasis |
| Small | Inter Variable | 15px (0.94rem) | 400 | 1.60 (relaxed) | -0.165px | Secondary body text |
| Small Medium | Inter Variable | 15px (0.94rem) | 510 | 1.60 (relaxed) | -0.165px | Emphasized small text |
| Small Semibold | Inter Variable | 15px (0.94rem) | 590 | 1.60 (relaxed) | -0.165px | Strong small text |
| Small Light | Inter Variable | 15px (0.94rem) | 300 | 1.47 | -0.165px | De-emphasized body |
| Caption Large | Inter Variable | 14px (0.88rem) | 510–590 | 1.50 | -0.182px | Sub-labels, category headers |
| Caption | Inter Variable | 13px (0.81rem) | 400–510 | 1.50 | -0.13px | Metadata, timestamps |
| Label | Inter Variable | 12px (0.75rem) | 400–590 | 1.40 | normal | Button text, small labels |
| Micro | Inter Variable | 11px (0.69rem) | 510 | 1.40 | normal | Tiny labels |
| Tiny | Inter Variable | 10px (0.63rem) | 400–510 | 1.50 | -0.15px | Overline text, sometimes uppercase |
| Link Large | Inter Variable | 16px (1.00rem) | 400 | 1.50 | normal | Standard links |
| Link Medium | Inter Variable | 15px (0.94rem) | 510 | 2.67 | normal | Spaced navigation links |
| Link Small | Inter Variable | 14px (0.88rem) | 510 | 1.50 | normal | Compact links |
| Link Caption | Inter Variable | 13px (0.81rem) | 400–510 | 1.50 | -0.13px | Footer, metadata links |
| Mono Body | Berkeley Mono | 14px (0.88rem) | 400 | 1.50 | normal | Code blocks |
| Mono Caption | Berkeley Mono | 13px (0.81rem) | 400 | 1.50 | normal | Code labels |
| Mono Label | Berkeley Mono | 12px (0.75rem) | 400 | 1.40 | normal | Code metadata, sometimes uppercase |

### Principles
- **510 is the signature weight**: Linear uses Inter Variable's 510 weight (between regular 400 and medium 500) as its default emphasis weight. This creates a subtly bolded feel without the heaviness of traditional medium or semibold.
- **Compression at scale**: Display sizes use progressively tighter letter-spacing — -1.584px at 72px, -1.408px at 64px, -1.056px at 48px, -0.704px at 32px. Below 24px, spacing relaxes toward normal.
- **OpenType as identity**: `"cv01", "ss03"` aren't decorative — they transform Inter into Linear's distinctive typeface, giving it a more geometric, purposeful character.
- **Three-tier weight system**: 400 (reading), 510 (emphasis/UI), 590 (strong emphasis). The 300 weight appears only in deliberately de-emphasized contexts.

## 4. Component Stylings

### Buttons

**Ghost Button (Default)**
- Background: `rgba(255,255,255,0.02)`
- Text: `#e2e4e7` (near-white)
- Padding: comfortable
- Radius: 6px
- Border: `1px solid rgb(36, 40, 44)`
- Outline: none
- Focus shadow: `rgba(0,0,0,0.1) 0px 4px 12px`
- Use: Standard actions, secondary CTAs

**Subtle Button**
- Background: `rgba(255,255,255,0.04)`
- Text: `#d0d6e0` (silver-gray)
- Padding: 0px 6px
- Radius: 6px
- Use: Toolbar actions, contextual buttons

**Primary Brand Button (Inferred)**
- Background: `#5e6ad2` (brand indigo)
- Text: `#ffffff`
- Padding: 8px 16px
- Radius: 6px
- Hover: `#828fff` shift
- Use: Primary CTAs ("Start building", "Sign up")

**Icon Button (Circle)**
- Background: `rgba(255,255,255,0.03)` or `rgba(255,255,255,0.05)`
- Text: `#f7f8f8` or `#ffffff`
- Radius: 50%
- Border: `1px solid rgba(255,255,255,0.08)`
- Use: Close, menu toggle, icon-only actions

**Pill Button**
- Background: transparent
- Text: `#d0d6e0`
- Padding: 0px 10px 0px 5px
- Radius: 9999px
- Border: `1px solid rgb(35, 37, 42)`
- Use: Filter chips, tags, status indicators

**Small Toolbar Button**
- Background: `rgba(255,255,255,0.05)`
- Text: `#62666d` (muted)
- Radius: 2px
- Border: `1px solid rgba(255,255,255,0.05)`
- Shadow: `rgba(0,0,0,0.03) 0px 1.2px 0px 0px`
- Font: 12px weight 510
- Use: Toolbar actions, quick-access controls

### Cards & Containers
- Background: `rgba(255,255,255,0.02)` to `rgba(255,255,255,0.05)` (never solid — always translucent)
- Border: `1px solid rgba(255,255,255,0.08)` (standard) or `1px solid rgba(255,255,255,0.05)` (subtle)
- Radius: 8px (standard), 12px (featured), 22px (large panels)
- Shadow: `rgba(0,0,0,0.2) 0px 0px 0px 1px` or layered multi-shadow stacks
- Hover: subtle background opacity increase

### Inputs & Forms

**Text Area**
- Background: `rgba(255,255,255,0.02)`
- Text: `#d0d6e0`
- Border: `1px solid rgba(255,255,255,0.08)`
- Padding: 12px 14px
- Radius: 6px

**Search Input**
- Background: transparent
- Text: `#f7f8f8`
- Padding: 1px 32px (icon-aware)

**Button-style Input**
- Text: `#8a8f98`
- Padding: 1px 6px
- Radius: 5px
- Focus shadow: multi-layer stack

### Badges & Pills

**Success Pill**
- Background: `#10b981`
- Text: `#f7f8f8`
- Radius: 50% (circular)
- Font: 10px weight 510
- Use: Status dots, completion indicators

**Neutral Pill**
- Background: transparent
- Text: `#d0d6e0`
- Padding: 0px 10px 0px 5px
- Radius: 9999px
- Border: `1px solid rgb(35, 37, 42)`
- Font: 12px weight 510
- Use: Tags, filter chips, category labels

**Subtle Badge**
- Background: `rgba(255,255,255,0.05)`
- Text: `#f7f8f8`
- Padding: 0px 8px 0px 2px
- Radius: 2px
- Border: `1px solid rgba(255,255,255,0.05)`
- Font: 10px weight 510
- Use: Inline labels, version tags

### Navigation
- Dark sticky header on near-black background
- Linear logomark left-aligned (SVG icon)
- Links: Inter Variable 13–14px weight 510, `#d0d6e0` text
- Active/hover: text lightens to `#f7f8f8`
- CTA: Brand indigo button or ghost button
- Mobile: hamburger collapse
- Search: command palette trigger (`/` or `Cmd+K`)

### Image Treatment
- Product screenshots on dark backgrounds with subtle border (`rgba(255,255,255,0.08)`)
- Top-rounded images: `12px 12px 0px 0px` radius
- Dashboard/issue previews dominate feature sections
- Subtle shadow beneath screenshots: `rgba(0,0,0,0.4) 0px 2px 4px`

## 5. Icon System

### Philosophy

Icon là một trong những dấu hiệu rõ ràng nhất phân biệt UI được thiết kế cẩn thận với UI trông "generic AI-generated". Linear sử dụng icon như một phần của ngôn ngữ hình ảnh nhất quán — không phải decoration, mà là thông tin. Mọi icon đều phải cảm giác như được vẽ bởi cùng một bàn tay, theo cùng một bộ quy tắc.

**Nguyên tắc cốt lõi:**
- **Monochrome tuyệt đối** — Icon không bao giờ có màu riêng. Màu của icon được kế thừa hoàn toàn từ context thông qua `currentColor`, không hardcode bất kỳ giá trị màu nào.
- **Stroke, không phải Fill** — Icon sử dụng đường viền (stroke-based), không phải vùng tô đặc (filled). Filled icon trông "nặng" và thường gợi lên cảm giác clipart hoặc emoji — đối lập với tinh thần kỹ thuật của Linear.
- **Geometry đơn giản** — Không có gradient, không có drop shadow, không có hiệu ứng 3D. Icon là ngôn ngữ ký hiệu thuần túy, không phải minh họa.
- **Không dùng icon pack màu mè** — Tuyệt đối không dùng các icon set như Flaticon, Freepik, hoặc bất kỳ icon nào có màu sắc cố định (xanh/đỏ/vàng hardcoded). Những icon này phá vỡ tính nhất quán của hệ màu achromatic ngay lập tức.

### Recommended Libraries

| Library | Style | Notes |
|---------|-------|-------|
| **Lucide** | Stroke, 24px grid, 2px stroke | Recommended — consistent geometry, dễ customize stroke width |
| **Phosphor Icons** | Stroke + Fill variants, 256px grid | Linh hoạt hơn — chỉ dùng `regular` (stroke) hoặc `light` variant |
| **Heroicons** | Stroke (outline) + Fill, 24px grid | Của Tailwind team — dùng `outline` variant |
| **Radix Icons** | Stroke, 15px grid, 1.5px stroke | Phù hợp nhất cho UI micro-elements, thích hợp với Radix primitives |
| **Tabler Icons** | Stroke, 24px grid, 2px stroke | Bộ lớn nhất, rất nhất quán |

> **Tránh dùng:** Font Awesome (quá "rounded, generic"), Material Icons filled variant, Bootstrap Icons filled, bất kỳ icon pack nào xuất phát từ flat design 2013–2017 era.

### Size Scale

Icon tuân theo cùng hệ spacing 8px của layout nhưng với granularity cao hơn ở kích thước nhỏ:

| Token | Size | Stroke Width | Use Case |
|-------|------|-------------|----------|
| `icon-xs` | 12px | 1.5px | Inline với caption text (13px), status dots bên cạnh label |
| `icon-sm` | 14px | 1.5px | Inline với body text (14–15px), compact list items |
| `icon-md` | 16px | 1.5px–2px | Default — navigation, buttons, input prefix/suffix |
| `icon-base` | 18px | 2px | Feature list items, sidebar navigation entries |
| `icon-lg` | 20px | 2px | Card headers, section sub-labels |
| `icon-xl` | 24px | 2px | Standalone feature icons, empty states |
| `icon-2xl` | 32px | 1.5px (optical) | Hero feature illustrations, large empty states |
| `icon-3xl` | 48px | 1.5px (optical) | Decorative — rất hiếm dùng, chỉ trong marketing sections |

> **Lưu ý stroke tại kích thước lớn:** Từ 32px trở lên, stroke 2px trông quá nặng — giảm xuống 1.5px để duy trì tỉ lệ thị giác phù hợp.

### Color Roles

Icon không có màu riêng — màu được xác định hoàn toàn bởi context. Mapping với text color system:

| Icon Role | Color | Hex | Use Case |
|-----------|-------|-----|----------|
| **Primary** | Primary White | `#f7f8f8` | Icon trong button primary, icon đang active/selected |
| **Default** | Silver Gray | `#d0d6e0` | Icon trong navigation links, default list items |
| **Subtle** | Tertiary Gray | `#8a8f98` | Icon placeholder trong input, icon decorative trong card |
| **Muted** | Quaternary Gray | `#62666d` | Icon trong disabled state, icon trong metadata/timestamps |
| **Accent** | Accent Violet | `#7170ff` | Icon trong active state, icon bên cạnh accent label |
| **Brand** | Brand Indigo | `#5e6ad2` | Icon trong primary CTA button |
| **Success** | Emerald | `#10b981` | Checkmark, completion indicator |
| **Danger** | — | Không có trong system | Linear không dùng màu đỏ trong UI chrome |

```css
/* Cách implement đúng — luôn dùng currentColor */
.icon {
  color: #8a8f98; /* set tại container */
  stroke: currentColor; /* icon SVG tự kế thừa */
}

/* Khi hover, chỉ cần đổi color của container */
.nav-item:hover .icon {
  color: #f7f8f8;
}
```

### Stroke & Style Rules

**Stroke Width**
- Tất cả icon sử dụng `stroke-width` nhất quán trong cùng một context — không mix 1.5px và 2px trong một component.
- `stroke-linecap: round` và `stroke-linejoin: round` cho cảm giác mềm, chính xác — tránh `square` hoặc `miter` trông cứng và thô.
- Không dùng `fill` — luôn set `fill: none` trừ khi icon có yếu tố solid nhỏ có chủ đích (ví dụ: dot trong notification badge).

**Optical Sizing**
- Icon ở 16px trở xuống nên dùng stroke 1.5px để không bị "quá nặng" ở kích thước nhỏ.
- Icon trong button cần visual weight ngang với label text bên cạnh — nếu label là weight 510, icon cũng nên đủ nặng (2px stroke ở 16px).

**Grid Alignment**
- Luôn render icon trên grid số nguyên — tránh icon size 15px, 17px, 19px vì gây blurry trên non-retina display.
- Dùng `width` và `height` cố định, không dùng `font-size` để scale icon SVG.

### Icon + Text Pairing

Khoảng cách giữa icon và text label tuân theo tỉ lệ chặt chẽ:

| Text Size | Icon Size | Gap | Notes |
|-----------|-----------|-----|-------|
| 10–11px (Tiny/Micro) | 12px | 4px | Label rất nhỏ, icon giữ kích thước tối thiểu |
| 12–13px (Label/Caption) | 14px | 4px | Navigation phụ, metadata rows |
| 14–15px (Small) | 16px | 6px | Compact list items, pills |
| 16px (Body) | 16–18px | 8px | Default button, navigation primary |
| 18px (Body Large) | 20px | 8px | Feature list items |
| 20px+ (Heading) | 24px | 10px | Card headers, section labels |

```html
<!-- Cấu trúc chuẩn — icon và text align baseline -->
<span style="display: flex; align-items: center; gap: 6px; color: #d0d6e0;">
  <svg width="16" height="16" stroke="currentColor" fill="none"
       stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <!-- icon path -->
  </svg>
  <span style="font-size: 15px; font-weight: 510;">Label text</span>
</span>
```

### State Behavior

| State | Icon Treatment |
|-------|----------------|
| **Default** | `#8a8f98` hoặc `#d0d6e0` tùy context |
| **Hover** | Transition lên một bậc sáng hơn — `#8a8f98` → `#d0d6e0` → `#f7f8f8` |
| **Active / Selected** | `#f7f8f8` hoặc `#7170ff` (accent) tùy loại element |
| **Disabled** | `#62666d`, opacity 0.4–0.5, không thay đổi khi hover |
| **Loading** | Thay thế icon bằng spinner cùng kích thước, cùng màu — không resize |

Transition cho icon state change: `color 150ms ease`, `opacity 150ms ease` — đồng nhất với transition của text.

### Icon-Only Elements

Khi icon không có label đi kèm (icon button, toolbar icon):
- Luôn có `aria-label` hoặc `title` cho accessibility.
- Background container nên đủ để tạo tap target tối thiểu 32×32px dù icon chỉ 16px.
- Tooltip xuất hiện sau 400ms hover delay với text mô tả hành động.
- Icon-only button dùng `border-radius: 50%` hoặc `6px` tùy context, background `rgba(255,255,255,0.03)`.

### What NOT to Do

- **Không dùng emoji làm icon** — Emoji có màu sắc cố định, scale không nhất quán, phá vỡ toàn bộ hệ màu achromatic.
- **Không dùng icon PNG/JPG** — Chỉ SVG. PNG icon không scale sắc nét và không thể đổi màu bằng CSS.
- **Không mix style** — Không dùng filled icon của thư viện này cạnh outlined icon của thư viện khác trong cùng một view.
- **Không hardcode màu trong SVG** — `fill="#ff0000"` hoặc `stroke="#3b82f6"` trong file SVG là sai hoàn toàn. Luôn dùng `currentColor`.
- **Không dùng icon để trang trí thuần túy** — Mỗi icon phải có semantic meaning. Icon không có ý nghĩa thì không cần thiết.
- **Không scale icon bằng transform** — Dùng `width`/`height` attribute, không dùng `transform: scale()` vì gây blur và misalignment.
- **Không dùng icon pack "3D" hay "gradient"** — Các set như Flaticon 3D, Microsoft Fluent Emoji, hay bất kỳ icon nào có gradient đều không phù hợp với hệ thống này.

---

## 6. Layout Principles

### Spacing System
- Base unit: 8px
- Scale: 1px, 4px, 7px, 8px, 11px, 12px, 16px, 19px, 20px, 22px, 24px, 28px, 32px, 35px
- The 7px and 11px values suggest micro-adjustments for optical alignment
- Primary rhythm: 8px, 16px, 24px, 32px (standard 8px grid)

### Grid & Container
- Max content width: approximately 1200px
- Hero: centered single-column with generous vertical padding
- Feature sections: 2–3 column grids for feature cards
- Full-width dark sections with internal max-width constraints
- Changelog: single-column timeline layout

### Whitespace Philosophy
- **Darkness as space**: On Linear's dark canvas, empty space isn't white — it's absence. The near-black background IS the whitespace, and content emerges from it.
- **Compressed headlines, expanded surroundings**: Display text at 72px with -1.584px tracking is dense and compressed, but sits within vast dark padding. The contrast between typographic density and spatial generosity creates tension.
- **Section isolation**: Each feature section is separated by generous vertical padding (80px+) with no visible dividers — the dark background provides natural separation.

### Border Radius Scale
- Micro (2px): Inline badges, toolbar buttons, subtle tags
- Standard (4px): Small containers, list items
- Comfortable (6px): Buttons, inputs, functional elements
- Card (8px): Cards, dropdowns, popovers
- Panel (12px): Panels, featured cards, section containers
- Large (22px): Large panel elements
- Full Pill (9999px): Chips, filter pills, status tags
- Circle (50%): Icon buttons, avatars, status dots

## 7. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat (Level 0) | No shadow, `#010102` bg | Page background, deepest canvas |
| Subtle (Level 1) | `rgba(0,0,0,0.03) 0px 1.2px 0px` | Toolbar buttons, micro-elevation |
| Surface (Level 2) | `rgba(255,255,255,0.05)` bg + `1px solid rgba(255,255,255,0.08)` border | Cards, input fields, containers |
| Inset (Level 2b) | `rgba(0,0,0,0.2) 0px 0px 12px 0px inset` | Recessed panels, inner shadows |
| Ring (Level 3) | `rgba(0,0,0,0.2) 0px 0px 0px 1px` | Border-as-shadow technique |
| Elevated (Level 4) | `rgba(0,0,0,0.4) 0px 2px 4px` | Floating elements, dropdowns |
| Dialog (Level 5) | Multi-layer stack: `rgba(0,0,0,0) 0px 8px 2px, rgba(0,0,0,0.01) 0px 5px 2px, rgba(0,0,0,0.04) 0px 3px 2px, rgba(0,0,0,0.07) 0px 1px 1px, rgba(0,0,0,0.08) 0px 0px 1px` | Popovers, command palette, modals |
| Focus | `rgba(0,0,0,0.1) 0px 4px 12px` + additional layers | Keyboard focus on interactive elements |

**Shadow Philosophy**: On dark surfaces, traditional shadows (dark on dark) are nearly invisible. Linear solves this by using semi-transparent white borders as the primary depth indicator. Elevation isn't communicated through shadow darkness but through background luminance steps — each level slightly increases the white opacity of the surface background (`0.02` → `0.04` → `0.05`), creating a subtle stacking effect. The inset shadow technique (`rgba(0,0,0,0.2) 0px 0px 12px 0px inset`) creates a unique "sunken" effect for recessed panels, adding dimensional depth that traditional dark themes lack.

## 8. Do's and Don'ts

### Do
- Use Inter Variable with `"cv01", "ss03"` on ALL text — these features are fundamental to Linear's typeface identity
- Use weight 510 as your default emphasis weight — it's Linear's signature between-weight
- Apply aggressive negative letter-spacing at display sizes (-1.584px at 72px, -1.056px at 48px)
- Build on near-black backgrounds: `#08090a` for marketing, `#0f1011` for panels, `#191a1b` for elevated surfaces
- Use semi-transparent white borders (`rgba(255,255,255,0.05)` to `rgba(255,255,255,0.08)`) instead of solid dark borders
- Keep button backgrounds nearly transparent: `rgba(255,255,255,0.02)` to `rgba(255,255,255,0.05)`
- Reserve brand indigo (`#5e6ad2` / `#7170ff`) for primary CTAs and interactive accents only
- Use `#f7f8f8` for primary text — not pure `#ffffff`, which would be too harsh
- Apply the luminance stacking model: deeper = darker bg, elevated = slightly lighter bg
- Use stroke-based, monochrome SVG icons only — always via `currentColor`
- Pick one icon library and use it exclusively throughout the entire project

### Don't
- Don't use pure white (`#ffffff`) as primary text — `#f7f8f8` prevents eye strain
- Don't use solid colored backgrounds for buttons — transparency is the system (rgba white at 0.02–0.05)
- Don't apply the brand indigo decoratively — it's reserved for interactive/CTA elements only
- Don't use positive letter-spacing on display text — Inter at large sizes always runs negative
- Don't use visible/opaque borders on dark backgrounds — borders should be whisper-thin semi-transparent white
- Don't skip the OpenType features (`"cv01", "ss03"`) — without them, it's generic Inter, not Linear's Inter
- Don't use weight 700 (bold) — Linear's maximum weight is 590, with 510 as the workhorse
- Don't introduce warm colors into the UI chrome — the palette is cool gray with blue-violet accent only
- Don't use drop shadows for elevation on dark surfaces — use background luminance stepping instead
- Don't use colored icons, emoji as icons, PNG icons, or filled icon variants
- Don't hardcode color values inside SVG files — always use `currentColor` for stroke and fill
- Don't mix icon styles from different libraries in the same view

## 9. Responsive Behavior

### Breakpoints
| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile Small | <600px | Single column, compact padding |
| Mobile | 600–640px | Standard mobile layout |
| Tablet | 640–768px | Two-column grids begin |
| Desktop Small | 768–1024px | Full card grids, expanded padding |
| Desktop | 1024–1280px | Standard desktop, full navigation |
| Large Desktop | >1280px | Full layout, generous margins |

### Touch Targets
- Buttons use comfortable padding with 6px radius minimum
- Navigation links at 13–14px with adequate spacing
- Pill tags have 10px horizontal padding for touch accessibility
- Icon buttons at 50% radius ensure circular, easy-to-tap targets
- Search trigger is prominently placed with generous hit area

### Collapsing Strategy
- Hero: 72px → 48px → 32px display text, tracking adjusts proportionally
- Navigation: horizontal links + CTAs → hamburger menu at 768px
- Feature cards: 3-column → 2-column → single column stacked
- Product screenshots: maintain aspect ratio, may reduce padding
- Changelog: timeline maintains single-column through all sizes
- Footer: multi-column → stacked single column
- Section spacing: 80px+ → 48px on mobile

### Image Behavior
- Dashboard screenshots maintain border treatment at all sizes
- Hero visuals simplify on mobile (fewer floating UI elements)
- Product screenshots use responsive sizing with consistent radius
- Dark background ensures screenshots blend naturally at any viewport

## 10. Agent Prompt Guide

### Quick Color Reference
- Primary CTA: Brand Indigo (`#5e6ad2`)
- Page Background: Marketing Black (`#08090a`)
- Panel Background: Panel Dark (`#0f1011`)
- Surface: Level 3 (`#191a1b`)
- Heading text: Primary White (`#f7f8f8`)
- Body text: Silver Gray (`#d0d6e0`)
- Muted text: Tertiary Gray (`#8a8f98`)
- Subtle text: Quaternary Gray (`#62666d`)
- Accent: Violet (`#7170ff`)
- Accent Hover: Light Violet (`#828fff`)
- Border (default): `rgba(255,255,255,0.08)`
- Border (subtle): `rgba(255,255,255,0.05)`
- Focus ring: Multi-layer shadow stack
- Icon color (default): `#8a8f98` via `currentColor`
- Icon color (active): `#f7f8f8` via `currentColor`

### Quick Icon Reference
- Library: Lucide hoặc Radix Icons (stroke only)
- Stroke width: 1.5px (≤16px icon), 2px (18–24px icon)
- Color: luôn `currentColor` — không hardcode
- Format: SVG inline, không dùng PNG/JPG
- Style: outline/stroke variant — không dùng filled variant

### Example Component Prompts
- "Create a hero section on `#08090a` background. Headline at 48px Inter Variable weight 510, line-height 1.00, letter-spacing -1.056px, color `#f7f8f8`, font-feature-settings `'cv01', 'ss03'`. Subtitle at 18px weight 400, line-height 1.60, color `#8a8f98`. Brand CTA button (`#5e6ad2`, 6px radius, 8px 16px padding) and ghost button (`rgba(255,255,255,0.02)` bg, `1px solid rgba(255,255,255,0.08)` border, 6px radius)."
- "Design a card on dark background: `rgba(255,255,255,0.02)` background, `1px solid rgba(255,255,255,0.08)` border, 8px radius. Title at 20px Inter Variable weight 590, letter-spacing -0.24px, color `#f7f8f8`. Body at 15px weight 400, color `#8a8f98`, letter-spacing -0.165px."
- "Build a pill badge: transparent background, `#d0d6e0` text, 9999px radius, 0px 10px padding, `1px solid #23252a` border, 12px Inter Variable weight 510."
- "Create navigation: dark sticky header on `#0f1011`. Inter Variable 13px weight 510 for links, `#d0d6e0` text. Brand indigo CTA `#5e6ad2` right-aligned with 6px radius. Bottom border: `1px solid rgba(255,255,255,0.05)`. Icons from Lucide at 16px, stroke 1.5px, color `#8a8f98` default → `#f7f8f8` on hover, via currentColor."
- "Design a command palette: `#191a1b` background, `1px solid rgba(255,255,255,0.08)` border, 12px radius, multi-layer shadow stack. Input at 16px Inter Variable weight 400, `#f7f8f8` text. Results list with 13px weight 510 labels in `#d0d6e0` and 12px metadata in `#62666d`. Each result item has a 14px Lucide icon (stroke 1.5px, currentColor `#8a8f98`) left-aligned with 6px gap to label."
- "Create a feature list item: Lucide icon 20px stroke 2px color `#8a8f98`, gap 10px, title 16px Inter Variable weight 510 color `#f7f8f8`, description 14px weight 400 color `#8a8f98`."

### Iteration Guide
1. Always set font-feature-settings `"cv01", "ss03"` on all Inter text — this is non-negotiable for Linear's look
2. Letter-spacing scales with font size: -1.584px at 72px, -1.056px at 48px, -0.704px at 32px, normal below 16px
3. Three weights: 400 (read), 510 (emphasize/navigate), 590 (announce)
4. Surface elevation via background opacity: `rgba(255,255,255, 0.02 → 0.04 → 0.05)` — never solid backgrounds on dark
5. Brand indigo (`#5e6ad2` / `#7170ff`) is the only chromatic color — everything else is grayscale
6. Borders are always semi-transparent white, never solid dark colors on dark backgrounds
7. Berkeley Mono for any code or technical content, Inter Variable for everything else
8. Icons: Lucide or Radix, stroke-based, monochrome via `currentColor` — never colored, never filled, never PNG