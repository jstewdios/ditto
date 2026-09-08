import { Worker } from 'node:worker_threads';
import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const asset = (await readdir('dist/assets')).find((name) => /^scan\.worker-.*\.js$/.test(name));
assert.ok(asset, 'Build the application before running the compiled-worker check.');
for (const study of ['01', '02']) {
  const fixture = JSON.parse(await readFile(`tests/fixtures/study-${study}.json`, 'utf8'));
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
    assert.equal(outcome.records.length, study === '01' ? 11 : 12);
    assert.deepEqual(outcome.errors, []);
    if (study === '01') {
      assert.deepEqual(outcome.bursts, []);
      assert.equal(outcome.related.length, 4);
      assert.equal(outcome.related.filter((group) => group.hasConflicts).length, 2);
      assert.equal(outcome.related.filter((group) => group.timeOnly).length, 1);
      assert.deepEqual(outcome.coverage, { eligible: 10, missingTime: 1, unavailable: 0 });
    } else {
      assert.deepEqual(outcome.bursts.map((group) => [group.items.length, group.distinctContents]), [[5, 4], [2, 2]]);
      assert.deepEqual(outcome.burstCoverage, { identified: 8, absent: 2, unsupported: 1, invalid: 1, unavailable: 0 });
      assert.ok(outcome.bursts.every((group) => group.items.every((id) => outcome.records.some((item) => item.id === id))));
      assert.equal(outcome.records.find((item) => item.id.endsWith('moment-3-no-time.jpg')).capture.time, null);
    }
    assert.ok(progressEvents > 0);
    assert.ok(outcome.related.every((group) => group.items.every((id) => outcome.records.some((item) => item.id === id))));
    console.log(`Compiled worker passed Study ${study}: counts, grouping, coverage, progress, and file IDs.`);
  } finally {
    await worker.terminate();
  }
}
