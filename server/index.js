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
    contentType: multerS3.AUTO_CONTENT_TYPE,
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
  // Without this, every variant lookup is a full table scan. The catalogue
  // query runs two of them per product, which is what burns the Turso row-read
  // quota. variant_number is included so the "first variant" lookup is
  // satisfied by the index alone.
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_variants_product
      ON variants (product_id, variant_number)
  `);
  const productColumns = await db.execute('PRAGMA table_info(products)');
  if (!productColumns.rows.some(c => c.name === 'category')) {
    await db.execute('ALTER TABLE products ADD COLUMN category TEXT');
  }
  // One row per design per day keeps the table small however busy the site gets.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS product_stats (
      product_id TEXT NOT NULL,
      day TEXT NOT NULL,
      views INTEGER NOT NULL DEFAULT 0,
      whatsapp INTEGER NOT NULL DEFAULT 0,
      calls INTEGER NOT NULL DEFAULT 0,
      staff_views INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (product_id, day)
    )
  `);
  console.log('✅ Turso database ready');
};

// "  banarasi   silk " -> "Banarasi Silk", so the same category typed two ways
// doesn't show up as two filters. Empty means no category.
const normalizeCategory = (value) => {
  const cleaned = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!cleaned) return null;
  return cleaned.toLowerCase().replace(/(^|[\s-])\S/g, ch => ch.toUpperCase());
};

const PRODUCT_LIST_COLUMNS = `
  p.product_id, p.created_at, p.category,
  (SELECT v.image_path FROM variants v WHERE v.product_id = p.product_id ORDER BY v.variant_number ASC LIMIT 1) as first_image,
  (SELECT COUNT(*) FROM variants v WHERE v.product_id = p.product_id) as variant_count
`;

const https = require('https');

// Exact hostnames only. A startsWith check on the bucket name would also match
// hosts like `<bucket>.attacker.com`, turning this into an open proxy.
const allowedImageHosts = new Set([
  `${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`,
  `${BUCKET}.s3.amazonaws.com`,
]);

