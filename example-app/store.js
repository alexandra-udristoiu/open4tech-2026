/**
 * Tiny JSON-file backed data store.
 *
 * Everything lives in a single file (data/db.json). Writes are serialized
 * through a promise chain so concurrent requests can't corrupt the file.
 * This is intentionally simple — perfect for a local course tool, and easy
 * to swap for a real database later since all access goes through this module.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const EMPTY_DB = { assignments: [], submissions: [] };

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(EMPTY_DB, null, 2));
  }
}

function readDB() {
  ensureFile();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    return { assignments: [], submissions: [], ...parsed };
  } catch (err) {
    console.error('Could not read db.json, starting fresh:', err.message);
    return { ...EMPTY_DB };
  }
}

// Serialize writes so overlapping requests don't clobber the file.
let writeChain = Promise.resolve();
function writeDB(db) {
  writeChain = writeChain.then(
    () =>
      new Promise((resolve, reject) => {
        ensureFile();
        fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), (err) =>
          err ? reject(err) : resolve()
        );
      })
  );
  return writeChain;
}

// Simple, sortable, collision-resistant id.
let counter = 0;
function makeId(prefix) {
  counter = (counter + 1) % 100000;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}

module.exports = { readDB, writeDB, makeId, DB_FILE };
