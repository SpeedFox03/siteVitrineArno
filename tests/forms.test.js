import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import test from 'node:test';
import { BlobsServer } from '@netlify/blobs/server';
import { setEnvironmentContext } from '@netlify/blobs';
import nodemailer from 'nodemailer';
import { createFormHandler, openSubmissionStore } from '../netlify/lib/form-handler.js';
import devis from '../netlify/functions/devis.js';
import contact from '../netlify/functions/contact.js';

const config = {
  SMTP_HOST: 'smtp.example.test', SMTP_PORT: '587', SMTP_USER: 'site@example.test',
  SMTP_PASS: 'local-test-password', DEVIS_TO_EMAIL: 'arno@example.test',
};
const privateQuote = {
  formType: 'prive', prenom: 'Test', nom: 'Particulier', email: 'prospect@example.test',
  adresse: 'Ciney', intitule: 'TEST LOCAL — devis', details: 'Message de test local uniquement.', website: '',
};
const proQuote = { ...privateQuote, formType: 'pro', societe: 'Entreprise test', tva: 'BE0123.456.789' };
const contactMessage = { nom: 'Test contact', email: 'prospect@example.test', message: 'Message local.', website: '' };
const event = (body) => ({ httpMethod: 'POST', body: JSON.stringify(body), headers: {} });
const parse = (response) => JSON.parse(response.body);

function harness(kind = 'devis', overrides = {}) {
  const records = new Map();
  const mails = [];
  const logs = [];
  const store = {
    async setJSON(key, value, options) {
      if (options?.onlyIfNew && records.has(key)) return { modified: false };
      records.set(key, structuredClone(value));
      return { modified: true };
    },
    async get(key) { return structuredClone(records.get(key)); },
  };
  const handler = createFormHandler(kind, {
    env: { ...config }, openStore: () => store,
    createTransport: () => ({
      async sendMail(mail) {
        mails.push(mail);
        return { accepted: ['arno@example.test'], messageId: '<local@example.test>' };
      },
      close() {},
    }),
    log: { info: (...args) => logs.push(args), error: (...args) => logs.push(args) },
    ...overrides,
  });
  return { handler, records, mails, logs, store };
}

test('real endpoints reject GET and malformed JSON without accessing SMTP/storage', async () => {
  for (const handler of [devis, contact]) {
    assert.equal((await handler(new Request('http://localhost/test'))).status, 405);
    for (const body of ['null', '[]', '"text"', '{', '{"nom":{}}']) {
      assert.equal((await handler(new Request('http://localhost/test', { method: 'POST', body }))).status, 400);
    }
  }
});

for (const [kind, payload, label] of [
  ['devis', privateQuote, 'private quote'], ['devis', proQuote, 'professional quote'], ['contact', contactMessage, 'contact'],
]) {
  test(`${label}: save before SMTP, share reference in response, record and e-mail`, async () => {
    const h = harness(kind);
    const response = await h.handler(event(payload));
    const result = parse(response);
    assert.equal(response.statusCode, 200);
    assert.equal(result.saved, true);
    assert.equal(result.notificationStatus, 'accepted');
    assert.match(result.reference, /^(DEV|CON)-[\da-f-]{36}$/);
    const record = h.records.get(result.reference);
    assert.equal(record.fields.email, payload.email);
    assert.equal(record.notification.messageId, '<local@example.test>');
    for (const format of ['subject', 'text', 'html']) assert.ok(h.mails[0][format].includes(result.reference));
    assert.equal(h.mails[0].replyTo, payload.email);
    assert.equal(h.logs[0][0], `[${kind}] saved`);
    const logText = JSON.stringify(h.logs);
    assert.ok(!logText.includes(payload.email));
    assert.ok(!logText.includes(config.SMTP_PASS));
  });
}

