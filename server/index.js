const express = require('express');
const cors = require('cors');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { createClient } = require('@libsql/client');

const app = express();
const PORT = process.env.PORT || 3001;

// ── S3 SETUP ──────────────────────────────────────────────────────────────────
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_BUCKET_NAME;

const getS3Key = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http')) return imagePath.split('.amazonaws.com/')[1];
  return imagePath;
};

const deleteFromS3 = async (imagePath) => {
  const key = getS3Key(imagePath);
  console.log('Deleting from S3 - imagePath:', imagePath);
  console.log('Deleting from S3 - key:', key);
  if (!key) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    console.log('S3 delete success:', key);
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
      cb(null, `products/${uniqueSuffix}${path.extname(file.originalname)}`);
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

// ── TURSO DATABASE SETUP ──────────────────────────────────────────────────────
const db = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const initDb = async () => {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL,
      variant_number INTEGER NOT NULL,
      image_path TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(product_id)
    )
  `);
  console.log('✅ Turso database ready');
};

const https = require('https');

app.get('/api/image-proxy', async (req, res) => {
  const { url } = req.query;
  
  // Security: only allow your own S3 bucket
  if (!url || !url.startsWith(`https://${BUCKET}`)) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  https.get(url, (stream) => {
    res.setHeader('Content-Type', stream.headers['content-type'] || 'image/jpeg');
    res.setHeader('Access-Control-Allow-Origin', '*');
    stream.pipe(res);
  }).on('error', (err) => {
    res.status(500).json({ error: err.message });
  });
});

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      "https://ravi-saree-emporium.vercel.app",
      "http://localhost:5173"
    ];
    if (!origin || allowed.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json());

// ── AUTH MIDDLEWARE ───────────────────────────────────────────────────────────
const requireAuth = (req, res, next) => {
  const password = req.headers['x-admin-password'];
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// ── ROUTES ────────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.send('🪷 Ravi Saree Emporium API is running!');
});

