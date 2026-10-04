import test from 'node:test';
import assert from 'node:assert/strict';
import { groupDuplicates } from '../src/core.mjs';
import { archiveCheck, createArchiveReport } from '../src/archive.mjs';

const file = (fields) => ({ folderName: fields.folderId, name: fields.path.split('/').pop(), error: undefined, ...fields });

test('Incoming files already in Archive count once per file, with Incoming bytes and every Archive path', () => {
  const archiveA = file({ id: 'a1', folderId: 'keep', path: 'Keep/b.jpg', size: 10, hash: 'same' });
  const archiveB = file({ id: 'a2', folderId: 'vault', path: 'Vault/copy.jpg', size: 10, hash: 'same' });
  const incomingA = file({ id: 'i1', folderId: 'card', path: 'Card/new.jpg', size: 10, hash: 'same' });
  const incomingB = file({ id: 'i2', folderId: 'card', path: 'Card/again.jpg', size: 10, hash: 'same' });
  const other = file({ id: 'i3', folderId: 'card', path: 'Card/only.jpg', size: 4, hash: 'new' });
  const check = archiveCheck([archiveB, other, incomingB, archiveA, incomingA], { keep: 'archive', vault: 'archive', card: 'incoming' });
  assert.equal(check.alreadyCount, 2);
  assert.equal(check.duplicatedBytes, 20);
  assert.equal(check.uniqueCount, 1);
  assert.equal(check.archiveChecked, 2);
  assert.equal(check.incomingChecked, 3);
  assert.deepEqual(check.groups[0].archive.map((item) => item.path), ['Keep/b.jpg', 'Vault/copy.jpg']);
  assert.deepEqual(check.groups[0].incoming.map((item) => item.id), ['i2', 'i1']);
  assert.deepEqual(check.unique.map((item) => item.id), ['i3']);
  assert.equal(groupDuplicates([archiveA, archiveB, incomingA, incomingB]).reduce((sum, group) => sum + group.extraBytes, 0), 30);
});

test('same hash with a different size is not an Archive match, and same-name different bytes stay unique', () => {
  const check = archiveCheck([
    file({ id: 'a', folderId: 'keep', path: 'Keep/photo.jpg', size: 10, hash: 'aaa' }),
    file({ id: 'i', folderId: 'card', path: 'Card/photo.jpg', size: 11, hash: 'aaa' }),
    file({ id: 'j', folderId: 'card', path: 'Card/photo.jpg', size: 10, hash: 'bbb' }),
  ], { keep: 'archive', card: 'incoming' });
  assert.equal(check.alreadyCount, 0);
  assert.equal(check.duplicatedBytes, 0);
  assert.deepEqual(check.unique.map((item) => item.id), ['i', 'j']);
});

test('copies that exist only in Incoming or only in Archive do not answer the Archive question', () => {
  const incomingPair = [
    file({ id: 'i1', folderId: 'card', path: 'Card/one.jpg', size: 8, hash: 'pair' }),
    file({ id: 'i2', folderId: 'card', path: 'Card/two.jpg', size: 8, hash: 'pair' }),
  ];
  const archivePair = [
    file({ id: 'a1', folderId: 'keep', path: 'Keep/one.jpg', size: 8, hash: 'pair' }),
    file({ id: 'a2', folderId: 'keep', path: 'Keep/two.jpg', size: 8, hash: 'pair' }),
  ];
  const incomingOnly = archiveCheck(incomingPair, { card: 'incoming' });
  assert.equal(incomingOnly.archiveChecked, 0);
  assert.equal(incomingOnly.uniqueCount, 0);
  assert.equal(incomingOnly.alreadyCount, 0);
  assert.equal(groupDuplicates(incomingPair).length, 1);
  const archiveOnly = archiveCheck(archivePair, { keep: 'archive' });
  assert.equal(archiveOnly.incomingChecked, 0);
  assert.deepEqual(archiveOnly.groups, []);
  assert.equal(createArchiveReport(incomingOnly).trim().split('\n').length, 1);
});