app.get('/api/image-proxy', (req, res) => {
  const { url } = req.query;

  let target;
  try {
    target = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }
  if (target.protocol !== 'https:' || !allowedImageHosts.has(target.hostname)) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  https.get(target, (stream) => {
    if (stream.statusCode !== 200) {
      stream.resume();
      return res.status(502).json({ error: `Upstream returned ${stream.statusCode}` });
    }
    res.setHeader('Content-Type', stream.headers['content-type'] || 'image/jpeg');
    res.setHeader('Access-Control-Allow-Origin', '*');
    // Upload keys are unique per file and never rewritten, so responses are
    // safe to cache indefinitely.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    stream.pipe(res);
  }).on('error', (err) => {
    res.status(502).json({ error: err.message });
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

// GET /api/auth/check — lets the client verify the staff password up front
app.get('/api/auth/check', requireAuth, (req, res) => {
  res.json({ ok: true });
});

// GET /api/products?search=   or   ?limit=&category=  (newest designs only)
app.get('/api/products', async (req, res) => {
  try {
    const { search } = req.query;
    const limit = parseInt(req.query.limit, 10);
    if (limit > 0) {
      const category = normalizeCategory(req.query.category);
      const latest = await db.execute({
        sql: `SELECT ${PRODUCT_LIST_COLUMNS} FROM products p
              ${category ? 'WHERE p.category = ?' : ''}
              ORDER BY p.created_at DESC LIMIT ?`,
        args: category ? [category, Math.min(limit, 50)] : [Math.min(limit, 50)]
      });
      return res.json(latest.rows);
    }
    let result;
    if (search && search.trim()) {
      result = await db.execute({
        sql: `
          SELECT ${PRODUCT_LIST_COLUMNS}
          FROM products p
          WHERE p.product_id LIKE ?
          ORDER BY p.created_at DESC
        `,
        args: [`%${search.trim()}%`]
      });
    } else {
      result = await db.execute(`
        SELECT ${PRODUCT_LIST_COLUMNS}
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
    const { product_id, description, category } = req.body;
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
    await db.execute({
      sql: 'INSERT INTO products (product_id, category) VALUES (?, ?)',
      args: [pid, normalizeCategory(category)]
    });
    await db.execute({
      sql: 'INSERT INTO variants (product_id, variant_number, image_path, description) VALUES (?, 1, ?, ?)',
      args: [pid, imageUrl, description || '']
    });

    const newProduct = await db.execute({
      sql: `SELECT ${PRODUCT_LIST_COLUMNS} FROM products p WHERE p.product_id = ?`,
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

// PATCH /api/products  { product_ids, category } — tag many designs at once
app.patch('/api/products', requireAuth, async (req, res) => {
  try {
    const ids = Array.isArray(req.body.product_ids)
      ? [...new Set(req.body.product_ids.map(String))].slice(0, 500)
      : [];
    if (ids.length === 0) return res.status(400).json({ error: 'Choose at least one design' });
    if (!Object.prototype.hasOwnProperty.call(req.body, 'category')) {
      return res.status(400).json({ error: 'Category is required' });
    }
    const result = await db.execute({
      sql: `UPDATE products SET category = ? WHERE product_id IN (${ids.map(() => '?').join(', ')})`,
      args: [normalizeCategory(req.body.category), ...ids]
    });
    res.json({ updated: result.rowsAffected });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/products/:productId  { new_product_id?, category? }
app.patch('/api/products/:productId', requireAuth, async (req, res) => {
  try {
    const { productId } = req.params;
    const hasCategory = Object.prototype.hasOwnProperty.call(req.body, 'category');
    const newId = req.body.new_product_id === undefined
      ? productId
      : String(req.body.new_product_id).trim().toUpperCase();
    if (!newId) return res.status(400).json({ error: 'New Product ID is required' });

    if (hasCategory) {
      const updated = await db.execute({
        sql: 'UPDATE products SET category = ? WHERE product_id = ?',
        args: [normalizeCategory(req.body.category), productId]
      });
      if (updated.rowsAffected === 0) return res.status(404).json({ error: 'Product not found' });
    }
    if (newId === productId) return res.json({ product_id: newId });

    const existing = await db.execute({
      sql: 'SELECT product_id FROM products WHERE product_id IN (?, ?)',
      args: [productId, newId]
    });
    const ids = existing.rows.map(r => r.product_id);
    if (!ids.includes(productId)) return res.status(404).json({ error: 'Product not found' });
    if (ids.includes(newId)) return res.status(409).json({ error: `Product ID "${newId}" already exists` });

    // Insert-move-delete rather than updating the key in place, so the
    // variants foreign key is valid at every step. created_at is carried over
    // so the product keeps its position in the catalogue.
    await db.batch([
      {
        sql: 'INSERT INTO products (product_id, created_at, category) SELECT ?, created_at, category FROM products WHERE product_id = ?',
        args: [newId, productId]
      },
      { sql: 'UPDATE variants SET product_id = ? WHERE product_id = ?', args: [newId, productId] },
      { sql: 'UPDATE product_stats SET product_id = ? WHERE product_id = ?', args: [newId, productId] },
      { sql: 'DELETE FROM products WHERE product_id = ?', args: [productId] },
    ], 'write');

    res.json({ product_id: newId });
  } catch (err) {
    if (/UNIQUE constraint/i.test(err.message)) {
      return res.status(409).json({ error: 'That Product ID already exists' });
    }
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
    await db.execute({ sql: 'DELETE FROM product_stats WHERE product_id = ?', args: [productId] });
    await db.execute({ sql: 'DELETE FROM products WHERE product_id = ?', args: [productId] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── STATS ─────────────────────────────────────────────────────────────────────
const STAT_COLUMNS = { view: 'views', whatsapp: 'whatsapp', call: 'calls', staff_view: 'staff_views' };

// The shop's calendar day, so "today" flips at midnight in India.
const shopDay = (offsetDays = 0) =>
  new Date(Date.now() + 5.5 * 3600e3 - offsetDays * 86400e3).toISOString().slice(0, 10);

// POST /api/track?product_id=&event=view|whatsapp|call|staff_view
// Query params rather than a JSON body keep this a CORS "simple" request, so
// the browser can fire it while the page is opening WhatsApp.
app.post('/api/track', async (req, res) => {
  const column = STAT_COLUMNS[req.query.event];
  const productId = String(req.query.product_id || '').slice(0, 60);
  if (!column || !productId) return res.status(400).json({ error: 'Invalid event' });
  try {
    await db.execute({
      sql: `
        INSERT INTO product_stats (product_id, day, ${column})
        SELECT ?, ?, 1 WHERE EXISTS (SELECT 1 FROM products WHERE product_id = ?)
        ON CONFLICT (product_id, day) DO UPDATE SET ${column} = ${column} + 1
      `,
      args: [productId, shopDay(), productId]
    });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats?days=7|30|0   (0 = all time)
app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10);
    const since = days > 0 ? shopDay(days - 1) : '0000-00-00';
    const [totals, designs] = await db.batch([
      {
        sql: `SELECT COALESCE(SUM(views), 0) AS views, COALESCE(SUM(whatsapp), 0) AS whatsapp,
                     COALESCE(SUM(calls), 0) AS calls, COALESCE(SUM(staff_views), 0) AS staff_views
              FROM product_stats WHERE day >= ?`,
        args: [since]
      },
      {
        sql: `
          SELECT s.product_id, p.category,
            SUM(s.views) AS views, SUM(s.whatsapp) AS whatsapp, SUM(s.calls) AS calls,
            SUM(s.staff_views) AS staff_views,
            (SELECT v.image_path FROM variants v WHERE v.product_id = s.product_id
              ORDER BY v.variant_number ASC LIMIT 1) AS first_image
          FROM product_stats s
          JOIN products p ON p.product_id = s.product_id
          WHERE s.day >= ?
          GROUP BY s.product_id
          ORDER BY SUM(s.whatsapp) + SUM(s.calls) DESC, SUM(s.views) DESC
          LIMIT 50
        `,
        args: [since]
      },
    ], 'read');
    res.json({ since: days > 0 ? since : null, totals: totals.rows[0], designs: designs.rows });
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
