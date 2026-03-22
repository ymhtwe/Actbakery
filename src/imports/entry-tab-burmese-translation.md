task: "Translate Data Entry > Entry tab UI to Burmese"
tool: "Figma AI / Figma Make"
page: "Data Entry"
tab: "Entry"

goal:
  - "Translate all visible UI text into Burmese"
  - "Keep layout, spacing, and styling unchanged"
  - "Do not modify functionality"

translations:

  tabs:
    "Entry": "ထည့်သွင်းခြင်း"
    "Sale": "ရောင်းချခြင်း"

  section_headers:
    "Production Date": "ထုတ်လုပ်သည့် ရက်စွဲ"
    "Manual Entry": "လက်ဖြင့် ထည့်သွင်းခြင်း"
    "Scan Mode": "စကန် မုဒ်"

  helper_text:
    "Select date for this batch":
      "ဤထုတ်လုပ်မှုအတွက် ရက်စွဲ ရွေးချယ်ပါ"
    "Select Item":
      "ပစ္စည်း ရွေးချယ်ရန်"
    "Quantity":
      "အရေအတွက်"
    "Choose item...":
      "ပစ္စည်း ရွေးချယ်ပါ..."
    "No items yet. Select an item above or use barcode scan below.":
      "ပစ္စည်း မရှိသေးပါ။ အပေါ်တွင် ပစ္စည်း ရွေးချယ်ပါ သို့မဟုတ် အောက်တွင် ဘားကုဒ် စကန်လုပ်ပါ။"
    "Scan or enter barcode...":
      "ဘားကုဒ် စကန်လုပ်ပါ သို့မဟုတ် ထည့်သွင်းပါ..."
    "Try: 4901234567890 (…), etc.":
      "ဥပမာ - 4901234567890 (…) စသည်ဖြင့်"

  buttons:
    "Add to List": "စာရင်းထဲ ထည့်ရန်"
    "Scan / Add": "စကန်ပြီး ထည့်ရန်"

rules:
  - "Do not change layout structure"
  - "Do not modify spacing or component sizes"
  - "Keep numeric values unchanged"
  - "Ensure Burmese text wraps properly on mobile"
  - "Adjust line-height slightly only if needed for readability"
  - "Keep icon placements unchanged"

apply_scope:
  - "Entry tab only"
  - "Do not modify Sale tab in this task"

responsive:
  - "Ensure no horizontal overflow on mobile"
  - "Buttons remain full width on small screens"

output: "Fully Burmese-translated Entry tab UI"