test('invalid/oversized fields, e-mail and VAT return field errors without saving or sending', async () => {
  const h = harness();
  for (const [payload, field] of [
    [{ ...privateQuote, email: 'bad-email' }, 'email'],
    [{ ...privateQuote, email: 'valid@example.test\r\nBcc: other@example.test' }, 'email'],
    [{ ...privateQuote, details: '' }, 'details'],
    [{ ...privateQuote, details: 'x'.repeat(4001) }, 'details'],
    [{ ...proQuote, tva: 'invalid' }, 'tva'],
  ]) {
    const response = await h.handler(event(payload));
    assert.equal(response.statusCode, 400);
    assert.ok(parse(response).errors[field]);
  }
  assert.equal((await h.handler(event({ ...privateQuote, requestId: '../unsafe' }))).statusCode, 400);
  assert.equal((await h.handler(event({ ...privateQuote, details: 'x'.repeat(24001) }))).statusCode, 413);
  assert.equal(h.records.size, 0);
  assert.equal(h.mails.length, 0);
});

test('honeypot does not persist personal data or send mail', async () => {
  const h = harness();
  assert.equal((await h.handler(event({ ...privateQuote, website: 'spam' }))).statusCode, 200);
  assert.equal(h.records.size, 0);
  assert.equal(h.mails.length, 0);
});

test('storage failure returns 503 and must not send an unrecorded request', async () => {
  const h = harness('devis', { openStore() { throw new Error('Storage unavailable'); } });
  const response = await h.handler(event(privateQuote));
  assert.equal(response.statusCode, 503);
  assert.equal(parse(response).saved, false);
  assert.equal(h.mails.length, 0);
});

test('missing SMTP configuration preserves the request with a failed notification', async () => {
  const h = harness('devis', { env: {} });
  const response = await h.handler(event(privateQuote));
  const result = parse(response);
  assert.equal(response.statusCode, 202);
  assert.equal(result.saved, true);
  assert.equal(result.notificationStatus, 'failed');
  assert.equal(h.records.get(result.reference).notification.code, 'SMTP_CONFIG');
  assert.equal(h.mails.length, 0);
});

for (const code of ['EAUTH', 'ETIMEDOUT', 'ECONNECTION', 'ERECIPIENT']) {
  test(`SMTP ${code}: saved request and useful reference survive the failure`, async () => {
    const h = harness('devis', {
      createTransport: () => ({
        async sendMail() { throw Object.assign(new Error('secret SMTP response'), { code, response: config.SMTP_PASS }); },
        close() {},
      }),
    });
    const response = await h.handler(event(proQuote));
    const result = parse(response);
    assert.equal(response.statusCode, 202);
    assert.equal(h.records.get(result.reference).notification.code, code);
    assert.ok(!JSON.stringify(h.logs).includes('secret SMTP response'));
    assert.ok(!JSON.stringify(h.logs).includes(config.SMTP_PASS));
  });
}

test('unaccepted recipient is not reported as an accepted notification', async () => {
  const h = harness('contact', { createTransport: () => ({
    async sendMail() { return { accepted: [], rejected: ['arno@example.test'] }; }, close() {},
  }) });
  const result = parse(await h.handler(event(contactMessage)));
  assert.equal(result.notificationStatus, 'failed');
  assert.equal(h.records.get(result.reference).notification.code, 'ERECIPIENT');
});

test('simultaneous retries with the same ID produce one stored request and one e-mail', async () => {
  const h = harness();
  const payload = { ...privateQuote, requestId: randomUUID() };
  const responses = await Promise.all([h.handler(event(payload)), h.handler(event(payload)), h.handler(event(payload))]);
  const reference = parse(responses[0]).reference;
  assert.ok(responses.every((response) => parse(response).reference === reference));
  assert.equal(h.records.size, 1);
  assert.equal(h.mails.length, 1);
  assert.equal(parse(await h.handler(event(payload))).notificationStatus, 'accepted');
  assert.equal((await h.handler(event({ ...payload, details: 'Different request' }))).statusCode, 409);
  assert.equal(h.mails.length, 1);
});

test('failed final status write preserves the original saved request and logs the outcome', async () => {
  const h = harness();
  const original = h.store.setJSON;
  h.store.setJSON = async (key, value, options) => {
    if (!options?.onlyIfNew) throw new Error('Storage update unavailable');
    return original(key, value, options);
  };
  const result = parse(await h.handler(event(privateQuote)));
  assert.equal(result.notificationStatus, 'accepted');
  assert.equal(h.records.get(result.reference).notification.status, 'pending');
  assert.ok(h.logs.some(([name]) => name.includes('notification_status_save_failed')));
});

