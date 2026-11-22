// Finds catalogue designs that look like a photo, e.g. of a returned saree.
// Every catalogue photo is turned into a Gemini embedding (a list of numbers
// describing what it looks like) and stored next to the variant; a search
// embeds the new photo the same way and ranks photos by how close they are.
const sharp = require('sharp');

const MODEL = 'gemini-embedding-2';
const DIMENSIONS = 768;
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:batchEmbedContents`;
const PHOTOS_PER_REQUEST = 6;
const MATCH_COUNT = 5;

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
const toJpeg = (buffer) =>
  sharp(buffer)
    .rotate()
    .resize(768, 768, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

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

function createPhotoMatcher(db) {
  let indexing = false;
  let pausedUntil = 0;

  const isConfigured = () => Boolean(process.env.GEMINI_API_KEY);

  async function init() {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS photo_embeddings (
        variant_id INTEGER PRIMARY KEY,
        image_path TEXT NOT NULL,
        indexed_day TEXT NOT NULL,
        embedding F32_BLOB(${DIMENSIONS}) NOT NULL
      )
    `);
  }

  async function forgetVariants(where, args) {
    await db.execute({ sql: `DELETE FROM photo_embeddings WHERE variant_id IN (SELECT id FROM variants WHERE ${where})`, args });
  }

  async function status() {
    const result = await db.execute(`
      SELECT
        (SELECT COUNT(*) FROM variants) AS total,
        (SELECT COUNT(*) FROM photo_embeddings e JOIN variants v
           ON v.id = e.variant_id AND v.image_path = e.image_path) AS indexed
    `);
    const { total, indexed } = result.rows[0];
    return { configured: isConfigured(), total: Number(total), indexed: Number(indexed) };
  }

  // Indexes photos that are new or were replaced since they were last indexed.
  // Safe to call often: only one run happens at a time, and it pauses itself
  // when the daily allowance is used up.
  async function indexPending() {
    if (!isConfigured() || indexing || Date.now() < pausedUntil) return;
    indexing = true;
    try {
      await db.execute('DELETE FROM photo_embeddings WHERE variant_id NOT IN (SELECT id FROM variants)');
      const pending = (await db.execute(`
        SELECT v.id, v.image_path FROM variants v
        LEFT JOIN photo_embeddings e ON e.variant_id = v.id
        WHERE e.image_path IS NULL OR e.image_path != v.image_path
        ORDER BY v.id DESC
      `)).rows;

      for (let i = 0; i < pending.length; i += PHOTOS_PER_REQUEST) {
        const today = pacificDay();
        const done = await db.execute({ sql: 'SELECT COUNT(*) AS n FROM photo_embeddings WHERE indexed_day = ?', args: [today] });
        if (Number(done.rows[0].n) >= DAILY_INDEX_LIMIT) throw new QuotaError('Daily indexing allowance used');

        const loaded = [];
        for (const v of pending.slice(i, i + PHOTOS_PER_REQUEST)) {
          try {
            loaded.push({ v, jpeg: await toJpeg(await download(v.image_path)) });
          } catch (err) {
            console.error(`Photo match: skipped variant ${v.id} (${err.message})`);
          }
        }
        if (loaded.length === 0) continue;

        const vectors = await embed(loaded.map(({ jpeg }) => [imagePart(jpeg)]));
        await db.batch(loaded.map(({ v }, k) => ({
          sql: `INSERT INTO photo_embeddings (variant_id, image_path, indexed_day, embedding)
                VALUES (?, ?, ?, vector32(?))
                ON CONFLICT (variant_id) DO UPDATE SET
                  image_path = excluded.image_path,
                  indexed_day = excluded.indexed_day,
                  embedding = excluded.embedding`,
          args: [v.id, v.image_path, today, JSON.stringify(vectors[k])],
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
    const jpeg = await toJpeg(photo);
    const cleanHint = String(hint || '').trim().slice(0, 200);
    const inputs = [[imagePart(jpeg)]];
    if (cleanHint) inputs.push([{ text: `task: search result | query: ${cleanHint}` }]);
    const [photoVector, hintVector] = await embed(inputs);

    const rows = (await db.execute({
      sql: `
        SELECT v.product_id, v.variant_number, v.image_path, p.category,
          vector_distance_cos(e.embedding, vector32(?)) AS photo_distance
          ${hintVector ? ', vector_distance_cos(e.embedding, vector32(?)) AS hint_distance' : ''}
        FROM photo_embeddings e
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

  return { init, indexPending, forgetVariants, status, findMatches, isConfigured, QuotaError };
}

module.exports = { createPhotoMatcher };
