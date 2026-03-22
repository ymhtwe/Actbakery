Goal: Connect “Create Customer” modal to Supabase public.customers table and save a real row.

Database (Supabase):

Table: public.customers

Columns:

id uuid (auto / default)

name text (required)

phone text (optional)

address text (optional)

created_at timestamptz (default now)

Requirements:

Do NOT use kv_store (ignore it completely). Use only public.customers.

When user clicks “Save / Create Customer”:

Validate name is not empty.

Insert row into public.customers with { name, phone, address }.

Let Supabase generate id and created_at.

After successful insert:

Close modal

Show success toast (e.g., “Customer created”)

Refresh customer dropdown/list so the new customer appears immediately

(Optional) auto-select the newly created customer in the form

On error:

Keep modal open

Show error message (Supabase error text)

Responsive UI:

Modal must fit on mobile (stack fields, full-width buttons)

Desktop stays centered with max-width (e.g., 520–600px)

Use the existing Supabase client already in the project; if missing, add a reusable helper like supabaseClient.ts.

Add clean code structure:

createCustomer() function

Loading state on submit button

Disable submit while saving

Deliverable:

Working UI + code that writes to public.customers table and updates UI state after insert.