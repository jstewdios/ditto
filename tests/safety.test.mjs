import test from 'node:test';
import assert from 'node:assert/strict';
import { groupDuplicates } from '../src/core.mjs';
import { groupRelated } from '../src/relationships.mjs';
import { archiveCheck, createArchiveReport, rolesForCheck } from '../src/archive.mjs';

test('Safety: exact-copy groups identify identical bytes without deletion recommendations', () => {
  const fileA = { id: 'a', folderName: 'Photos', path: 'Photos/a.jpg', name: 'a.jpg', size: 100, hash: 'same', error: undefined };
  const fileB = { id: 'b', folderName: 'Photos', path: 'Photos/b.jpg', name: 'b.jpg', size: 100, hash: 'same', error: undefined };
  const fileC = { id: 'c', folderName: 'Photos', path: 'Photos/c.jpg', name: 'c.jpg', size: 100, hash: 'different', error: undefined };
  
  const groups = groupDuplicates([fileA, fileB, fileC]);
  
  assert.equal(groups.length, 1, 'Should group only identical content');
  assert.equal(groups[0].items.length, 2, 'Should find two identical files');
  assert.equal(groups[0].extraBytes, 100, 'Should report extra bytes, not deletion recommendation');
  
  const archiveRecords = [fileA, fileB, fileC].map((f) => ({ ...f, folderId: f.folderName }));
  const check = archiveCheck(archiveRecords, { Photos: 'archive' });
  const csv = createArchiveReport(check);
  
  assert.equal(csv.includes('delete'), false, 'Archive report must not recommend deletion');
  assert.equal(csv.includes('Delete'), false, 'Archive report must not recommend deletion');
  assert.equal(csv.includes('remove'), false, 'Archive report must not recommend removal');
  assert.equal(csv.includes('trash'), false, 'Archive report must not suggest trash');
  assert.equal(csv.includes('Trash'), false, 'Archive report must not suggest Trash');
});

test('Safety: possibly-related groups remain distinct from exact copies', () => {
  const original = {
    id: 'orig',
    name: 'original.jpg',
    path: 'folder/original.jpg',
    size: 100,
    hash: 'orig-hash'
  };
  
  const edited = {
    id: 'edit',
    name: 'edited.jpg',
    path: 'folder/edited.jpg',
    size: 120,
    hash: 'edit-hash'
  };
  
  const exactGroups = groupDuplicates([original, edited]);
  
  assert.equal(exactGroups.length, 0, 'Different content must not form exact-copy groups');
  
  const archiveFile = { id: 'a', folderId: 'keep', folderName: 'Keep', path: 'Keep/file.jpg', name: 'file.jpg', size: 100, hash: 'content-a', error: undefined };
  const incomingFile = { id: 'i', folderId: 'card', folderName: 'Card', path: 'Card/file.jpg', name: 'file.jpg', size: 120, hash: 'content-b', error: undefined };
  
  const check = archiveCheck([archiveFile, incomingFile], { keep: 'archive', card: 'incoming' });
  
  assert.equal(check.alreadyCount, 0, 'Different content must not count as already in Archive');
  assert.equal(check.duplicatedBytes, 0, 'Different content must not report duplicate bytes');
  assert.equal(check.uniqueCount, 1, 'Different content should appear unique to Incoming');
});

test('Safety: Archive vs Incoming mode does not alter exact-copy grouping', () => {
  const file1 = { id: 'f1', folderId: 'keep', folderName: 'Keep', path: 'Keep/photo.jpg', name: 'photo.jpg', size: 50, hash: 'same', error: undefined };
  const file2 = { id: 'f2', folderId: 'card', folderName: 'Card', path: 'Card/photo.jpg', name: 'photo.jpg', size: 50, hash: 'same', error: undefined };
  const file3 = { id: 'f3', folderId: 'card', folderName: 'Card', path: 'Card/unique.jpg', name: 'unique.jpg', size: 30, hash: 'unique', error: undefined };
  
  const exactGroupsWithoutRoles = groupDuplicates([file1, file2, file3]);
  
  const folders = [
    { id: 'keep', role: 'archive' },
    { id: 'card', role: 'incoming' }
  ];
  const rolesOn = rolesForCheck(true, folders);
  const rolesOff = rolesForCheck(false, folders);
  
  const exactGroupsWithRoles = groupDuplicates([file1, file2, file3]);
  
  assert.deepEqual(rolesOff, {}, 'Roles off should return empty role mapping');
  assert.equal(exactGroupsWithoutRoles.length, 1, 'Should find one exact-copy group');
  assert.equal(exactGroupsWithRoles.length, 1, 'Should find same exact-copy group with roles on');
  assert.deepEqual(
    exactGroupsWithoutRoles[0].items.map((i) => i.hash),
    exactGroupsWithRoles[0].items.map((i) => i.hash),
    'Exact groups must be identical regardless of Archive mode'
  );
  
  const checkWithRolesOn = archiveCheck([file1, file2, file3], rolesOn);
  assert.equal(checkWithRolesOn.alreadyCount, 1, 'Archive check should recognize matching file');
  
  const csvWithRoles = createArchiveReport(checkWithRolesOn);
  assert.equal(csvWithRoles.includes('move'), false, 'Archive report must not suggest moving files');
  assert.equal(csvWithRoles.includes('Move'), false, 'Archive report must not suggest moving files');
  assert.equal(csvWithRoles.includes('action'), false, 'Archive report must not include action column');
  assert.equal(csvWithRoles.includes('Action'), false, 'Archive report must not include Action column');
});
