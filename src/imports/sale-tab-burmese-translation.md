task: "Translate Data Entry > Sale tab UI to Burmese"
tool: "Figma AI / Figma Make"
page: "Data Entry"
tab: "Sale"

goal:
  - "Translate all visible UI text to Burmese"
  - "Keep layout, spacing, and styling unchanged"
  - "Do not change logic or structure"

translations:

  headers:
    "Sale Transaction": "ရောင်းချမှု မှတ်တမ်း"

  fields:
    "Select Item": "ပစ္စည်း ရွေးချယ်ရန်"
    "Current stock:": "လက်ရှိ လက်ကျန်:"
    "Remaining stock:": "ကျန်ရှိ လက်ကျန်:"
    "Select Customer": "ဖောက်သည် ရွေးချယ်ရန်"
    "Quantity": "အရေအတွက်"
    "Date & Time (auto)": "ရက်စွဲနှင့် အချိန် (အလိုအလျောက်)"

  buttons:
    "Submit Sale": "ရောင်းချမှု တင်သွင်းရန်"
    "Cancel": "မလုပ်တော့ပါ"

  helper_text:
    "After sale: {item} will have {remaining} remaining":
      "ရောင်းချပြီးနောက် {item} သည် {remaining} ခု ကျန်ရှိမည်"

  status_labels:
    "Low": "လက်ကျန်နည်း"

rules:
  - "Do not modify layout structure"
  - "Do not change font sizes or component spacing"
  - "Keep numeric values unchanged"
  - "Preserve auto timestamp format"
  - "Ensure Burmese text does not overflow containers"
  - "Adjust line-height slightly only if needed for Burmese readability"

apply_scope:
  - "Sale tab only"
  - "Do not modify Entry tab in this task"

responsive:
  - "Ensure Burmese text wraps cleanly on mobile"
  - "No horizontal scrolling"

output: "Fully Burmese-translated Sale tab UI"