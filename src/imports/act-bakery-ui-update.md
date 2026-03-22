Improve the Admin Panel UI for ACT Bakery.

1. Fix Burmese-English mixed text in the Sales page.
Replace all English labels with proper Burmese translations.

Page Title:
Sales → အရောင်းမှတ်တမ်း

Charts:
Daily Sales Trend → နေ့စဉ် အရောင်းအခြေအနေ
Top Items → အရောင်းအများဆုံး ပစ္စည်းများ

Filters:
Date Range → ရက်အပိုင်းအခြား
Item → ပစ္စည်း
Search → ရှာဖွေရန်
Reset → ပြန်လည်သတ်မှတ်ရန်

Quick Buttons:
Today → ယနေ့
7 Days → ၇ ရက်
14 Days → ၁၄ ရက်
30 Days → ၃၀ ရက်
All → အားလုံး

Table title:
Sales Log → အရောင်းမှတ်တမ်းစာရင်း

Table columns:
Date → ရက်စွဲ
Item → ပစ္စည်း
Qty → အရေအတွက်
Customer → ဝယ်ယူသူ
Note → မှတ်ချက်

2. Enable editing of sales transactions for Super Admin.
Add two new columns in the Sales Log table:
- ပြင်ရန် (Edit)
- ဖျက်ရန် (Delete)

Clicking Edit should open a modal that allows modification of:
- Date
- Item
- Quantity
- Customer
- Note

3. Add a new sidebar tab above the Sales tab.

New tab name:
ကုန်ထုတ်လုပ်မှုမှတ်တမ်း

This page should display the production log and allow Super Admin to modify production quantities.

Production Log table columns:
- ရက်စွဲ
- ပစ္စည်း
- ထုတ်လုပ်ခဲ့သော အရေအတွက်
- မှတ်ချက်
- ပြင်ရန်
- ဖျက်ရန်

4. Do not modify database logic or routing yet. Only update UI layout and labels.
Ensure Burmese text is consistent and readable.