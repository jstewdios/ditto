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

test('attention log CSV has required headers', () => {
  const csvPath = join(process.cwd(), 'docs/studies/00-attention-log.csv');
  const csvText = readFileSync(csvPath, 'utf8');
  const { headers } = parseAttentionLog(csvText);
  assert.deepEqual(headers, ['timestamp', 'actor', 'kind', 'elapsed_minutes', 'cumulative_minutes', 'note']);
});

test('attention log contains approval event', () => {
  const csvPath = join(process.cwd(), 'docs/studies/00-attention-log.csv');
  const csvText = readFileSync(csvPath, 'utf8');
  const { rows } = parseAttentionLog(csvText);
  const approvalEvents = rows.filter((row) => row.kind === 'decision_made' && row.actor === 'human' && row.note.includes('Approval'));
  assert.ok(approvalEvents.length >= 1, 'Expected at least one approval decision_made event');
});

test('attention log timestamps are chronologically ordered', () => {
  const csvPath = join(process.cwd(), 'docs/studies/00-attention-log.csv');
  const csvText = readFileSync(csvPath, 'utf8');
  const { rows } = parseAttentionLog(csvText);
  const timestamps = rows.map((row) => new Date(row.timestamp).getTime());
  for (let i = 1; i < timestamps.length; i++) {
    assert.ok(timestamps[i] >= timestamps[i - 1], `Timestamp at row ${i + 1} is before row ${i}`);
  }
});

test('attention log cumulative minutes are non-decreasing', () => {
  const csvPath = join(process.cwd(), 'docs/studies/00-attention-log.csv');
  const csvText = readFileSync(csvPath, 'utf8');
  const { rows } = parseAttentionLog(csvText);
  const cumulative = rows.map((row) => parseFloat(row.cumulative_minutes));
  for (let i = 1; i < cumulative.length; i++) {
    assert.ok(cumulative[i] >= cumulative[i - 1], `Cumulative minutes at row ${i + 1} decreased`);
  }
});

test('attention log event kinds are valid', () => {
  const csvPath = join(process.cwd(), 'docs/studies/00-attention-log.csv');
  const csvText = readFileSync(csvPath, 'utf8');
  const { rows } = parseAttentionLog(csvText);
  const validKinds = new Set(['decision_made', 'blocking_question', 'ci_run', 'guardrail_stop', 'review_request']);
  for (const row of rows) {
    assert.ok(validKinds.has(row.kind), `Invalid event kind: ${row.kind}`);
  }
});

test('attention log actors are valid', () => {
  const csvPath = join(process.cwd(), 'docs/studies/00-attention-log.csv');
  const csvText = readFileSync(csvPath, 'utf8');
  const { rows } = parseAttentionLog(csvText);
  const validActors = new Set(['human', 'ai']);
  for (const row of rows) {
    assert.ok(validActors.has(row.actor), `Invalid actor: ${row.actor}`);
  }
});

test('first attention log event starts at cumulative minute 0', () => {
  const csvPath = join(process.cwd(), 'docs/studies/00-attention-log.csv');
  const csvText = readFileSync(csvPath, 'utf8');
  const { rows } = parseAttentionLog(csvText);
  assert.ok(rows.length > 0, 'Expected at least one row in attention log');
  assert.equal(parseFloat(rows[0].cumulative_minutes), 0, 'First event should have cumulative_minutes of 0');
});
