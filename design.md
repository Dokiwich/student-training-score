# DESIGN.md

## 🎯 Product Context
- System: Student activity scoring / evaluation system
- Users: Students, Admin, Faculty
- Core tasks:
  - View score breakdown
  - Add activity evidence
  - Evaluate / approve scores

---

## 🎨 Design Philosophy (STRICT)
- Clean, institutional (giống hệ thống trường)
- Không flashy, không startup màu mè
- Ưu tiên readability > aesthetics
- Density cao nhưng vẫn rõ ràng

---

## 📐 Layout Rules

### 1. Page Structure
- Sidebar (optional)
- Top navigation
- Main content = Card-based sections

### 2. Card UI (IMPORTANT)
- Border-radius: 10px
- Padding: 16–20px
- Background: white
- Shadow: subtle (no heavy blur)

---

## 🔢 Spacing System (STRICT)
- Base unit: 8px
- Common:
  - gap-8
  - gap-16
  - gap-24

---

## 🎯 Typography

- Font: system-ui / Inter
- Title: 18–20px semibold
- Section: 16px medium
- Body: 14px
- Label: 12–13px

---

## 🎨 Color System

### Primary
- Blue: #1E5EFF

### Status
- Success: #22C55E
- Warning: #F59E0B
- Error: #EF4444

### Neutral
- Text: #1F2937
- Subtext: #6B7280
- Border: #E5E7EB
- Background: #F9FAFB

---

## 🧩 Component Rules

### 1. Tabs (like "Tiêu chí / Minh chứng")
- Active:
  - Blue border bottom
  - Slight background highlight
- Inactive:
  - Gray text

---

### 2. Score Display (CRITICAL)
- Always right-aligned
- Bold
- Format: `20đ`, `6đ`
- Use color:
  - High score: blue
  - Low: gray

---

### 3. Activity List

- Each item:
  - Left: bullet / dot
  - Middle: activity name
  - Right: optional action (Chi tiết)

- Use:
  - Red dot = missing proof
  - Green = valid

---

### 4. Evidence Section (IMPORTANT)

States:
- Empty:
  - dashed border box
  - text: "Không có ảnh"
- Filled:
  - thumbnail grid

---

### 5. Button

Primary:
- Blue background
- White text
- Rounded: 8px

Secondary:
- Gray background
- Dark text

---

### 6. Modal (Edit Score)

- Width: 400–480px
- Centered
- Contains:
  - Title
  - Description
  - Stepper input (- / number / +)
  - Actions: Confirm / Cancel

---

### 7. Stepper Input

- Horizontal layout:
  [-] [ 10 ] [+]

- Constraints:
  - min/max enforced
  - no free typing OR validate strictly

---

## ⚙️ Interaction Rules

### 1. Add Activity (+ button)
- Opens modal
- Multi-select list
- Must show:
  - checkbox
  - activity name
  - detail link

---

### 2. Score Update
- Real-time UI update
- No reload

---

### 3. Validation
- Prevent adding duplicate activity
- Show error state clearly

---

## 🚫 DO NOT

- ❌ dùng nhiều màu
- ❌ animation phức tạp
- ❌ shadow nặng
- ❌ font lạ

---

## ✅ UX Principles

- Clarity > đẹp
- User luôn biết:
  - đang ở đâu
  - thiếu gì
  - cần làm gì

---

## 🔥 PRIORITY

1. Readability
2. Data clarity
3. Fast interaction
4. Minimal friction