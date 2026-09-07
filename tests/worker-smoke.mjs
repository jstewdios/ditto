import { Worker } from 'node:worker_threads';
import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const asset = (await readdir('dist/assets')).find((name) => /^scan\.worker-.*\.js$/.test(name));
assert.ok(asset, 'Build the application before running the compiled-worker check.');
const fixture = JSON.parse(await readFile('tests/fixtures/study-01.json', 'utf8'));
const photos = fixture.entries.map((entry) => {
  const file = new File([Buffer.from(entry.base64, 'base64')], entry.path.split('/').pop(), { type: 'image/jpeg' });
  return { id: entry.path, path: entry.path, size: file.size, file };
});
const moduleUrl = pathToFileURL(`${process.cwd()}/dist/assets/${asset}`).href;
const source = `const { parentPort } = require('node:worker_threads'); global.self = global; self.postMessage = data => parentPort.postMessage(data); import(${JSON.stringify(moduleUrl)}).then(() => { parentPort.on('message', data => self.onmessage({data})); parentPort.postMessage({type: 'ready'}); });`;
const worker = new Worker(source, { eval: true, execArgv: [] });
let progressEvents = 0;
try {
  const outcome = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Compiled worker did not finish within 15 seconds.')), 15000);
    worker.on('error', (error) => { clearTimeout(timeout); reject(error); });
    worker.on('message', (data) => {
      if (data.type === 'ready') worker.postMessage({ photos });
      if (data.type === 'progress') progressEvents++;
      if (data.type === 'done') { clearTimeout(timeout); resolve(data); }
    });
  });
  assert.equal(outcome.records.length, 11);
  assert.deepEqual(outcome.errors, []);
  assert.equal(outcome.related.length, 4);
  assert.equal(outcome.related.filter((group) => group.hasConflicts).length, 2);
  assert.equal(outcome.related.filter((group) => group.timeOnly).length, 1);
  assert.deepEqual(outcome.coverage, { eligible: 10, missingTime: 1, unavailable: 0 });
  assert.ok(progressEvents > 0);
  assert.ok(outcome.related.every((group) => group.items.every((id) => outcome.records.some((item) => item.id === id))));
  console.log('Compiled worker passed: 11 files, 4 candidate groups, conflicts, coverage, progress, and file IDs.');
} finally {
  await worker.terminate();
}
