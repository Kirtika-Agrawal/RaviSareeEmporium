// Finds catalogue designs that look like a photo, e.g. of a returned saree.
// Every catalogue photo is turned into Gemini embeddings (lists of numbers
// describing what it looks like) and stored next to the variant; a search
// embeds the new photo the same way and ranks photos by how close they are.
const sharp = require('sharp');

const MODEL = 'gemini-embedding-2';
const DIMENSIONS = 768;
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:batchEmbedContents`;
const PHOTOS_PER_REQUEST = 6;
const MATCH_COUNT = 5;

// Catalogue photos show the whole saree on a model; returns are usually
// close-ups of folded fabric. Each photo is therefore also indexed as
// close-ups of the body fabric and of the border along the hem. Views are
// indexed in this order, so every design is searchable before close-ups start.
const VIEWS = {
  full: null,
  centre: { left: 0.25, top: 0.35, width: 0.5, height: 0.35 },
  border: { left: 0.1, top: 0.72, width: 0.8, height: 0.28 },
};
const VIEW_NAMES = Object.keys(VIEWS);

// The free Gemini tier allows about 1,000 embeddings a day, counted in Pacific
// time. Indexing stops short of that so searches keep working while it fills.
const DAILY_INDEX_LIMIT = 800;
const RETRY_AFTER_MS = 60 * 60 * 1000;

// A typed hint ("banarasi, red with gold border") nudges the ranking; the
// photo itself still decides most of it.
const HINT_WEIGHT = 0.35;
const CATEGORY_BONUS = 0.03;

sharp.concurrency(1);
sharp.cache(false);

class QuotaError extends Error {}

const pacificDay = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());

// Gemini looks at a small version of the image anyway, and the originals are
// several MB each.
const toJpeg = (image) =>
  image
    .resize(768, 768, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

async function viewJpeg(upright, view) {
  const crop = VIEWS[view];
  if (!crop) return toJpeg(sharp(upright.data));
  const { width, height } = upright.info;
  return toJpeg(sharp(upright.data).extract({
    left: Math.round(width * crop.left),
    top: Math.round(height * crop.top),
    width: Math.round(width * crop.width),
    height: Math.round(height * crop.height),
  }));
}

const imagePart = (jpeg) => ({ inline_data: { mime_type: 'image/jpeg', data: jpeg.toString('base64') } });

async function embed(inputs) {
  const res = await fetch(EMBED_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      requests: inputs.map(parts => ({
        model: `models/${MODEL}`,
        content: { parts },
        outputDimensionality: DIMENSIONS,
      })),
    }),
  });
  if (res.status === 429) throw new QuotaError('Gemini daily limit reached');
  if (!res.ok) throw new Error(`Gemini returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.embeddings.map(e => e.values);
}

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`photo returned ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const uprightPhoto = (buffer) => sharp(buffer).rotate().toBuffer({ resolveWithObject: true });

// photoUrl turns a stored image_path into a link that works on the private bucket.
function createPhotoMatcher(db, { photoUrl }) {
  let indexing = false;
  let pausedUntil = 0;

  const isConfigured = () => Boolean(process.env.GEMINI_API_KEY);

  async function init() {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS photo_views (
        variant_id INTEGER NOT NULL,
        view TEXT NOT NULL,
        image_path TEXT NOT NULL,
        indexed_day TEXT NOT NULL,
        embedding F32_BLOB(${DIMENSIONS}) NOT NULL,
        PRIMARY KEY (variant_id, view)
      )
    `);
    // The first version stored only whole photos, one row per variant.
    const old = await db.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'photo_embeddings'");
    if (old.rows.length > 0) {
      await db.batch([
        `INSERT OR IGNORE INTO photo_views (variant_id, view, image_path, indexed_day, embedding)
         SELECT variant_id, 'full', image_path, indexed_day, embedding FROM photo_embeddings`,
        'DROP TABLE photo_embeddings',
      ], 'write');
    }
    // Returns that staff matched to a design: an accuracy record now, and
    // labelled examples if the matcher is ever trained on shop photos.
    await db.execute(`
      CREATE TABLE IF NOT EXISTS photo_match_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        product_id TEXT NOT NULL,
        rank INTEGER,
        suggested TEXT NOT NULL,
        hint TEXT,
        photo_path TEXT
      )
    `);
  }

  async function forgetVariants(where, args) {
    await db.execute({ sql: `DELETE FROM photo_views WHERE variant_id IN (SELECT id FROM variants WHERE ${where})`, args });
  }

  async function status() {
    const [counts, feedback] = await db.batch([
      `SELECT
         (SELECT COUNT(*) FROM variants) AS total,
         SUM(e.view = 'full') AS indexed,
         SUM(e.view != 'full') AS closeups
       FROM photo_views e JOIN variants v ON v.id = e.variant_id AND v.image_path = e.image_path`,
      `SELECT COUNT(*) AS checked, COALESCE(SUM(rank = 1), 0) AS first, COALESCE(SUM(rank IS NOT NULL), 0) AS top
       FROM photo_match_feedback`,
    ], 'read');
    const c = counts.rows[0];
    const f = feedback.rows[0];
    const total = Number(c.total);
    return {
      configured: isConfigured(),
      total,
      indexed: Number(c.indexed || 0),
      closeups: Number(c.closeups || 0),
      closeupsTotal: total * (VIEW_NAMES.length - 1),
      feedback: { checked: Number(f.checked), first: Number(f.first), top: Number(f.top) },
    };
  }

  // Indexes photos that are new or were replaced since they were last indexed.
  // Safe to call often: only one run happens at a time, and it pauses itself
  // when the daily allowance is used up.
  async function indexPending() {
    if (!isConfigured() || indexing || Date.now() < pausedUntil) return;
    indexing = true;
    try {
      await db.execute('DELETE FROM photo_views WHERE variant_id NOT IN (SELECT id FROM variants)');
      const viewOrder = VIEW_NAMES.map((name, i) => `SELECT '${name}' AS view, ${i} AS position`).join(' UNION ALL ');
      const pending = (await db.execute(`
        SELECT v.id, v.image_path, w.view FROM variants v
        CROSS JOIN (${viewOrder}) w
        LEFT JOIN photo_views e ON e.variant_id = v.id AND e.view = w.view
        WHERE e.image_path IS NULL OR e.image_path != v.image_path
        ORDER BY w.position, v.id DESC
      `)).rows;

      for (let i = 0; i < pending.length; i += PHOTOS_PER_REQUEST) {
        const today = pacificDay();
        const done = await db.execute({ sql: 'SELECT COUNT(*) AS n FROM photo_views WHERE indexed_day = ?', args: [today] });
        if (Number(done.rows[0].n) >= DAILY_INDEX_LIMIT) throw new QuotaError('Daily indexing allowance used');

        const loaded = [];
        for (const item of pending.slice(i, i + PHOTOS_PER_REQUEST)) {
          try {
            const upright = await uprightPhoto(await download(await photoUrl(item.image_path)));
            loaded.push({ item, jpeg: await viewJpeg(upright, item.view) });
          } catch (err) {
            console.error(`Photo match: skipped variant ${item.id} ${item.view} (${err.message})`);
          }
        }
        if (loaded.length === 0) continue;

        const vectors = await embed(loaded.map(({ jpeg }) => [imagePart(jpeg)]));
        await db.batch(loaded.map(({ item }, k) => ({
          sql: `INSERT INTO photo_views (variant_id, view, image_path, indexed_day, embedding)
                VALUES (?, ?, ?, ?, vector32(?))
                ON CONFLICT (variant_id, view) DO UPDATE SET
                  image_path = excluded.image_path,
                  indexed_day = excluded.indexed_day,
                  embedding = excluded.embedding`,
          args: [item.id, item.view, item.image_path, today, JSON.stringify(vectors[k])],
        })), 'write');
      }
    } catch (err) {
      if (err instanceof QuotaError) {
        pausedUntil = Date.now() + RETRY_AFTER_MS;
        console.log(`Photo match: ${err.message}, trying again in an hour`);
      } else {
        console.error('Photo match: indexing failed:', err.message);
      }
    } finally {
      indexing = false;
    }
  }

  async function findMatches(photo, hint) {
    const jpeg = await viewJpeg(await uprightPhoto(photo), 'full');
    const cleanHint = String(hint || '').trim().slice(0, 200);
    const inputs = [[imagePart(jpeg)]];
    if (cleanHint) inputs.push([{ text: `task: search result | query: ${cleanHint}` }]);
    const [photoVector, hintVector] = await embed(inputs);

    const rows = (await db.execute({
      sql: `
        SELECT v.product_id, v.variant_number, v.image_path, p.category,
          vector_distance_cos(e.embedding, vector32(?)) AS photo_distance
          ${hintVector ? ', vector_distance_cos(e.embedding, vector32(?)) AS hint_distance' : ''}
        FROM photo_views e
        JOIN variants v ON v.id = e.variant_id AND v.image_path = e.image_path
        JOIN products p ON p.product_id = v.product_id
      `,
      args: hintVector ? [JSON.stringify(photoVector), JSON.stringify(hintVector)] : [JSON.stringify(photoVector)],
    })).rows;

    const hintLower = cleanHint.toLowerCase();
    const bestPerDesign = new Map();
    for (const row of rows) {
      let score = row.photo_distance;
      if (hintVector) score += HINT_WEIGHT * row.hint_distance;
      if (row.category && hintLower.includes(row.category.toLowerCase())) score -= CATEGORY_BONUS;
      const best = bestPerDesign.get(row.product_id);
      if (!best || score < best.score) bestPerDesign.set(row.product_id, { ...row, score });
    }

    return [...bestPerDesign.values()]
      .sort((a, b) => a.score - b.score)
      .slice(0, MATCH_COUNT)
      .map(({ product_id, variant_number, image_path, category }) => ({ product_id, variant_number, image_path, category }));
  }

  // suggested: the design numbers that were shown, best first
  async function recordFeedback({ productId, suggested, hint, photoPath }) {
    const rank = suggested.indexOf(productId) + 1;
    await db.execute({
      sql: 'INSERT INTO photo_match_feedback (product_id, rank, suggested, hint, photo_path) VALUES (?, ?, ?, ?, ?)',
      args: [productId, rank || null, JSON.stringify(suggested), hint || null, photoPath || null],
    });
  }

  return { init, indexPending, forgetVariants, status, findMatches, recordFeedback, isConfigured, QuotaError };
}

module.exports = { createPhotoMatcher };
