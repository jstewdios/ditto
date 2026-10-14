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

// Study 04 regression: non-photos must neither populate nor consume photo metadata cache.
// Test both scan orders: bin before jpg and jpg before bin.
const study02 = JSON.parse(await readFile('tests/fixtures/study-02.json', 'utf8'));
const moment1Entry = study02.entries.find((entry) => entry.path === '01-burst-a/moment-1.jpg');
const moment2Entry = study02.entries.find((entry) => entry.path === '01-burst-a/moment-2.jpg');
assert.ok(moment1Entry && moment2Entry, 'Study 02 must include moment-1.jpg and moment-2.jpg');
const moment1Bytes = Buffer.from(moment1Entry.base64, 'base64');
const moment2Bytes = Buffer.from(moment2Entry.base64, 'base64');

for (const order of ['bin-first', 'jpg-first']) {
  const files = [
    { id: 'moment-1.jpg', path: 'moment-1.jpg', file: new File([moment1Bytes], 'moment-1.jpg', { type: 'image/jpeg' }), size: moment1Bytes.length, isPhoto: true },
    { id: 'moment-1.bin', path: 'moment-1.bin', file: new File([moment1Bytes], 'moment-1.bin', { type: 'application/octet-stream' }), size: moment1Bytes.length, isPhoto: false },
    { id: 'moment-2.jpg', path: 'moment-2.jpg', file: new File([moment2Bytes], 'moment-2.jpg', { type: 'image/jpeg' }), size: moment2Bytes.length, isPhoto: true },
  ];
  const photos = order === 'bin-first' ? [files[1], files[0], files[2]] : files;
  const moduleUrl = pathToFileURL(`${process.cwd()}/dist/assets/${asset}`).href;
  const source = `const { parentPort } = require('node:worker_threads'); global.self = global; self.postMessage = data => parentPort.postMessage(data); import(${JSON.stringify(moduleUrl)}).then(() => { parentPort.on('message', data => self.onmessage({data})); parentPort.postMessage({type: 'ready'}); });`;
  const worker = new Worker(source, { eval: true, execArgv: [] });
  try {
    const outcome = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Compiled worker did not finish within 15 seconds.')), 15000);
      worker.on('error', (error) => { clearTimeout(timeout); reject(error); });
      worker.on('message', (data) => {
        if (data.type === 'ready') worker.postMessage({ photos });
        if (data.type === 'done') { clearTimeout(timeout); resolve(data); }
      });
    });
    // All files hashed
    assert.equal(outcome.records.length, 3, `${order}: all files should be hashed`);
    assert.deepEqual(outcome.errors, [], `${order}: no errors expected`);
    
    // Both JPEGs keep capture metadata
    const jpg1 = outcome.records.find((r) => r.id === 'moment-1.jpg');
    const bin = outcome.records.find((r) => r.id === 'moment-1.bin');
    const jpg2 = outcome.records.find((r) => r.id === 'moment-2.jpg');
    assert.ok(jpg1 && bin && jpg2, `${order}: all records present`);
    assert.ok(jpg1.capture !== null && jpg1.capture.status === 'read', `${order}: moment-1.jpg must have capture metadata`);
    assert.ok(jpg2.capture !== null && jpg2.capture.status === 'read', `${order}: moment-2.jpg must have capture metadata`);
    
    // Bin capture stays null
    assert.strictEqual(bin.capture, null, `${order}: moment-1.bin must have null capture`);
    
    // Original and bin are exact copies
    assert.equal(jpg1.hash, bin.hash, `${order}: moment-1.jpg and moment-1.bin must have identical hashes`);
    assert.notEqual(jpg1.hash, jpg2.hash, `${order}: moment-1.jpg and moment-2.jpg must have different hashes`);
    
    // Related/burst memberships contain only the two JPEGs
    const burstWithMoments = outcome.bursts.find((group) => 
      group.items.includes('moment-1.jpg') || group.items.includes('moment-2.jpg')
    );
    if (burstWithMoments) {
      assert.ok(!burstWithMoments.items.includes('moment-1.bin'), `${order}: burst group must not include .bin file`);
      assert.ok(burstWithMoments.items.every((id) => id.endsWith('.jpg')), `${order}: burst group must contain only JPEGs`);
    }
    
    console.log(`Compiled worker passed Study 04 regression (${order}): non-photos neither populate nor consume photo metadata cache.`);
  } finally {
    await worker.terminate();
  }
}
