# 🥻 Ravi Saree Emporium — Product Catalogue Manager

A luxurious, full-stack product catalogue manager for a traditional Indian saree and lehenga business, with a Royal Rajasthani textile design theme.

---

## ✨ Features

- **Product ID System**: Group colour variants under a single Product ID (e.g. RS-001, LH-042)
- **Colour Variants**: Add multiple colour variants per product, each with an image and description
- **Image Upload**: Upload from device gallery or camera (mobile-friendly)
- **Persistent Storage**: SQLite database — data survives server restarts
- **Responsive Design**: Works beautifully on mobile and desktop
- **Royal Theme**: Deep maroon, antique gold, and ivory Rajasthani aesthetic
- **Toast Notifications**: Success/error feedback on all actions
- **Confirm Modals**: Safe deletion with confirmation prompts

---

## 🚀 Setup & Run

### Prerequisites
- Node.js 18+ installed
- npm 9+

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

---

## 📁 Project Structure

```
ravi-saree-emporium/
├── package.json              # Root: runs both server + client
├── README.md
├── server/
│   ├── index.js              # Express server + all API routes
│   ├── package.json
│   ├── database/
│   │   └── catalog.db        # SQLite database (auto-created)
│   └── uploads/              # Uploaded images (auto-created)
└── client/
    ├── vite.config.js        # Proxies /api and /uploads to server
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

## 🗄️ Database Schema

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
| image_path | TEXT | Filename in /uploads |
| description | TEXT | Optional text |
| created_at | DATETIME | Auto |

---

## 🌐 API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/products | List all products (with search) |
| GET | /api/products/:id | Get product + all variants |
| POST | /api/products | Create product + first variant |
| POST | /api/variants | Add colour variant |
| PUT | /api/variants/:id | Edit variant |
| DELETE | /api/variants/:id | Delete variant |
| DELETE | /api/products/:id | Delete product + all variants |
| GET | /uploads/:filename | Serve images |

---

## 📱 Mobile Usage

The app supports:
- Camera capture directly from the upload button
- Responsive single-column layout on small screens
- Large tap targets for easy touch interaction
- Sticky header with back navigation

---

## 🎨 Design Theme

- **Fonts**: Playfair Display (headings) + Lato (body)
- **Colors**: Deep maroon (#7B1C2E), antique gold (#C9A84C), ivory (#FAF3E0)
- **Texture**: Subtle brocade/paisley SVG overlay
- **Cards**: Ivory with gold borders and hover lift animation
- **Buttons**: Gold gradient with shimmer on hover
