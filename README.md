# FaceBurger — Digital Menu

Full-stack restaurant digital menu with Next.js 16, Drizzle ORM, Neon, Cloudinary, Zustand, next-intl.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env and fill in values
cp .env.example .env.local

# 3. Push schema to Neon
npm run db:push

# 4. Seed the database
npm run db:seed

# 5. Start dev server
npm run dev
```

## Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `ADMIN_PASSWORD` | Password for `/admin` |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | WhatsApp number e.g. `212600000000` |

## Routes

| Route | Description |
|---|---|
| `/` | Customer menu (FR default) |
| `/ar` | Arabic RTL menu |
| `/en` | English menu |
| `/admin` | Redirects to `/admin/categories` |
| `/admin/login` | Admin login |
| `/admin/categories` | Manage categories |
| `/admin/items` | Manage menu items |
| `/admin/options` | Manage option groups & options |
| `/admin/orders` | View orders (read-only) |
