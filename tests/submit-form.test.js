import assert from 'node:assert/strict';
import test from 'node:test';
import { submitForm } from '../src/utils/submit-form.js';

const reference = 'DEV-01234567-89ab-4cde-8fab-0123456789ab';
const saved = { saved: true, reference, notificationStatus: 'accepted', message: 'Enregistrée.' };
const form = () => /** @type {HTMLFormElement} */ ({});

test('client accepts only a structured, recorded success', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json(saved));
  const result = await submitForm(form(), '/local/devis', { details: 'Test' });
  assert.equal(result.recorded, true);
  assert.equal(result.notified, true);
  assert.equal(fetchMock.mock.calls[0].arguments[0], '/local/devis');
});

test('client refuses HTML, invalid JSON and unconfirmed 200 responses', async (t) => {
  for (const response of [
    () => new Response('<html>Error</html>'),
    () => new Response('{'),
    () => Response.json(null),
    () => Response.json({ message: 'OK' }),
    () => Response.json({ ...saved, saved: false }),
    () => Response.json({ ...saved, reference: undefined }),
  ]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => response());
    await assert.rejects(() => submitForm(form(), '/local/devis', {}));
    mock.mock.restore();
  }
});

test('client preserves field errors and distinguishes saved requests with failed notification', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json({ errors: { email: 'Invalide' } }, { status: 400 }));
  const invalid = await submitForm(form(), '/local/devis', {});
  assert.equal(invalid.recorded, false);
  assert.equal(invalid.result.errors.email, 'Invalide');
  fetchMock.mock.mockImplementation(async () => Response.json({ ...saved, notificationStatus: 'failed' }, { status: 202 }));
  const stored = await submitForm(form(), '/local/devis', {});
  assert.equal(stored.recorded, true);
  assert.equal(stored.notified, false);
});

test('client retries a lost response with the same ID; changed contents get a new ID', async (t) => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    requests.push(JSON.parse(options.body));
    if (requests.length === 1) throw new TypeError('Network disconnected after server accepted');
    return Response.json(saved);
  });
  const currentForm = form();
  await assert.rejects(() => submitForm(currentForm, '/local/devis', { details: 'Same request' }));
  await submitForm(currentForm, '/local/devis', { details: 'Same request' });
  await submitForm(currentForm, '/local/devis', { details: 'New request' });
  assert.equal(requests[0].requestId, requests[1].requestId);
  assert.notEqual(requests[1].requestId, requests[2].requestId);
});
