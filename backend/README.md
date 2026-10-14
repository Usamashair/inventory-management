# rexapack-backend

Laravel API for RexaPack CRM.

## Production

- **URL:** https://rexapack-backend.rankmybails.com
- **Frontend:** https://rexapack.rankmybails.com
- **Database:** `rexapack` (MySQL)

## Setup

```bash
composer install
cp .env.example .env
php artisan key:generate
# configure DB_* in .env
php artisan migrate
php artisan db:seed
```

## Seeded users

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@admin.com | 12345678 |
| Staff | staff@staff.com | 12345678 |
| Customer | customer@gamil.com | 12345678 |

Admin and staff have equal permissions. Customers are limited to their own records.

## API

Base URL: `https://rexapack-backend.rankmybails.com/api`

Auth: `Authorization: Bearer {token}` (from login)

| Method | Endpoint |
|--------|----------|
| POST | `/login` |
| POST | `/logout` |
| GET | `/me` |
| CRUD | `/customers` |
| CRUD | `/warehouses` |
| GET | `/warehouses/{id}/stocks` |
| GET | `/my-warehouse-stock` |
| CRUD | `/products` |
| CRUD | `/orders` |
| POST | `/orders/{order}/artworks` |
| CRUD | `/invoices` |
| CRUD | `/artworks` |
| CRUD | `/quotations` |
| POST | `/quotations/{id}/send` |
| POST | `/quotations/{id}/approve` |
| POST | `/quotations/{id}/reject` |
| GET/POST | `/delivery-requests` |
| POST | `/delivery-requests/{id}/fulfill` |
| POST | `/delivery-requests/{id}/reject` |