test('unreadable and empty files are excluded, and uniqueness is withheld when Archive cannot be checked', () => {
  const incoming = file({ id: 'i', folderId: 'card', path: 'Card/photo.jpg', size: 5, hash: 'abc' });
  const failedArchive = file({ id: 'a', folderId: 'keep', path: 'Keep/photo.jpg', size: 5, error: 'Could not read file' });
  const emptyArchive = file({ id: 'e', folderId: 'keep', path: 'Keep/empty.jpg', size: 0, hash: 'empty' });
  const failedIncoming = file({ id: 'f', folderId: 'card', path: 'Card/broken.jpg', size: 9, hash: 'zzz', error: 'Could not read file' });
  const withheld = archiveCheck([failedArchive, emptyArchive, incoming, failedIncoming], { keep: 'archive', card: 'incoming' });
  assert.equal(withheld.archiveChecked, 0);
  assert.equal(withheld.uncheckedArchive, 2);
  assert.equal(withheld.incomingChecked, 1);
  assert.equal(withheld.uncheckedIncoming, 1);
  assert.equal(withheld.uniqueCount, 0);
  assert.equal(withheld.alreadyCount, 0);
  const partial = archiveCheck([
    file({ id: 'ok', folderId: 'keep', path: 'Keep/other.jpg', size: 2, hash: 'other' }),
    failedArchive, incoming, failedIncoming,
  ], { keep: 'archive', card: 'incoming' });
  assert.equal(partial.uniqueCount, 1);
  assert.equal(partial.uncheckedArchive, 1);
  assert.deepEqual(createArchiveReport(partial).match(/No exact copy in checked Archive/g), ['No exact copy in checked Archive']);
});

test('capture-time relationships stay out of the exact Archive count', () => {
  const archive = file({ id: 'a', folderId: 'keep', path: 'Keep/original.jpg', size: 10, hash: 'orig' });
  const exact = file({ id: 'e', folderId: 'card', path: 'Card/backup.jpg', size: 10, hash: 'orig' });
  const edited = file({ id: 'd', folderId: 'card', path: 'Card/edit.jpg', size: 12, hash: 'edit' });
  const sibling = file({ id: 's', folderId: 'card', path: 'Card/sibling.jpg', size: 7, hash: 'sib' });
  const check = archiveCheck([archive, exact, edited, sibling], { keep: 'archive', card: 'incoming' }, [
    { items: [archive, edited, exact] },
    { items: [edited, sibling] },
    { items: [sibling] },
  ]);
  assert.equal(check.alreadyCount, 1);
  assert.equal(check.duplicatedBytes, 10);
  assert.equal(check.weakerCount, 1);
  assert.deepEqual(check.unique.map((item) => item.id), ['d', 's']);
});

test('archive report lists exact status, counterpart paths, and neutralized formulas', () => {
  const check = archiveCheck([
    file({ id: 'a', folderId: 'keep', path: '=Keep/archive.jpg', size: 3, hash: 'abc' }),
    file({ id: 'i', folderId: 'card', path: 'Card/a,"b".jpg', size: 3, hash: 'abc' }),
    file({ id: 'u', folderId: 'card', path: 'Card/\t+new.jpg', size: 9, hash: 'new' }),
  ], { keep: 'archive', card: 'incoming' });
  const csv = createArchiveReport(check);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.startsWith('\uFEFF"Status","Incoming folder","Relative path","File name","Bytes","SHA-256","Archive counterpart folders","Archive counterpart paths"'));
  assert.equal(csv.split('\r\n').filter(Boolean).length, 3);
  assert.ok(csv.includes('"Exact copy in Archive"'));
  assert.ok(csv.includes('"Card/a,""b"".jpg"'));
  assert.ok(csv.includes('"\'=Keep/archive.jpg"'));
  assert.ok(csv.includes('"\'\t+new.jpg"'));
  assert.ok(csv.includes('"No exact copy in checked Archive"'));
  assert.equal(csv.includes('delete'), false);
  assert.equal(csv.includes('Trash'), false);
});
