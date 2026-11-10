'use strict';

// No dependencies on purpose: the runner's Node 24 has fetch, so there is no dist/ to rebuild.
const { buildPayload } = require('./src/card');
const { post } = require('./src/post');

const input = (name) => (process.env[`INPUT_${name.toUpperCase()}`] || '').trim();

async function main() {
  const url = input('webhook_url');
  if (!url) throw new Error('webhook_url is empty: is the secret available to this repository?');
  const payload = buildPayload(
    {
      title: input('title'),
      status: input('status') || 'info',
      message: process.env.INPUT_MESSAGE || '',
      facts: input('facts'),
      links: input('links'),
      runLink: input('run_link') !== 'false',
    },
    process.env,
  );
  const status = await post(url, payload);
  console.log(`Posted to Teams (HTTP ${status}).`);
}

main().catch((error) => {
  console.log(`::error title=notify-teams::${error.message.replace(/\r?\n/g, ' ')}`);
  process.exitCode = 1;
});
