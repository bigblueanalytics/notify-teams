'use strict';

const RETRIES = 4;
const TIMEOUT_MS = 15000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Power Platform error bodies can echo the request URI, and the sig parameter in it is
// the webhook's credential.
function redact(text, url) {
  return text.split(url).join('<webhook_url>').replace(/sig=[^&\s"'\\]+/g, 'sig=***');
}

// Teams throttles a webhook above 4 requests/s (429) and Power Automate has transient 5xx;
// parallel deploy jobs can notify at the same moment, so back off and retry those.
async function post(url, payload, { fetchImpl = fetch, wait = sleep } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt > 0) await wait(1000 * 2 ** (attempt - 1));
    let response;
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      lastError = new Error(`request failed: ${redact(String(error.message), url)}`);
      continue;
    }
    if (response.ok) return response.status;
    const detail = redact(await response.text().catch(() => ''), url).slice(0, 500);
    lastError = new Error(`Teams webhook answered HTTP ${response.status}: ${detail}`);
    if (response.status !== 429 && response.status < 500) break;
  }
  throw lastError;
}

module.exports = { post };
