# UI Bug Report & Enhancement Plan: "Recent Sites" Section

**Context:** The "Recent Sites" section on the dashboard is currently rendering with severe layout constraints, resulting in truncated text, poor spacing, and unbalanced whitespace.

## Detected Issues

### 1. Text Truncation & Overflow
* **Observation:** The card content is being aggressively truncated.
    * *Evidence:* "Location not specified" renders as **"Lo..."**
    * *Evidence:* "No description available" renders as **"No descr..."**
* **Root Cause:** The text container has a fixed or insufficient `width`, likely combined with `overflow: hidden` or `text-overflow: ellipsis` without sufficient horizontal space.

### 2. Layout & Whitespace Imbalance
* **Observation:** The single site card is squeezed to the far left, leaving ~70% of the container width empty on the right.
* **Root Cause:** The parent container likely lacks a responsive grid/flex definition that allows children to expand or fill available space.

### 3. Vertical Density (Visual Hierarchy)
* **Observation:** Elements inside the card (Icon, Title, Location, Date, Description, Artifact count) are stacked without adequate breathing room.
* **Root Cause:** Insufficient `padding` within the card container and lack of `gap` between flex column items.

---

## Technical Recommendations (Action Plan)

### Task A: Fix Card Container Layout (CSS)
Refactor the parent container for "Recent Sites" to use a responsive grid or flexible layout.

```css
/* Recommended Structure */
.recent-sites-container {
  display: grid;
  /* Creates flexible columns that fill space but don't shrink too small */
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  width: 100%;
}