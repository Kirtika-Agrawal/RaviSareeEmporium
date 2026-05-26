const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

// Database setup using Node.js built-in sqlite
const db = new DatabaseSync(path.join(dbDir, 'catalog.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL,
    variant_number INTEGER NOT NULL,
    image_path TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id)
  );
`);

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = /image\/(jpeg|jpg|png|webp)/.test(file.mimetype);
    if (ext || mime) cb(null, true);
    else cb(new Error('Only JPG, PNG, WEBP images are allowed'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Middleware
app.use(cors({
  origin: [
    "https://ravi-saree-emporium.vercel.app",
    "http://localhost:5173"
}));
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// ── ROUTES ──────────────────────────────────────────────────────────────────

// GET /api/products

// HOME

app.get("/", (req, res) => {
  res.send("Ravi Saree Emporium API is running!");
});

app.get('/api/products', (req, res) => {
  try {
    const { search } = req.query;
    let stmt;
    let products;
    if (search && search.trim()) {
      stmt = db.prepare(`
        SELECT p.product_id, p.created_at,
          (SELECT v.image_path FROM variants v WHERE v.product_id = p.product_id ORDER BY v.variant_number ASC LIMIT 1) as first_image,
          (SELECT COUNT(*) FROM variants v WHERE v.product_id = p.product_id) as variant_count
        FROM products p
        WHERE p.product_id LIKE ?
        ORDER BY p.created_at DESC
      `);
      products = stmt.all(`%${search.trim()}%`);
    } else {
      stmt = db.prepare(`
        SELECT p.product_id, p.created_at,
          (SELECT v.image_path FROM variants v WHERE v.product_id = p.product_id ORDER BY v.variant_number ASC LIMIT 1) as first_image,
          (SELECT COUNT(*) FROM variants v WHERE v.product_id = p.product_id) as variant_count
        FROM products p
        ORDER BY p.created_at DESC
      `);
      products = stmt.all();
    }
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:productId
app.get('/api/products/:productId', (req, res) => {
  try {
    const { productId } = req.params;
    const product = db.prepare('SELECT * FROM products WHERE product_id = ?').get(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const variants = db.prepare('SELECT * FROM variants WHERE product_id = ? ORDER BY variant_number ASC').all(productId);
    res.json({ ...product, variants });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products
app.post('/api/products', upload.single('image'), (req, res) => {
  try {
    const { product_id, description } = req.body;
    if (!product_id || !product_id.trim()) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Product ID is required' });
    }
    if (!req.file) return res.status(400).json({ error: 'Image is required' });

    const pid = product_id.trim().toUpperCase();
    const existing = db.prepare('SELECT product_id FROM products WHERE product_id = ?').get(pid);
    if (existing) {
      fs.unlinkSync(req.file.path);
      return res.status(409).json({ error: `Product ID "${pid}" already exists` });
    }

    db.prepare('INSERT INTO products (product_id) VALUES (?)').run(pid);
    db.prepare('INSERT INTO variants (product_id, variant_number, image_path, description) VALUES (?, 1, ?, ?)').run(pid, req.file.filename, description || '');

    const newProduct = db.prepare(`
      SELECT p.product_id, p.created_at,
        (SELECT v.image_path FROM variants v WHERE v.product_id = p.product_id ORDER BY v.variant_number ASC LIMIT 1) as first_image,
        (SELECT COUNT(*) FROM variants v WHERE v.product_id = p.product_id) as variant_count
      FROM products p WHERE p.product_id = ?
    `).get(pid);

    res.status(201).json(newProduct);
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/variants
app.post('/api/variants', upload.single('image'), (req, res) => {
  try {
    const { product_id, description } = req.body;
    if (!product_id) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Product ID is required' });
    }
    if (!req.file) return res.status(400).json({ error: 'Image is required' });

    const pid = product_id.trim().toUpperCase();
    const product = db.prepare('SELECT * FROM products WHERE product_id = ?').get(pid);
    if (!product) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Product not found' });
    }

    const maxVariant = db.prepare('SELECT MAX(variant_number) as max FROM variants WHERE product_id = ?').get(pid);
    const nextVariantNum = (maxVariant.max || 0) + 1;

    const result = db.prepare('INSERT INTO variants (product_id, variant_number, image_path, description) VALUES (?, ?, ?, ?)').run(pid, nextVariantNum, req.file.filename, description || '');
    const newVariant = db.prepare('SELECT * FROM variants WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newVariant);
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/variants/:id
app.put('/api/variants/:id', upload.single('image'), (req, res) => {
  try {
    const { id } = req.params;
    const { description } = req.body;
    const variant = db.prepare('SELECT * FROM variants WHERE id = ?').get(id);
    if (!variant) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Variant not found' });
    }

    let newImagePath = variant.image_path;
    if (req.file) {
      const oldPath = path.join(uploadsDir, variant.image_path);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      newImagePath = req.file.filename;
    }

    db.prepare('UPDATE variants SET image_path = ?, description = ? WHERE id = ?').run(newImagePath, description !== undefined ? description : variant.description, id);
    const updated = db.prepare('SELECT * FROM variants WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/variants/:id
app.delete('/api/variants/:id', (req, res) => {
  try {
    const { id } = req.params;
    const variant = db.prepare('SELECT * FROM variants WHERE id = ?').get(id);
    if (!variant) return res.status(404).json({ error: 'Variant not found' });
    const imgPath = path.join(uploadsDir, variant.image_path);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    db.prepare('DELETE FROM variants WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/products/:productId
app.delete('/api/products/:productId', (req, res) => {
  try {
    const { productId } = req.params;
    const product = db.prepare('SELECT * FROM products WHERE product_id = ?').get(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const variants = db.prepare('SELECT * FROM variants WHERE product_id = ?').all(productId);
    variants.forEach(v => {
      const imgPath = path.join(uploadsDir, v.image_path);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    });
    db.prepare('DELETE FROM variants WHERE product_id = ?').run(productId);
    db.prepare('DELETE FROM products WHERE product_id = ?').run(productId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🪷 Ravi Saree Emporium Server running on http://localhost:${PORT}`);
});
