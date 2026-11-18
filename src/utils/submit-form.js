/**
 * @typedef {{ saved?: boolean, reference?: string,
 * notificationStatus?: 'pending' | 'accepted' | 'failed', message?: string,
 * errors?: Record<string, string> }} SubmissionResult
 */

// Keep the same key when retrying an unchanged form after a lost response.
/** @type {WeakMap<HTMLFormElement, { payload: string, requestId: string }>} */
const submissions = new WeakMap();

/** @param {HTMLFormElement} form @param {string} endpoint @param {Record<string, string>} payload */
export async function submitForm(form, endpoint, payload) {
  const serialized = JSON.stringify(payload);
  let submission = submissions.get(form);
  if (!submission || submission.payload !== serialized) {
    submission = { payload: serialized, requestId: crypto.randomUUID() };
    submissions.set(form, submission);
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, requestId: submission.requestId }),
    signal: AbortSignal.timeout(30000),
  });
  /** @type {SubmissionResult} */
  const result = await response.json();
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Invalid response');
  const recorded = response.ok && result.saved === true &&
    typeof result.reference === 'string' && /^(DEV|CON)-[\da-f-]{36}$/.test(result.reference) &&
    ['accepted', 'pending', 'failed'].includes(result.notificationStatus || '');
  // Redirects, HTML error pages or unrelated 200 responses must never clear the form.
  if (response.ok && !recorded) throw new Error('Unconfirmed submission');
  return { result, recorded, notified: recorded && result.notificationStatus === 'accepted' };
}
