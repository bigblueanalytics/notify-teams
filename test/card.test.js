'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPayload } = require('../src/card');
const { post } = require('../src/post');

const env = { GITHUB_SERVER_URL: 'https://github.com', GITHUB_REPOSITORY: 'org/repo', GITHUB_RUN_ID: '42' };
const cardOf = (payload) => payload.attachments[0].content;

test('wraps the card in the Workflows message envelope', () => {
  const payload = buildPayload({ title: 'Deploy' }, env);
  assert.equal(payload.type, 'message');
  assert.equal(payload.attachments[0].contentType, 'application/vnd.microsoft.card.adaptive');
  assert.equal(cardOf(payload).type, 'AdaptiveCard');
});

test('status sets icon and header style', () => {
  const header = (status) => cardOf(buildPayload({ title: 'Deploy', status }, env)).body[0];
  assert.equal(header('success').style, 'good');
  assert.match(header('success').items[0].text, /^✅ Deploy$/);
  assert.equal(header('failure').style, 'attention');
  assert.match(header('FAILURE').items[0].text, /^🚨/);
  assert.throws(() => header('exploded'), /status must be one of/);
});

test('facts become a FactSet and empty values are dropped', () => {
  const card = cardOf(buildPayload({ title: 'T', facts: 'Ref: tag v1.2.3\nURL: https://x/y:z\nReport:\n' }, env));
  assert.deepEqual(card.body.at(-1), {
    type: 'FactSet',
    facts: [
      { title: 'Ref', value: 'tag v1.2.3' },
      { title: 'URL', value: 'https://x/y:z' },
    ],
  });
});

test('links become buttons before View run, empty URLs are dropped', () => {
  const card = cardOf(buildPayload({ title: 'T', links: 'Trivy report | https://r\nNothing | ' }, env));
  assert.deepEqual(
    card.actions.map((a) => [a.title, a.url]),
    [
      ['Trivy report', 'https://r'],
      ['View run', 'https://github.com/org/repo/actions/runs/42'],
    ],
  );
});

test('run_link=false and no links leaves no actions', () => {
  assert.equal(cardOf(buildPayload({ title: 'T', runLink: false }, env)).actions, undefined);
});

test('malformed facts fail loudly', () => {
  assert.throws(() => buildPayload({ title: 'T', facts: 'no separator' }, env), /Key: value/);
});

test('post retries 429 and succeeds', async () => {
  const answers = [{ ok: false, status: 429, text: async () => 'slow down' }, { ok: true, status: 202 }];
  const status = await post('https://hook', {}, { fetchImpl: async () => answers.shift(), wait: async () => {} });
  assert.equal(status, 202);
});

test('post does not retry a 400 and never leaks the URL', async () => {
  let calls = 0;
  const fetchImpl = async () => (calls++, { ok: false, status: 400, text: async () => 'bad card' });
  await assert.rejects(post('https://hook?sig=SECRET', {}, { fetchImpl, wait: async () => {} }), (error) => {
    assert.match(error.message, /HTTP 400: bad card/);
    assert.doesNotMatch(error.message, /SECRET/);
    return true;
  });
  assert.equal(calls, 1);
});

test('post redacts the URL and sig when the error body echoes them', async () => {
  const url = 'https://x.powerplatform.com/invoke?api-version=1&sig=SECRET';
  const echo = `{"message":"The request URI ${url} does not match","other":"sig=OTHER&x"}`;
  const fetchImpl = async () => ({ ok: false, status: 404, text: async () => echo });
  await assert.rejects(post(url, {}, { fetchImpl, wait: async () => {} }), (error) => {
    assert.match(error.message, /<webhook_url>/);
    assert.doesNotMatch(error.message, /SECRET|OTHER/);
    return true;
  });
});
