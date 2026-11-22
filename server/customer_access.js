const crypto = require('crypto');

// Customers ask for access from the login page, then send the shop a WhatsApp
// message with a link staff use to approve them. Staff compare the number they
// typed with the number the message came from, which is the only check that
// the phone is really theirs. Each browser gets its own random token and only
// its hash is stored.

const STAY_LOGGED_IN_DAYS = 90;
// Spare the database a write on every request: last_seen only needs to be
// accurate enough to expire phones that stopped visiting.
const SEEN_REFRESH = '-1 hours';
const CHECK_CACHE_MS = 60 * 1000;
// Unapproved requests cost nothing to make, so cap how many can pile up.
const MAX_PENDING_CUSTOMERS = 300;
const MAX_PENDING_DEVICES = 5;

class AccessError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

// "098765 43210" or "+91 98765-43210" -> "919876543210". A bare 10-digit
// number is taken to be Indian, like the shop's WhatsApp links.
function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  return digits.length >= 11 && digits.length <= 15 ? digits : null;
}

const cleanName = (value) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, 60);

function createCustomerAccess(db) {
  // token hash -> { customer, at }. Cleared whenever staff change anyone's
  // access, so a block takes effect on the very next request.
  const checked = new Map();

  async function init() {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        approved_at DATETIME
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS customer_devices (
        token_hash TEXT PRIMARY KEY,
        customer_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.execute('CREATE INDEX IF NOT EXISTS idx_customer_devices_customer ON customer_devices (customer_id)');
  }

  const findByPhone = async (phone) =>
    (await db.execute({ sql: 'SELECT * FROM customers WHERE phone = ?', args: [phone] })).rows[0];

  // Returns { token, customer }. An approved number is let straight in, so a
  // customer on a new phone doesn't have to ask again.
  async function request({ name, phone }) {
    const customerName = cleanName(name);
    const number = normalizePhone(phone);
    if (!customerName) throw new AccessError(400, 'Please enter your name');
    if (!number) throw new AccessError(400, 'Please enter a valid phone number');

    let customer = await findByPhone(number);
    if (!customer) {
      const pending = await db.execute("SELECT COUNT(*) AS n FROM customers WHERE status = 'pending'");
      if (pending.rows[0].n >= MAX_PENDING_CUSTOMERS) {
        throw new AccessError(503, 'Too many requests are waiting. Please contact the shop directly.');
      }
      await db.execute({
        sql: 'INSERT INTO customers (phone, name) VALUES (?, ?) ON CONFLICT (phone) DO NOTHING',
        args: [number, customerName],
      });
      customer = await findByPhone(number);
    } else if (customer.status === 'pending' && customer.name !== customerName) {
      await db.execute({ sql: 'UPDATE customers SET name = ? WHERE id = ?', args: [customerName, customer.id] });
      customer = { ...customer, name: customerName };
    }
    if (customer.status === 'blocked') {
      throw new AccessError(403, "This number doesn't have access. Please contact the shop.");
    }

    const token = crypto.randomBytes(32).toString('base64url');
    const statements = [
      { sql: 'INSERT INTO customer_devices (token_hash, customer_id) VALUES (?, ?)', args: [hashToken(token), customer.id] },
      {
        sql: `DELETE FROM customer_devices WHERE last_seen < datetime('now', ?)`,
        args: [`-${STAY_LOGGED_IN_DAYS} days`],
      },
    ];
    if (customer.status === 'pending') {
      statements.push({
        sql: `DELETE FROM customer_devices WHERE customer_id = ? AND token_hash NOT IN (
                SELECT token_hash FROM customer_devices WHERE customer_id = ?
                ORDER BY created_at DESC, rowid DESC LIMIT ?)`,
        args: [customer.id, customer.id, MAX_PENDING_DEVICES],
      });
    }
    await db.batch(statements, 'write');
    return { token, customer: publicCustomer(customer) };
  }

  const publicCustomer = (row) => ({ id: row.id, name: row.name, phone: row.phone, status: row.status });

  // The customer behind a token, or null if it's unknown or has expired.
  async function check(token) {
    if (!token) return null;
    const hash = hashToken(token);
    const cached = checked.get(hash);
    if (cached && Date.now() - cached.at < CHECK_CACHE_MS) return cached.customer;

    const result = await db.execute({
      sql: `SELECT c.id, c.name, c.phone, c.status,
                   d.last_seen < datetime('now', ?) AS expired,
                   d.last_seen < datetime('now', ?) AS stale
            FROM customer_devices d JOIN customers c ON c.id = d.customer_id
            WHERE d.token_hash = ?`,
      args: [`-${STAY_LOGGED_IN_DAYS} days`, SEEN_REFRESH, hash],
    });
    const row = result.rows[0];
    const customer = row && !row.expired ? publicCustomer(row) : null;
    if (row && !row.expired && row.stale && row.status === 'approved') {
      await db.execute({ sql: 'UPDATE customer_devices SET last_seen = CURRENT_TIMESTAMP WHERE token_hash = ?', args: [hash] });
    }
    checked.set(hash, { customer, at: Date.now() });
    return customer;
  }

  async function logout(token) {
    if (!token) return;
    const hash = hashToken(token);
    checked.delete(hash);
    await db.execute({ sql: 'DELETE FROM customer_devices WHERE token_hash = ?', args: [hash] });
  }

  async function list() {
    const result = await db.execute({
      sql: `SELECT c.id, c.name, c.phone, c.status, c.created_at, c.approved_at,
                   COUNT(d.token_hash) AS devices, MAX(d.last_seen) AS last_seen
            FROM customers c
            LEFT JOIN customer_devices d ON d.customer_id = c.id AND d.last_seen >= datetime('now', ?)
            GROUP BY c.id
            ORDER BY CASE c.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
                     c.created_at DESC`,
      args: [`-${STAY_LOGGED_IN_DAYS} days`],
    });
    return result.rows;
  }

  // Staff adding someone by hand approves them up front; when that person
  // asks from the login page they get straight in.
  async function add({ name, phone }) {
    const customerName = cleanName(name);
    const number = normalizePhone(phone);
    if (!customerName) throw new AccessError(400, 'Please enter a name');
    if (!number) throw new AccessError(400, 'Please enter a valid phone number');
    await db.execute({
      sql: `INSERT INTO customers (phone, name, status, approved_at) VALUES (?, ?, 'approved', CURRENT_TIMESTAMP)
            ON CONFLICT (phone) DO UPDATE SET name = excluded.name, status = 'approved',
              approved_at = COALESCE(customers.approved_at, CURRENT_TIMESTAMP)`,
      args: [number, customerName],
    });
    checked.clear();
    return publicCustomer(await findByPhone(number));
  }

  // action: approve | reject | block | unblock
  async function update(id, action) {
    const customer = (await db.execute({ sql: 'SELECT * FROM customers WHERE id = ?', args: [id] })).rows[0];
    if (!customer) throw new AccessError(404, 'That request no longer exists');

    const removeDevices = { sql: 'DELETE FROM customer_devices WHERE customer_id = ?', args: [id] };
    if (action === 'approve' || action === 'unblock') {
      await db.execute({
        sql: "UPDATE customers SET status = 'approved', approved_at = COALESCE(approved_at, CURRENT_TIMESTAMP) WHERE id = ?",
        args: [id],
      });
    } else if (action === 'block') {
      await db.batch([{ sql: "UPDATE customers SET status = 'blocked' WHERE id = ?", args: [id] }, removeDevices], 'write');
    } else if (action === 'reject') {
      // Rejecting forgets the request, so someone who mistyped can ask again.
      if (customer.status !== 'pending') throw new AccessError(409, `${customer.name} was already ${customer.status}`);
      await db.batch([removeDevices, { sql: 'DELETE FROM customers WHERE id = ?', args: [id] }], 'write');
    } else {
      throw new AccessError(400, 'Unknown action');
    }
    checked.clear();
    return { ok: true };
  }

  return { init, request, check, logout, list, add, update, AccessError };
}

module.exports = { createCustomerAccess };
