This is a B2B customer portal + light CRM/ERP for a packaging manufacturer/distributor (Rexapack). Customers and staff manage quotes, custom artwork approval, production orders, warehouse inventory, and invoices in one place.

What problem it solves
Rexapack sells packaging (boxes, labels, printed retail packaging). The product replaces email/spreadsheet chaos with a digital workflow:

Customer requests a quotation
Artwork is designed and approved (the print/packaging gate)
An order moves through production → ship → deliver
Stock is tracked across warehouses
An invoice is issued and payment status tracked
Login copy captures the pitch: “Your packaging, digitally managed” — approve artwork without email ping-pong, see warehouse inventory, and keep quotes/orders/invoices in one portal.

System shape
Layer	Stack	Role
Frontend
Next.js 16, React 19, Tailwind 4
Customer/admin portal (rexapack.rankmybails.com)
Backend
Laravel 13 (PHP 8.3), MySQL
REST API (rexapack-backend.rankmybails.com)
Auth
Custom bearer token (hashed in DB)
Not Sanctum — single token per user
Roles
admin | customer
Same users table; customers only see their own records
Portal
Bearer token /api
Next.js Portal
Laravel API
MySQL
Customer
Admin
Core domain (the business engine)
Module	Purpose	Status pipeline
Quotations
Pre-sale pricing
draft → sent → under-review → approved/rejected/expired
Artwork
Design/proof for custom print
waiting → in-design → review → approved → production
Orders
Multi-line manufacturing orders
pending → in-production → ready → shipped → delivered → completed
Products / Inventory
SKUs, qty, reserved, thresholds
in-stock / low-stock / out-of-stock
Warehouses
Stock & fulfillment locations
Simple location master
Invoices
Billing & payment tracking
draft → pending → partially-paid → paid / overdue
Customers
Portal accounts (admin CRUD)
Users with role=customer
The order and artwork status names are the giveaway: this is manufacturing packaging, not a simple retail cart. Orders are produced; artwork must clear review before production.

Who uses it
Customer — own quotes, orders, artwork, inventory, invoices; notifications/activity (UI mostly still mock).
Admin — everything above for all customers, plus warehouses, customer accounts, and planned ops screens (Odoo sync, stock alerts, cross-customer inventory).
Seeded demos: admin@admin.com / customer@gamil.com (password 12345678).

Architecture assessment (senior view)
Mature enough for a working MVP

Real CRUD APIs for products, orders (with line items), quotations, artworks, invoices, warehouses, customers
Role-scoped data access on the API
Clear packaging industry status vocabularies
Still mid-migration / incomplete product

Frontend started as a mock “PackCorp Pro” prototype; docs are stale
Main dashboard, notifications, activity, Odoo sync, stock alerts, and quote chat/accept are still largely hardcoded
Quote → order and order → invoice are not automated (no hard FKs; workflows are implied, not orchestrated)
Auth is custom and simple (no token expiry server-side; frontend has a 1-hour idle logout)
Authorization is manual isAdmin() checks, not Policies/Gates
Some denormalized fields (product name strings, rolled-up order totals) kept for a flat UI
