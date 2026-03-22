task: "Update Data Entry > Sale tab to show remaining stock clearly"
tool: "Figma AI / Figma Make"
apply_to:
  - "Staff Data Entry page (/staff)"
  - "Admin > Reports > Data Entry tab (/admin > data entry)"
context:
  app_name: "ACT Bakery"
  page: "Data Entry"
  tabs:
    - "Entry"
    - "Sale"
goal:
  - "When user selects an item and enters sale quantity, show Remaining Stock immediately."
  - "Make it obvious and readable on both desktop and mobile."
requirements:
  layout_changes:
    - "In Sale tab, keep 'Current stock' line under item selector."
    - "Add a new line/row called 'Remaining stock' directly below 'Current stock'."
    - "Remaining stock value updates live as Quantity changes: remaining = current_stock - quantity."
    - "On mobile, stack these as a simple 2-line block (no horizontal overflow)."
  ui_details:
    remaining_stock_display:
      label: "Remaining stock:"
      states:
        ok:
          condition: "remaining_stock >= 0"
          behavior:
            - "Show remaining number normally (same style as current stock)."
            - "Submit button enabled."
        low_warning:
          condition: "remaining_stock >= 0 AND remaining_stock <= low_stock_threshold"
          behavior:
            - "Show remaining number with subtle warning emphasis (same warning style used elsewhere)."
            - "Optional: show small 'Low' chip next to remaining value."
        insufficient:
          condition: "remaining_stock < 0"
          behavior:
            - "Show remaining stock as 0 (or show negative in small muted text) but keep the main message clear."
            - "Show existing error banner: 'Insufficient stock...'"
            - "Disable Submit Sale button."
    placement:
      - "Place Remaining stock block above the Quantity input (or immediately below it), whichever looks cleaner, but must be visible without scrolling on mobile."
  behavior:
    - "Quantity input should not allow negative numbers."
    - "If quantity > current_stock, keep your existing error banner and disabled submit behavior."
  consistency:
    - "Use the same typography, spacing, border radius, and neutral background as existing cards."
    - "Do not change overall theme colors; only reuse existing styles."
acceptance_checks:
  - "Sale tab shows both Current stock and Remaining stock for selected item."
  - "Remaining stock updates instantly when Quantity changes."
  - "Mobile view: no horizontal scrolling; stock info is clearly visible."
notes:
  - "If the UI already shows 'Current stock: X', do NOT remove it—just add Remaining stock and make it prominent."
  - "If possible, show Remaining stock also near the Submit button as a small helper text for quick confirmation."