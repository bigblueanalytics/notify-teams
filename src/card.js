'use strict';

// Teams rejects messages over 28 KB; keep the free-text body well under that.
const MAX_MESSAGE_CHARS = 12000;

const STATUSES = {
  success: { icon: '✅', style: 'good' },
  failure: { icon: '🚨', style: 'attention' },
  cancelled: { icon: '⚪', style: 'warning' },
  skipped: { icon: '⏭️', style: 'emphasis' },
  info: { icon: 'ℹ️', style: 'emphasis' },
};

function lines(text) {
  return (text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseFacts(text) {
  return lines(text)
    .map((line) => {
      const sep = line.indexOf(':');
      if (sep <= 0) throw new Error(`facts: expected "Key: value", got "${line}"`);
      return { title: line.slice(0, sep).trim(), value: line.slice(sep + 1).trim() };
    })
    .filter((fact) => fact.value !== '');
}

function parseLinks(text) {
  return lines(text)
    .map((line) => {
      const sep = line.indexOf('|');
      if (sep <= 0) throw new Error(`links: expected "Label | URL", got "${line}"`);
      return { title: line.slice(0, sep).trim(), url: line.slice(sep + 1).trim() };
    })
    .filter((link) => link.url !== '');
}

function runUrl(env) {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = env;
  if (!GITHUB_SERVER_URL || !GITHUB_REPOSITORY || !GITHUB_RUN_ID) return '';
  return `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
}

function truncate(text, max) {
  return text.length <= max ? text : `${text.slice(0, max)}\n\n…(truncated)`;
}

function buildPayload({ title, status = 'info', message = '', facts = '', links = '', runLink = true }, env = {}) {
  if (!title) throw new Error('title is required');
  const key = (status || 'info').trim().toLowerCase();
  const look = STATUSES[key];
  if (!look) throw new Error(`status must be one of ${Object.keys(STATUSES).join(', ')}; got "${status}"`);

  const body = [
    {
      type: 'Container',
      style: look.style,
      bleed: true,
      items: [{ type: 'TextBlock', text: `${look.icon} ${title}`, weight: 'Bolder', size: 'Medium', wrap: true }],
    },
  ];
  if (message.trim()) body.push({ type: 'TextBlock', text: truncate(message.trim(), MAX_MESSAGE_CHARS), wrap: true });
  const factList = parseFacts(facts);
  if (factList.length) body.push({ type: 'FactSet', facts: factList });

  const actions = parseLinks(links).map(({ title: label, url }) => ({ type: 'Action.OpenUrl', title: label, url }));
  const run = runLink ? runUrl(env) : '';
  if (run) actions.push({ type: 'Action.OpenUrl', title: 'View run', url: run });

  const card = {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.4',
    msteams: { width: 'Full' },
    body,
  };
  if (actions.length) card.actions = actions;

  return {
    type: 'message',
    attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', contentUrl: null, content: card }],
  };
}

module.exports = { buildPayload, STATUSES };
