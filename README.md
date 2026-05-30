# 🥻 Ravi Saree Emporium — Product Catalogue Manager

A luxurious, full-stack product catalogue manager for a traditional Indian saree and lehenga business, with a Royal Rajasthani textile design theme.

🌐 **Live App**: [ravi-saree-emporium.vercel.app](https://ravi-saree-emporium.vercel.app)
⚙️ **API**: [ravisareeemporium.onrender.com](https://ravisareeemporium.onrender.com)

---

## ✨ Features

- **Product ID System** — Group colour variants under a single Product ID (e.g. RS-001, LH-042)
- **Colour Variants** — Add multiple colour variants per product, each with an image and description
- **Multi-select & Share** — Select multiple variants and share them via WhatsApp, Instagram, Telegram, or any app using the native share sheet
- **Image Upload** — Upload from device gallery or camera (mobile-friendly); images stored permanently on AWS S3
- **Persistent Storage** — Turso (libSQL cloud database) — data survives server restarts and redeployments
- **Admin Password Protection** — All write operations (create, edit, delete) are protected by an admin password prompt
- **Responsive Design** — Works beautifully on mobile and desktop
- **Royal Theme** — Deep maroon, antique gold, and ivory Rajasthani aesthetic
- **Toast Notifications** — Success/error feedback on all actions
- **Confirm Modals** — Safe deletion with password-gated confirmation prompts

---

## 🚀 Setup & Run Locally

### Prerequisites

- Node.js 22+ installed
- npm 9+
- AWS S3 bucket (for image storage)
- Turso account and database (for persistent data)

### Install & Start

```bash
# 1. Install all dependencies (root + server + client)
npm run install:all

# 2. Start both server and client
npm start
```

The app will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

### Environment Variables

Create a `.env` file inside the `server/` folder:

```env
PORT=3001
ADMIN_PASSWORD=your_secret_password

# AWS S3
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_BUCKET_NAME=your_bucket_name

# Turso
TURSO_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your_turso_token
```

---

## 📁 Project Structure

```
ravi-saree-emporium/
├── package.json              # Root: runs both server + client
├── vercel.json               # Proxies /api/* to Render backend (inside client/)
├── README.md
├── server/
│   ├── index.js              # Express server + all API routes
│   └── package.json
└── client/
    ├── vercel.json           # Vercel rewrite rules
    ├── vite.config.js        # Proxies /api to server in local dev
    ├── index.html
    └── src/
        ├── App.jsx
        ├── index.css         # Global theme
        ├── main.jsx
        ├── components/
        │   ├── AddProductModal.jsx
        │   ├── ConfirmModal.jsx
        │   ├── ImageUpload.jsx
        │   └── VariantModal.jsx
        ├── hooks/
        │   └── useToast.jsx
        ├── pages/
        │   ├── HomePage.jsx
        │   └── ProductPage.jsx
        └── utils/
            └── api.js
```

---

## 🗄️ Database Schema (Turso / libSQL)

**products**
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto increment |
| product_id | TEXT UNIQUE | e.g. "RS-001" |
| created_at | DATETIME | Auto |

**variants**
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto increment |
| product_id | TEXT FK | Links to products |
| variant_number | INTEGER | Auto per product |
| image_path | TEXT | Full S3 URL |
| description | TEXT | Optional text |
| created_at | DATETIME | Auto |

---

## 🌐 API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/products | List all products (supports ?search=) |
| GET | /api/products/:id | Get product + all variants |
| POST | /api/products | Create product + first variant (auth required) |
| POST | /api/variants | Add colour variant (auth required) |
| PUT | /api/variants/:id | Edit variant (auth required) |
| DELETE | /api/variants/:id | Delete variant (auth required) |
| DELETE | /api/products/:id | Delete product + all variants (auth required) |

All write endpoints require the header:
```
x-admin-password: your_secret_password
```

---

## ☁️ Deployment

### Frontend — Vercel

The `client/` folder is deployed to Vercel.

- **Root Directory**: `client`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables** (set in Vercel dashboard): none required — API is proxied via `vercel.json`

`client/vercel.json` rewrites all `/api/*` requests to the Render backend:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://ravisareeemporium.onrender.com/api/:path*"
    }
  ]
}
```

### Backend — Render

The `server/` folder is deployed as a Web Service on Render.

- **Root Directory**: `server`
- **Build Command**: `npm install`
- **Start Command**: `node --experimental-sqlite index.js`
- **Environment Variables** (set in Render dashboard):

| Key | Value |
|-----|-------|
| ADMIN_PASSWORD | your secret password |
| AWS_REGION | ap-south-1 (or your region) |
| AWS_ACCESS_KEY_ID | your AWS key |
| AWS_SECRET_ACCESS_KEY | your AWS secret |
| AWS_BUCKET_NAME | your bucket name |
| TURSO_URL | libsql://your-db.turso.io |
| TURSO_AUTH_TOKEN | your turso token |

> ⚠️ Render free tier spins down after inactivity. The first request after sleep may take 30–60 seconds to respond.

---

## 🖼️ Image Storage — AWS S3

All uploaded images are stored permanently on AWS S3, so they survive server restarts and redeployments.

- Images are uploaded via `multer-s3` directly from the Express server to S3
- Images are stored under the `products/` prefix in your bucket
- The full S3 URL is saved in the Turso database as `image_path`
- When a variant or product is deleted, the image is also deleted from S3

Make sure your S3 bucket has public read access or appropriate bucket policies for images to load in the browser.

---

## 🗃️ Database — Turso (libSQL)

All product and variant data is stored in [Turso](https://turso.tech), a persistent cloud SQLite database.

- Free tier supports up to 500 databases and 1 billion row reads/month
- Data persists across Render redeployments (unlike local SQLite)
- Uses the `@libsql/client` npm package

---

## 🔐 Admin Authentication

All create, edit, and delete operations are protected by an admin password.

- The password is entered via a modal prompt in the UI
- It is stored in `sessionStorage` (cleared when the browser tab is closed)
- It is sent as the `x-admin-password` HTTP header on all write requests
- The backend validates it against the `ADMIN_PASSWORD` environment variable
- Wrong password resets the gate and prompts again

---

## 📱 Mobile Usage

- Camera capture directly from the upload button
- Native share sheet for sharing variants (covers WhatsApp, Instagram, Telegram, iMessage, and more)
- Multi-select variants with checkboxes and share all selected at once
- Responsive single-column layout on small screens
- Large tap targets for easy touch interaction
- Sticky header with back navigation

---

## 🎨 Design Theme

- **Fonts**: Playfair Display (headings) + Lato (body)
- **Colors**: Deep maroon (`#7B1C2E`), antique gold (`#C9A84C`), ivory (`#FAF3E0`)
- **Texture**: Subtle brocade/paisley SVG overlay
- **Cards**: Ivory with gold borders and hover lift animation
- **Buttons**: Gold gradient with shimmer on hover
