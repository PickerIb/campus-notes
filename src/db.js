'use strict';

const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DB_PATH = process.env.DB_PATH ||
  path.join(__dirname, '..', 'data', 'campus-notes.db');

// Legacy MD5 helper, retained only to migrate existing accounts.
function md5(text) {
  return crypto.createHash('md5').update(text).digest('hex');
}

// Create a salted password hash using scrypt.
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');

  return `scrypt$${salt}$${hash}`;
}

// Verify both new scrypt hashes and old MD5 hashes.
function verifyPassword(password, storedHash) {
  if (storedHash.startsWith('scrypt$')) {
    const [, salt, expectedHash] = storedHash.split('$');

    const actualHash = crypto.scryptSync(password, salt, 64);
    const expectedBuffer = Buffer.from(expectedHash, 'hex');

    return actualHash.length === expectedBuffer.length &&
      crypto.timingSafeEqual(actualHash, expectedBuffer);
  }

  // Temporary compatibility for existing MD5 accounts.
  const actualHash = Buffer.from(md5(password), 'hex');
  const expectedHash = Buffer.from(storedHash, 'hex');

  return actualHash.length === expectedHash.length &&
    crypto.timingSafeEqual(actualHash, expectedHash);
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'staff'
  );

  CREATE TABLE IF NOT EXISTS notes (
    id         INTEGER PRIMARY KEY,
    author     TEXT NOT NULL,
    title      TEXT NOT NULL,
    body       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

function open() {
  if (DB_PATH !== ':memory:') {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  }

  const db = new DatabaseSync(DB_PATH);
  db.exec(SCHEMA);
  seedIfEmpty(db);

  return db;
}

function seedIfEmpty(db) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();

  if (n > 0) return;

  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'ADMIN_USERNAME and ADMIN_PASSWORD must be configured before database initialization.'
    );
  }

  const insertUser = db.prepare(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
  );

  insertUser.run(username, hashPassword(password), 'admin');

  const notes = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '..', 'seed', 'notes.json'),
      'utf8'
    )
  );

  const insertNote = db.prepare(
    'INSERT INTO notes (author, title, body) VALUES (?, ?, ?)'
  );

  for (const note of notes) {
    insertNote.run(note.author, note.title, note.body);
  }
}

module.exports = {
  open,
  md5,
  hashPassword,
  verifyPassword,
  DB_PATH
};
