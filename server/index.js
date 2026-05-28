const express = require('express');
const cors = require('cors');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const app = express();
const PORT = process.env.PORT || 3001;

// ── S3 SETUP ─────────────────────────────────────────────────────────────────
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_BUCKET_NAME;

// Helper to extract S3 key from either a full URL or just a key
const getS3Key = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http')) {
    // Full S3 URL — extract key after .com/
    return imagePath.split('.amazonaws.com/')[1];
  }
  // Already just a key/filename
  return imagePath;
};

const deleteFromS3 = async (imagePath) => {
  const key = getS3Key(imagePath);
  if (!key) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (err) {
    console.error('S3 delete error:', err.message);
  }
};
// ── MULTER S3 CONFIG ──────────────────────────────────────────────────────────
const upload = multer({
  storage: multerS3({
    s3,
    bucket: BUCKET,
    key: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const fileName = `products/${uniqueSuffix}${path.extname(file.originalname)}`;
      cb(null, fileName);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = /image\/(jpeg|jpg|png|webp)/.test(file.mimetype);
    if (ext || mime) cb(null, true);
    else cb(new Error('Only JPG, PNG, WEBP images are allowed'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

// ── DATABASE SETUP ────────────────────────────────────────────────────────────
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    FOREIGN KEY (product_id) REFERENCES products(product_id)
  );
`);

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      "https://ravi-saree-emporium.vercel.app",
      "http://localhost:5173"
    ];
    // Allow any Vercel preview deployments
    if (!origin || allowed.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json());

// ── ROUTES ────────────────────────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.send("Ravi Saree Emporium API is running!");
});

// GET /api/products
app.get('/api/products', (req, res) => {
  try {
    const { search } = req.query;
    let products;
    if (search && search.trim()) {
      products = db.prepare(`
        SELECT p.product_id, p.created_at,
          (SELECT v.image_path FROM variants v WHERE v.product_id = p.product_id ORDER BY v.variant_number ASC LIMIT 1) as first_image,
          (SELECT COUNT(*) FROM variants v WHERE v.product_id = p.product_id) as variant_count
        FROM products p
        WHERE p.product_id LIKE ?
        ORDER BY p.created_at DESC
      `).all(`%${search.trim()}%`);
    } else {
      products = db.prepare(`
        SELECT p.product_id, p.created_at,
          (SELECT v.image_path FROM variants v WHERE v.product_id = p.product_id ORDER BY v.variant_number ASC LIMIT 1) as first_image,
          (SELECT COUNT(*) FROM variants v WHERE v.product_id = p.product_id) as variant_count
        FROM products p
        ORDER BY p.created_at DESC
      `).all();
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
app.post('/api/products', upload.single('image'), async (req, res) => {
  try {
    const { product_id, description } = req.body;
    if (!product_id || !product_id.trim()) {
      if (req.file) await deleteFromS3(req.file.key);
      return res.status(400).json({ error: 'Product ID is required' });
    }
    if (!req.file) return res.status(400).json({ error: 'Image is required' });

    const pid = product_id.trim().toUpperCase();
    const existing = db.prepare('SELECT product_id FROM products WHERE product_id = ?').get(pid);
    if (existing) {
      await deleteFromS3(req.file.key);
      return res.status(409).json({ error: `Product ID "${pid}" already exists` });
    }

    // Store the full S3 URL in image_path
    const imageUrl = req.file.location;

    db.prepare('INSERT INTO products (product_id) VALUES (?)').run(pid);
    db.prepare('INSERT INTO variants (product_id, variant_number, image_path, description) VALUES (?, 1, ?, ?)').run(pid, imageUrl, description || '');

    const newProduct = db.prepare(`
      SELECT p.product_id, p.created_at,
        (SELECT v.image_path FROM variants v WHERE v.product_id = p.product_id ORDER BY v.variant_number ASC LIMIT 1) as first_image,
        (SELECT COUNT(*) FROM variants v WHERE v.product_id = p.product_id) as variant_count
      FROM products p WHERE p.product_id = ?
    `).get(pid);

    res.status(201).json(newProduct);
  } catch (err) {
    if (req.file) await deleteFromS3(req.file.key);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/variants
app.post('/api/variants', upload.single('image'), async (req, res) => {
  try {
    const { product_id, description } = req.body;
    if (!product_id) {
      if (req.file) await deleteFromS3(req.file.key);
      return res.status(400).json({ error: 'Product ID is required' });
    }
    if (!req.file) return res.status(400).json({ error: 'Image is required' });

    const pid = product_id.trim().toUpperCase();
    const product = db.prepare('SELECT * FROM products WHERE product_id = ?').get(pid);
    if (!product) {
      await deleteFromS3(req.file.key);
      return res.status(404).json({ error: 'Product not found' });
    }

    const maxVariant = db.prepare('SELECT MAX(variant_number) as max FROM variants WHERE product_id = ?').get(pid);
    const nextVariantNum = (maxVariant.max || 0) + 1;
    const imageUrl = req.file.location;

    const result = db.prepare('INSERT INTO variants (product_id, variant_number, image_path, description) VALUES (?, ?, ?, ?)').run(pid, nextVariantNum, imageUrl, description || '');
    const newVariant = db.prepare('SELECT * FROM variants WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newVariant);
  } catch (err) {
    if (req.file) await deleteFromS3(req.file.key);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/variants/:id
app.put('/api/variants/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { description } = req.body;
    const variant = db.prepare('SELECT * FROM variants WHERE id = ?').get(id);
    if (!variant) {
      if (req.file) await deleteFromS3(req.file.key);
      return res.status(404).json({ error: 'Variant not found' });
    }

    let newImageUrl = variant.image_path;
    if (req.file) {
      // Delete old image from S3 (extract key from old URL)
      await deleteFromS3(variant.image_path);
      newImageUrl = req.file.location;
    }

    db.prepare('UPDATE variants SET image_path = ?, description = ? WHERE id = ?')
      .run(newImageUrl, description !== undefined ? description : variant.description, id);
    const updated = db.prepare('SELECT * FROM variants WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    if (req.file) await deleteFromS3(req.file.key);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/variants/:id
app.delete('/api/variants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const variant = db.prepare('SELECT * FROM variants WHERE id = ?').get(id);
    if (!variant) return res.status(404).json({ error: 'Variant not found' });

    await deleteFromS3(variant.image_path);

    db.prepare('DELETE FROM variants WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/products/:productId
app.delete('/api/products/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const product = db.prepare('SELECT * FROM products WHERE product_id = ?').get(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const variants = db.prepare('SELECT * FROM variants WHERE product_id = ?').all(productId);
    for (const v of variants) {
      await deleteFromS3(v.image_path);
    }

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
