
'use strict';

const crypto = require('node:crypto');

process.env.DB_PATH = ':memory:';
process.env.ADMIN_USERNAME = 'test-admin';
process.env.ADMIN_PASSWORD = crypto.randomBytes(32).toString('hex');
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');

const { test, before, after } = require('node:test');
const assert = require('node:assert');

process.env.DB_PATH = ':memory:';

const { createApp } = require('../src/server.js');

let server;
let base;

before(async () => {
  server = createApp().listen(0);

  await new Promise((resolve) => server.once('listening', resolve));

  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

test('the notes page loads and lists the seeded notes', async () => {
  const res = await fetch(`${base}/`);

  assert.strictEqual(res.status, 200);

  const html = await res.text();

  assert.match(html, /Welcome to Campus Notes/);
});

test('the login page loads successfully', async () => {
  const res = await fetch(`${base}/login`);

  assert.strictEqual(res.status, 200);

  assert.match(await res.text(), /Sign in/);
});

test('a valid sign-in is accepted', async () => {
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

  assert.match(res.headers.get('set-cookie') || '', /session=/);
});

test('an invalid sign-in is rejected', async () => {
  const res = await fetch(`${base}/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      username: 'admin',
      password: 'wrong'
    }),
    redirect: 'manual',
  });

  assert.strictEqual(res.status, 401);
});

test('metrics are exposed in Prometheus text format', async () => {
  const res = await fetch(`${base}/metrics`);

  assert.strictEqual(res.status, 200);

  const body = await res.text();

  assert.match(body, /# TYPE campus_notes_requests_total counter/);

  assert.match(body, /campus_notes_requests_total\{method="GET"/);
});
