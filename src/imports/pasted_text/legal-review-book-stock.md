Create a complete, modern, and professional web-based Book Stock Management System for The Legal Review Sdn. Bhd.

This system is an internal business platform used by employees and administrators to manage legal publication inventory, customer subscriptions, invoices, delivery orders, stock tracking, and reports.

The company sells legal publications such as:

Malaysian Law Review Appellate Court (MLRA)
Malaysian Law Review High Court (MLRH)
Commonwealth Law Review

These publications are organized by publication name, year, and volume.

Visual Direction
Aesthetic reference: Think Linear's clean data density combined with Notion's calm minimalism — a unique enterprise SaaS-style design, not a generic admin dashboard template.
Color palette: Deep navy (
#1B2A4A) as the primary brand color, warm off-white (
#FAFAF8) as the background, muted gold (
#B8935F) as a sparing accent for highlights and CTAs, charcoal gray (
#2E2E2E) for body text. Avoid saturated blues, purples, or bright SaaS gradients — this should feel like a premium legal/publishing brand, not a startup dashboard.
Typography: Inter or a similarly clean, highly-legible sans-serif for UI text and tables. Comfortable line height and letter spacing for long reading sessions, since employees use the system throughout the workday.
Layout: Desktop-first. Fixed left sidebar at 240px width. Main content area max-width 1200px, centered with generous side padding.
Tables: Dense, enterprise-style rows (not spacious consumer-app rows) — compact row height, clear column alignment, subtle row dividers, hover states on rows. Use elegant tables and organized forms throughout.
Icons: Use a single consistent icon set (outline-style, 20px), applied only where it aids scanning — sidebar nav, status badges, action buttons.
Cards: Subtle elevation (soft shadow, 1px border), not heavy drop shadows.
Status/alert colors: Use the gold accent sparingly for warnings/alerts (e.g. low stock) rather than red/orange, to stay consistent with the palette.

The final design should feel like a premium business platform that employees can use efficiently throughout the workday without visual fatigue.

User Roles & Permissions

The system should support two user roles:

Admin

Full access to the system.

Admin permissions:

Manage user accounts (create, edit, delete employee accounts)
Add, edit, delete customers
Add, edit, delete invoices
Add, edit, delete delivery orders
Add, edit, delete publications
Update inventory stock quantities manually
Access all reports
Access all settings

Only the Admin can manually update stock quantities and perform deletion actions.

Employee

Access limited to daily operational functions.

Employee permissions:

View, add, edit customers
Create invoices
Create delivery orders
Upload Invoice PDFs and Delivery Order PDFs
View inventory
View reports

Employees should NOT be able to: delete customers, invoices, delivery orders, or users; update stock quantities manually; manage users; access administrative settings.

The interface should automatically show different actions based on the logged-in user role.

Authentication

Login Page should include:

Company logo
Email/Username field
Password field
Remember Me checkbox
Forgot Password link
Sign In button

Design: centered card on the off-white background, subtle shadow, 8px rounded corners.

Logout accessible from the user profile menu in the sidebar.

Main Navigation

Sidebar with only these menu items, in this order:

Dashboard
Customer
Invoices
Delivery Orders
Book Management
Report
Setting

Include a user profile section at the bottom with avatar, name, role label (Admin/Employee), and logout dropdown. Do not add any additional menu items.

Dashboard

Design two variants: Admin and Employee.

Both roles see:

Summary cards: Total Customers, Active Customers, Active Subscriptions, Total Invoices, Total Delivery Orders, Low Stock Items
Monthly Sales chart
Recent Invoices table (last 5)
Recent Delivery Orders table (last 5)
Low Stock Alerts panel

Admin-only additions:

Monthly Revenue card
Revenue Trend chart
Subscription Workflow

Customers subscribe for 1, 2, or 3 years. The subscription period determines which publication years the customer is entitled to receive (e.g. a 2025–2026 subscription receives all volumes released in that period, delivered progressively as released).

Track per subscription:

Subscription Start Year, End Year, Duration
Publication Name
Subscription Status
Delivered Volumes, Pending Volumes, Invoiced Volumes

This lets employees monitor fulfillment and ensure customers receive all entitled volumes.

Customer Module

Functions: Add, Edit, Update Status, Search, Filter customers.

Customer information fields:

Invoice Number
Company / Law Firm Name
Assigned PIC
Contact Person
TIN Number
BRN / Registration Number
Subscription Period
Operational Status (Active / Invoiced / In Progress / Free Set)
Company Address
Telephone Number

Display in a professional, dense data table with an Edit action visible directly from the list (Delete visible only to Admin). Include a search bar and status filter above the table, plus an "Add Customer" primary button.

Book Management

Legal publication inventory module. Publications support multiple years (e.g. MLRA: 2012–2026). Each year contains Volume 1–6 plus Full Set.

Functions: View, Add, Edit, Delete, Search, Filter publications (Delete restricted to Admin).

Display inventory as a stock matrix: rows = Years, columns = Volume 1, Volume 2, Volume 3, Volume 4, Volume 5, Volume 6, Full Set. Show stock quantity in each cell, with a badge or color indicator when a cell is low stock.

Only Admin can manually edit stock quantities. Stock automatically decreases when books are sold through invoices or delivery orders (reflect this as a UI state, e.g. a "reserved" or updated quantity badge — the underlying logic will be implemented separately).

Invoice Module

Invoice fields: Invoice Number, Invoice Date, Customer, Company, Billing Address, Attention To.

Invoice items: Publication Selection, Year Selection, Volume/Full Set Selection, multiple line items, Quantity entry, auto-displayed Unit Price.

Discount: manual discount amount entry; display Original Price, Discount Amount, and Final Price After Discount, with totals updating automatically.

Delivery Order section inside the invoice: Customer Details, Delivery Address, Book Item(s) and Quantity, Delivery Date, and a "Create Delivery Order: Yes/No" toggle — if Yes, a linked Delivery Order is generated automatically on save.

PDF attachments: allow uploading Invoice PDF and Delivery Order PDF, viewable and downloadable later.

Include payment information and bank details on the invoice.

Delivery Orders

Fields: Delivery Order Number, Dispatch Date, Customer, PIC, Shipping Address, Contact Number, Publication, Year, Volume, Quantity.

Delivery Status: Pending, Dispatched, Delivered. (Do not include "Delivered & Stamped".)

Allow uploading and attaching Delivery Order PDF files, viewable and downloadable later.

Reports

Inventory Reports: Current Stock, Stock Movement, Low Stock Items.

Sales Reports: Monthly Sales, Annual Sales, Sales by Publication, Sales by Customer, Outstanding Payments.

All reports support Search, Filters, Date Range, Export to PDF, Export to Excel, Print.

Setting

Simple settings page: User Profile, General Preferences, Account Settings.

Data Safety

Instead of permanent deletion, use a soft delete / archive system for customers, invoices, delivery orders, and user accounts, to prevent accidental data loss and preserve history.

Sample Data (use this real data to populate the mockups — do not use generic placeholder text)
Customer List data
Invoice No	Company / Law Firm Name	Assigned PIC	Subscription Period	Operational Status
2110	ADNAN SHARIDA & ASSOCIATES	Syed	2025-2026	Active
2208	SUKHDEV & ASSOCIATES	Syed	2025-2026	Active
2078	Frances Harlina & Partners	Syed	2025-2026	Active
2019	A AZIDIN & SHAHRUL	Syed	2026	Invoiced
2052	RANBIR SSANGHA & CO	Syed	2025-2026	Active
2130	K SILA DASS & PARTNERS	Syed	2026	Active
2175	Manjit Singh Sachdev Mohammad Radzi & Partners	Syed	2026-2027	In Progress
2171	S.O. TAN	Syed	2026-2027	Active
2167	SHARIF & KHOO	Syed	2025	Active
2138	OTHMAN HASHIM & CO	Syed	2025-2026	Active
2132	MATHIMUGAM, CHEE & PARTNERS	Syed	2026-2027	Active
2127	GANESALINGAM VIJAYARATNAM & AISHA JOTHILINGAM	Syed	2026	Active
2153	NAZRI HISHAM ISA	Syed	2026-2027	Active
2191	KHAIRUL FADZLI AMIN & CO	Nadia	2026	Active
2181	V.M. MUTHU & CO	Syed	2026	Active
2196	Juel Dhillon & Co	Nadia	2026-2027	Active
2200	G. Ram Rozzeta & Associates	Syed	2026-2027	Active
2203	Lee Hishamuddin Allen & Gledhill (Sharifullah)	Yathwin/Effe	2025	Active
2058	Mahkamah Perusahaan Malaysia	Syed	2024-2025	Free Set
2055	Tenaga Nasional Berhad	Syed	2025-2026	Active
2176	Genting Malaysia Berhad	Syed	2026-2028	Active

Use this list to populate the Customer List screen table (show a representative subset of rows, at least 8-10, styled with the status badges described earlier).

Sample Invoice (for the Invoice Details / Create Invoice screen)
Invoice header: NO 2019/MLRA/2026
Issue date: 06/02/2026
Client company: A. AZIDIN & SHAHRUL
Address: 52-2, Jalan 2A/27A, Seksyen 5, Wangsa Maju, 53300 Kuala Lumpur
Attention to: Amr Sarrus Amali bin Sharif
Line item 1: The Malaysian Law Review Appellate Court — Bound Volumes (2017-2018) — 12 Volumes — RM 4,460.00
Line item 2: The Malaysian Law Review High Court (MLRH) — Bound Volumes (2017-2018) — 12 Volumes — RM 3,400.00
Line item 3: The Commonwealth Law Review (1-3) — Bound Volumes (2017-2018) — 3 Volumes — RM 2,300.00
Grand total due: RM 10,160.00
Disbursement bank: Public Bank
Disbursement account: 3165991104 (The Legal Review Sdn Bhd)
Sample Delivery Order (for the Delivery Order Details / dispatch slip screen)
Delivery order no: DO-2138
Dispatch date: 18/02/2026
Ship to: Mathews & Associates
Shipping address: No. 501-C, Jalan S2 D6, Magistrate's Square, Seremban 2, 70300 Seremban 2, Negeri Sembilan
Attention: Mr. Joseph Mathews
Contact: 06-7653041
Particulars shipped: Malaysian Law Review (Appellate Court) 2025 Volume 1
Quantity: 1
Status: Delivered
MLRA Volume Stock Matrix (for the Inventory Matrix screen)
Year	Vol 1	Vol 2	Vol 3	Vol 4	Vol 5	Vol 6	Full Set
2012	0	0	5	0	0	2	3
2013	4	1	3	3	0	1	0
2014	0	1	4	1	0	1	0
2015	1	2	2	1	21	0	0
2016	3	12	0	18	0	12	0
2017	1	1	1	2	0	2	0
2018	0	0	0	0	0	0	0
2019	11	0	1	3	1	3	0
2020	11	0	10	1	1	2	0
2021	0	1	0	1	1	10	0
2022	2	2	5	3	1	1	0
2023	2	3	0	1	3	1	0
2024	12	4	1	0	3	3	0
2025	0	0	0	0	0	0	0
MLRH Volume Stock Matrix (for the Inventory Matrix screen)
Year	Vol 1	Vol 2	Vol 3	Vol 4	Vol 5	Vol 6	Full Set
2012	20	0	0	0	24	0	0
2013	1	29	34	9	0	12	0
2014	7	4	0	7	0	12	0
2015	7	0	1	4	0	4	0
2016	6	17	31	11	11	18	0
2017	0	12	0	4	0	3	0
2018	1	0	0	4	2	2	0
2019	12	5	0	1	4	4	0
2020	0	4	1	0	0	0	0
2021	3	4	3	3	0	3	0
2022	4	2	1	1	4	10	0
2023	1	1	1	1	1	0	0
2024	1	1	1	1	1	1	0
2025	1	22	0	0	0	0	0

When rendering the Inventory Matrix screen, show both MLRA and MLRH as separate tabs or stacked tables using this data. Cells with 0 stock should be visually flagged (e.g. muted/grayed text or a low-stock badge) so the pattern of gaps in the real inventory is visible in the design.

Required Screens

Design complete UI screens for:

Login
Admin Dashboard
Employee Dashboard
Customer List
Customer Details
Book Management
Inventory Matrix
Invoice List
Create New Invoice
Invoice Details
Delivery Order List
Create Delivery Order
Delivery Order Details
Reports
Settings
User Management

The final design should look like a premium, modern, implementation-ready enterprise SaaS platform specifically built for The Legal Review Sdn. Bhd., accurately reflecting the workflow of managing legal publications, subscriptions, inventory, invoices, delivery orders, customers, and business reporting.