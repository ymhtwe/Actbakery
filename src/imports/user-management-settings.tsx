Modify the Settings page to add a new section called User Management below Item Management.

Keep the current layout and styling consistent with the Admin Panel design.

1. Add a new tab section inside Settings:

Add two tabs:

Item Management

User Management

Default tab: Item Management
Clicking User Management switches content (do not remove Item Management).

2. User Management Layout

Create a clean, professional user management table with:

Columns:

Name

Email

Role (Super Admin / Admin / Staff)

Status (Active)

Created At

Actions (Edit / Disable)

3. Add “Create User” Button (Top Right)

Add a gold button:

Create User

Clicking opens a centered modal (not slide panel).

4. Create User Modal

Fields:

Full Name

Email

Password

Role (Dropdown: Admin, Staff)

Rules (UI only for now):

If current user email = redspot604@gmail.com
 → allow selecting Admin or Staff.

If current user role = Admin (not super admin) → Role dropdown only shows Staff.

Add buttons:

Cancel

Create Account (gold primary button)

5. Super Admin Badge

In the user table, if email = redspot604@gmail.com
:

Show role badge: Super Admin (distinct color, e.g., dark gold)

Disable Edit/Delete for this account.

6. Responsive Design

Ensure the User Management section:

Works cleanly on tablet width (stack columns properly)

On mobile width:

Convert table into card-style layout

Each user displayed as a card

Actions appear below the user info

Keep spacing consistent with dashboard.
Maintain the gold theme and soft neutral background.

Do not modify backend yet — UI only.

Keep clean, enterprise-style layout.