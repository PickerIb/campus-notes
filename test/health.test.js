
'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

// Configure temporary test environment variables.
process.env.DB_PATH = ':memory:';
process.env.ADMIN_USERNAME = 'test-admin';
process.env.ADMIN_PASSWORD = crypto.randomBytes(32).toString('hex');
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');

const { createApp } = require('../src/server.js');

let server;
let base;

before(async () => {
  server = createApp().listen(0);

  await new Promise((resolve) => server.once('listening', resolve));

  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  if (server) server.close();
});

test('/health reports ok when the database answers', async () => {
  const res = await fetch(`${base}/health`);

  assert.strictEqual(res.status, 200);

  assert.deepStrictEqual(
    await res.json(),
    { status: 'ok' }
  );
});
