'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const {
  verifyPassword,
  hashPassword
} = require('./db.js');
const { loginPage } = require('./views.js');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters.');
}

const router = express.Router();

router.get('/login', (req, res) => {
  res.send(loginPage(null));
});

router.post('/login', (req, res) => {
  const { username = '', password = '' } = req.body || {};
  const db = req.app.locals.db;

  // Use parameterized SQL to prevent SQL injection.
  const row = db
    .prepare('SELECT * FROM users WHERE username = ?')
    .get(username);

  if (!row || !verifyPassword(password, row.password_hash)) {
    return res.status(401).send(
      loginPage('Incorrect username or password.')
    );
  }

  // Upgrade old MD5 hashes to scrypt after successful authentication.
  if (!row.password_hash.startsWith('scrypt$')) {
    db.prepare(
      'UPDATE users SET password_hash = ? WHERE id = ?'
    ).run(hashPassword(password), row.id);
  }

  const token = jwt.sign(
    { username: row.username, role: row.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.cookie('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  });

  res.redirect('/');
});

router.post('/logout', (req, res) => {
  res.clearCookie('session');
  res.redirect('/');
});

function currentUser(req) {
  const token = req.cookies && req.cookies.session;

  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

module.exports = { router, currentUser, JWT_SECRET };
