// Birthday site backend — plain Node.js, zero npm dependencies.
// Run with: node server.js
// Serves the frontend from /public and a tiny JSON-file database
// for the editable content + guestbook wall, so changes persist
// across visits and devices once this is deployed somewhere real.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DB_FILE = path.join(__dirname, 'data', 'db.json');

const DEFAULT_DB = {
  content: {
    name: 'Someone Wonderful',
    subhead: 'This is your party to plan — edit anything on the page.',
    message: 'Write your birthday message here. Talk about a memory, a wish, or just how much this person means to you.',
    footer: 'Made with love, one candle at a time.',
    targetDate: null,
    photos: []
  },
  guestbook: []
};

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2));
    return DEFAULT_DB;
  }
}

function writeDB(db) {
  // Write to a temp file then rename, so a crash mid-write can't corrupt the DB.
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function serveStatic(req, res) {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(PUBLIC_DIR, decodeURIComponent(filePath.split('?')[0]));
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function readBody(req, maxBytes, cb) {
  let body = [];
  let size = 0;
  let tooBig = false;
  req.on('data', chunk => {
    size += chunk.length;
    if (size > maxBytes) { tooBig = true; req.destroy(); return; }
    body.push(chunk);
  });
  req.on('end', () => {
    if (tooBig) return cb(new Error('Payload too large'));
    try {
      const parsed = body.length ? JSON.parse(Buffer.concat(body).toString('utf8')) : {};
      cb(null, parsed);
    } catch (e) {
      cb(e);
    }
  });
}

function sendJSON(res, status, obj) {
  const data = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(data);
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // ---- GET current content ----
  if (url === '/api/content' && req.method === 'GET') {
    const db = readDB();
    return sendJSON(res, 200, db.content);
  }

  // ---- SAVE content (name, message, dates, photos) ----
  if (url === '/api/content' && req.method === 'POST') {
    return readBody(req, 15 * 1024 * 1024, (err, incoming) => {
      if (err) return sendJSON(res, 400, { error: 'Bad request' });
      const db = readDB();
      db.content = {
        name: String(incoming.name ?? db.content.name).slice(0, 200),
        subhead: String(incoming.subhead ?? db.content.subhead).slice(0, 400),
        message: String(incoming.message ?? db.content.message).slice(0, 4000),
        footer: String(incoming.footer ?? db.content.footer).slice(0, 300),
        targetDate: incoming.targetDate ?? db.content.targetDate,
        photos: Array.isArray(incoming.photos) ? incoming.photos.slice(0, 12) : db.content.photos
      };
      writeDB(db);
      return sendJSON(res, 200, { ok: true });
    });
  }

  // ---- GET guestbook wall ----
  if (url === '/api/guestbook' && req.method === 'GET') {
    const db = readDB();
    return sendJSON(res, 200, db.guestbook);
  }

  // ---- POST a new guestbook message ----
  if (url === '/api/guestbook' && req.method === 'POST') {
    return readBody(req, 20 * 1024, (err, incoming) => {
      if (err) return sendJSON(res, 400, { error: 'Bad request' });
      const name = String(incoming.name || 'Anonymous').slice(0, 60);
      const message = String(incoming.message || '').trim().slice(0, 500);
      if (!message) return sendJSON(res, 400, { error: 'Message required' });
      const db = readDB();
      const entry = {
        id: crypto.randomUUID(),
        name,
        message,
        createdAt: new Date().toISOString()
      };
      db.guestbook.unshift(entry);
      db.guestbook = db.guestbook.slice(0, 200); // cap so the file doesn't grow forever
      writeDB(db);
      return sendJSON(res, 201, entry);
    });
  }

  // ---- DELETE a guestbook message (moderation) ----
  if (url.startsWith('/api/guestbook/') && req.method === 'DELETE') {
    const id = url.split('/').pop();
    const db = readDB();
    db.guestbook = db.guestbook.filter(e => e.id !== id);
    writeDB(db);
    return sendJSON(res, 200, { ok: true });
  }

  // ---- everything else: static files ----
  return serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Birthday site running at http://localhost:${PORT}`);
});
