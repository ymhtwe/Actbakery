task: "Upgrade Data Entry page to support Entry and Sale transactions"

applies_to:
  - "User account > Data Entry page"
  - "Admin > Data Entry tab"

goal: "Create two transaction modes: Entry (add stock) and Sale (deduct stock)"

layout_changes:

  - action: "add_tabs"
    location: "Top of Data Entry page, below page title"
    tabs:
      - "Entry"
      - "Sale"
    default_active_tab: "Entry"
    style: "Match Reports tab style (Overview | By Item)"

Entry_tab:
  purpose: "Increase inventory"
  behavior:
    - "Keep existing Production Date section"
    - "Keep Scan Mode"
    - "Keep Manual Entry"
    - "On submit, quantity adds to inventory"
    - "Auto log date and time (system timestamp)"
  fields:
    - "Item"
    - "Quantity"
    - "Auto timestamp (hidden field)"
    - "User account name (auto log)"

Sale_tab:
  purpose: "Decrease inventory when selling"
  layout:
    - "Remove Production Date selector (timestamp auto generated)"
    - "Section title: Sale Transaction"
  fields:
    - field: "Select Item"
      type: "Dropdown"
    - field: "Select Customer"
      type: "Searchable dropdown"
      behavior:
        - "Allow selecting existing customer"
        - "Include '+ Add New Customer' option"
    - field: "Quantity"
      type: "Number input"
    - field: "Auto Date & Time"
      type: "System generated (not editable)"
  buttons:
    - "Submit Sale"
    - "Cancel"

  logic_notes:
    - "Submitting sale deducts quantity from inventory"
    - "Prevent sale if stock insufficient"
    - "Log transaction with timestamp and user"

customer_creation_modal:
  trigger: "+ Add New Customer"
  fields:
    - "Customer Name (required)"
    - "Phone Number (optional)"
    - "Address (optional)"
  buttons:
    - "Save Customer"
    - "Cancel"
  behavior:
    - "After saving, auto-select new customer in Sale form"

transaction_logging:
  requirements:
    - "Every Entry and Sale auto logs system date and time"
    - "Log user account name"
    - "Log transaction type (Entry or Sale)"
    - "Log item and quantity"

style_rules:
  - "Keep same card style, gold accent, rounded corners"
  - "Reuse existing Scan Mode and Manual Entry components"
  - "No redesign of visual theme"
  - "Maintain consistent spacing (24px section gap)"

responsive_behavior:
  desktop:
    - "Tabs horizontal"
    - "Forms centered"
  mobile:
    - "Tabs full width"
    - "Fields stacked vertically"
    - "Buttons full width"

do_not:
  - "Do not remove existing Entry functionality"
  - "Do not change existing color system"
  - "Do not change navigation sidebar"

output: "Updated Data Entry page with Entry and Sale transaction tabs"