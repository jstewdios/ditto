import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function parseAttentionLog(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',');
  const rows = lines.slice(1).map((line) => {
    const parts = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        parts.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    parts.push(current);
    
    return Object.fromEntries(headers.map((header, index) => [header, parts[index] || '']));
  });
  return { headers, rows };
}

test('attention log CSV has required headers per issue #6 spec', () => {
  const csvPath = join(process.cwd(), 'docs/studies/00-attention-log.csv');
  const csvText = readFileSync(csvPath, 'utf8');
  const { headers } = parseAttentionLog(csvText);
  assert.deepEqual(headers, ['at', 'actor', 'kind', 'minutes', 'note']);
});

test('attention log contains approval decision', () => {
  const csvPath = join(process.cwd(), 'docs/studies/00-attention-log.csv');
  const csvText = readFileSync(csvPath, 'utf8');
  const { rows } = parseAttentionLog(csvText);
  const approvalEvents = rows.filter((row) => row.kind === 'decision_made' && row.actor === 'human' && row.note.includes('Approval'));
  assert.ok(approvalEvents.length >= 1, 'Expected at least one approval decision_made event');
});

test('attention log event kinds are valid per issue #6 spec', () => {
  const csvPath = join(process.cwd(), 'docs/studies/00-attention-log.csv');
  const csvText = readFileSync(csvPath, 'utf8');
  const { rows } = parseAttentionLog(csvText);
  const validKinds = new Set(['decision_requested', 'decision_made', 'review_minutes', 'blocking_question', 'ci_run', 'guardrail_stop']);
  for (const row of rows) {
    assert.ok(validKinds.has(row.kind), `Invalid event kind: ${row.kind}`);
  }
});

test('attention log actors are valid per issue #6 spec', () => {
  const csvPath = join(process.cwd(), 'docs/studies/00-attention-log.csv');
  const csvText = readFileSync(csvPath, 'utf8');
  const { rows } = parseAttentionLog(csvText);
  const validActors = new Set(['agent', 'human']);
  for (const row of rows) {
    assert.ok(validActors.has(row.actor), `Invalid actor: ${row.actor}`);
  }
});
