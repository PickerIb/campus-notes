
'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

// Generate temporary credentials for this test run.
process.env.DB_PATH = ':memory:';
process.env.ADMIN_USERNAME = 'test-admin';
process.env.ADMIN_PASSWORD = crypto.randomBytes(32).toString('hex');
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');

const { createApp } = require('../src/server.js');

let server;
let base;
let cookie;

before(async () => {
  server = createApp().listen(0);

  await new Promise((resolve) => server.once('listening', resolve));

  base = `http://127.0.0.1:${server.address().port}`;

  const res = await fetch(`${base}/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      username: process.env.ADMIN_USERNAME,
      password: process.env.ADMIN_PASSWORD
    }),
    redirect: 'manual',
  });

  assert.strictEqual(res.status, 302);

  const setCookie = res.headers.get('set-cookie');

  assert.ok(setCookie, 'Login should return a session cookie');

  cookie = setCookie.split(';')[0];
});

after(() => {
  if (server) server.close();
});

test('a note title of 120 characters is accepted', async () => {
  const title = 'x'.repeat(120);

  const res = await fetch(`${base}/notes`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie
    },
    body: new URLSearchParams({
      title,
      body: 'ok'
    }),
    redirect: 'manual',
  });

  assert.strictEqual(res.status, 302);
});

test('a note title of 121 characters is rejected', async () => {
  const title = 'x'.repeat(121);

  const res = await fetch(`${base}/notes`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie
    },
    body: new URLSearchParams({
      title,
      body: 'ok'
    }),
    redirect: 'manual',
  });

  assert.strictEqual(res.status, 400);
});