test('HTML content is escaped and contact uses its own recipient', async () => {
  const h = harness('contact', {
    env: { ...config, CONTACT_TO_EMAIL: 'arno@example.test', DEVIS_TO_EMAIL: 'other@example.test' },
  });
  await h.handler(event({ ...contactMessage, message: '<script>alert("test")</script>' }));
  assert.equal(h.mails[0].to, 'arno@example.test');
  assert.ok(!h.mails[0].html.includes('<script>'));
  assert.ok(h.mails[0].html.includes('&lt;script&gt;'));
});

test('actual Netlify Blobs SDK saves, retrieves and deduplicates through the native runtime context', async (t) => {
  const prefix = join(resolve(tmpdir()), 'momentdart-form-tests-');
  const directory = await mkdtemp(prefix);
  const server = new BlobsServer({ directory, token: 'local-only-token', logger() {} });
  const previousContext = process.env.NETLIFY_BLOBS_CONTEXT;
  t.after(async () => {
    if (previousContext === undefined) delete process.env.NETLIFY_BLOBS_CONTEXT;
    else process.env.NETLIFY_BLOBS_CONTEXT = previousContext;
    await server.stop();
    if (!resolve(directory).startsWith(prefix) || !resolve(directory).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unsafe cleanup path');
    await rm(directory, { recursive: true, force: true });
  });
  const { address } = await server.start();
  setEnvironmentContext({ edgeURL: address, uncachedEdgeURL: address, siteID: 'local-test-site', token: 'local-only-token' });
  const requestEvent = event({ ...privateQuote, requestId: randomUUID() });
  const h = harness('devis', { openStore: () => openSubmissionStore({ CONTEXT: 'dev' }) });
  const first = parse(await h.handler(requestEvent));
  assert.equal(first.notificationStatus, 'accepted');
  const record = await openSubmissionStore({ CONTEXT: 'dev' }).get(first.reference, { type: 'json' });
  assert.equal(record.fields.email, privateQuote.email);
  assert.equal(record.notification.status, 'accepted');
  const retry = parse(await h.handler(requestEvent));
  assert.equal(retry.reference, first.reference);
  assert.equal(retry.notificationStatus, 'accepted');
  assert.equal(h.mails.length, 1);
});

test('actual Nodemailer exchange with local SMTP receives all three forms and their references', async (t) => {
  const received = [];
  const sockets = new Set();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.write('220 localhost SMTP test\r\n');
    let buffer = '';
    let inData = false;
    let message = '';
    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      let end;
      while ((end = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (inData) {
          if (line === '.') {
            received.push(message); message = ''; inData = false;
            socket.write('250 Message accepted\r\n');
          } else message += line + '\r\n';
        } else if (/^EHLO/i.test(line)) socket.write('250-localhost\r\n250 AUTH PLAIN LOGIN\r\n');
        else if (/^AUTH|^MAIL|^RCPT/i.test(line)) socket.write('250 OK\r\n');
        else if (/^DATA/i.test(line)) { inData = true; socket.write('354 End with dot\r\n'); }
        else if (/^QUIT/i.test(line)) socket.end('221 Bye\r\n');
        else socket.write('250 OK\r\n');
      }
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { for (const socket of sockets) socket.destroy(); await new Promise((resolve) => server.close(resolve)); });
  for (const [kind, payload] of [['devis', privateQuote], ['devis', proQuote], ['contact', contactMessage]]) {
    const h = harness(kind, {
      env: { ...config, SMTP_HOST: '127.0.0.1', SMTP_PORT: String(server.address().port) },
      createTransport: (options) => nodemailer.createTransport(options),
    });
    const response = await h.handler(event(payload));
    const result = parse(response);
    assert.equal(response.statusCode, 200);
    assert.equal(result.notificationStatus, 'accepted');
    assert.ok(received.at(-1).includes(`X-Momentdart-Reference: ${result.reference}`));
  }
  assert.equal(received.length, 3);
});