// GET /api/products
app.get('/api/products', async (req, res) => {
  try {
    const { search } = req.query;
    let result;
    if (search && search.trim()) {
      result = await db.execute({
        sql: `
          SELECT p.product_id, p.created_at,
            (SELECT v.image_path FROM variants v WHERE v.product_id = p.product_id ORDER BY v.variant_number ASC LIMIT 1) as first_image,
            (SELECT COUNT(*) FROM variants v WHERE v.product_id = p.product_id) as variant_count
          FROM products p
          WHERE p.product_id LIKE ?
          ORDER BY p.created_at DESC
        `,
        args: [`%${search.trim()}%`]
      });
    } else {
      result = await db.execute(`
        SELECT p.product_id, p.created_at,
          (SELECT v.image_path FROM variants v WHERE v.product_id = p.product_id ORDER BY v.variant_number ASC LIMIT 1) as first_image,
          (SELECT COUNT(*) FROM variants v WHERE v.product_id = p.product_id) as variant_count
        FROM products p
        ORDER BY p.created_at DESC
      `);
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:productId
app.get('/api/products/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const productResult = await db.execute({
      sql: 'SELECT * FROM products WHERE product_id = ?',
      args: [productId]
    });
    if (productResult.rows.length === 0) return res.status(404).json({ error: 'Product not found' });

    const variantsResult = await db.execute({
      sql: 'SELECT * FROM variants WHERE product_id = ? ORDER BY variant_number ASC',
      args: [productId]
    });
    res.json({ ...productResult.rows[0], variants: variantsResult.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products
app.post('/api/products', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { product_id, description } = req.body;
    if (!product_id || !product_id.trim()) {
      if (req.file) await deleteFromS3(req.file.key);
      return res.status(400).json({ error: 'Product ID is required' });
    }
    if (!req.file) return res.status(400).json({ error: 'Image is required' });

    const pid = product_id.trim().toUpperCase();
    const existing = await db.execute({
      sql: 'SELECT product_id FROM products WHERE product_id = ?',
      args: [pid]
    });
    if (existing.rows.length > 0) {
      await deleteFromS3(req.file.key);
      return res.status(409).json({ error: `Product ID "${pid}" already exists` });
    }

    const imageUrl = req.file.location;
    await db.execute({ sql: 'INSERT INTO products (product_id) VALUES (?)', args: [pid] });
    await db.execute({
      sql: 'INSERT INTO variants (product_id, variant_number, image_path, description) VALUES (?, 1, ?, ?)',
      args: [pid, imageUrl, description || '']
    });

    const newProduct = await db.execute({
      sql: `
        SELECT p.product_id, p.created_at,
          (SELECT v.image_path FROM variants v WHERE v.product_id = p.product_id ORDER BY v.variant_number ASC LIMIT 1) as first_image,
          (SELECT COUNT(*) FROM variants v WHERE v.product_id = p.product_id) as variant_count
        FROM products p WHERE p.product_id = ?
      `,
      args: [pid]
    });
    res.status(201).json(newProduct.rows[0]);
  } catch (err) {
    if (req.file) await deleteFromS3(req.file.key);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/variants
app.post('/api/variants', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { product_id, description } = req.body;
    if (!product_id) {
      if (req.file) await deleteFromS3(req.file.key);
      return res.status(400).json({ error: 'Product ID is required' });
    }
    if (!req.file) return res.status(400).json({ error: 'Image is required' });

    const pid = product_id.trim().toUpperCase();
    const product = await db.execute({
      sql: 'SELECT * FROM products WHERE product_id = ?',
      args: [pid]
    });
    if (product.rows.length === 0) {
      await deleteFromS3(req.file.key);
      return res.status(404).json({ error: 'Product not found' });
    }

    const maxVariant = await db.execute({
      sql: 'SELECT MAX(variant_number) as max FROM variants WHERE product_id = ?',
      args: [pid]
    });
    const nextVariantNum = (maxVariant.rows[0].max || 0) + 1;
    const imageUrl = req.file.location;

    const result = await db.execute({
      sql: 'INSERT INTO variants (product_id, variant_number, image_path, description) VALUES (?, ?, ?, ?)',
      args: [pid, nextVariantNum, imageUrl, description || '']
    });
    const newVariant = await db.execute({
      sql: 'SELECT * FROM variants WHERE id = ?',
      args: [result.lastInsertRowid]
    });
    res.status(201).json(newVariant.rows[0]);
  } catch (err) {
    if (req.file) await deleteFromS3(req.file.key);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/variants/:id
app.put('/api/variants/:id', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { description } = req.body;
    const variantResult = await db.execute({
      sql: 'SELECT * FROM variants WHERE id = ?',
      args: [id]
    });
    if (variantResult.rows.length === 0) {
      if (req.file) await deleteFromS3(req.file.key);
      return res.status(404).json({ error: 'Variant not found' });
    }

    const variant = variantResult.rows[0];
    let newImageUrl = variant.image_path;
    if (req.file) {
      await deleteFromS3(variant.image_path);
      newImageUrl = req.file.location;
    }

    await db.execute({
      sql: 'UPDATE variants SET image_path = ?, description = ? WHERE id = ?',
      args: [newImageUrl, description !== undefined ? description : variant.description, id]
    });
    const updated = await db.execute({
      sql: 'SELECT * FROM variants WHERE id = ?',
      args: [id]
    });
    res.json(updated.rows[0]);
  } catch (err) {
    if (req.file) await deleteFromS3(req.file.key);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/variants/:id
app.delete('/api/variants/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const variantResult = await db.execute({
      sql: 'SELECT * FROM variants WHERE id = ?',
      args: [id]
    });
    if (variantResult.rows.length === 0) return res.status(404).json({ error: 'Variant not found' });

    await deleteFromS3(variantResult.rows[0].image_path);
    await db.execute({ sql: 'DELETE FROM variants WHERE id = ?', args: [id] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/products/:productId
app.delete('/api/products/:productId', requireAuth, async (req, res) => {
  try {
    const { productId } = req.params;
    const productResult = await db.execute({
      sql: 'SELECT * FROM products WHERE product_id = ?',
      args: [productId]
    });
    if (productResult.rows.length === 0) return res.status(404).json({ error: 'Product not found' });

    const variantsResult = await db.execute({
      sql: 'SELECT * FROM variants WHERE product_id = ?',
      args: [productId]
    });
    for (const v of variantsResult.rows) {
      await deleteFromS3(v.image_path);
    }

    await db.execute({ sql: 'DELETE FROM variants WHERE product_id = ?', args: [productId] });
    await db.execute({ sql: 'DELETE FROM products WHERE product_id = ?', args: [productId] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── START SERVER ──────────────────────────────────────────────────────────────
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`🪷 Ravi Saree Emporium Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
