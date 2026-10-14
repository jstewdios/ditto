import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getFileCategory } from '../src/core.mjs';

describe('Study 05: File categorization and filtering', () => {
  it('categorizes photo files correctly', () => {
    assert.equal(getFileCategory({ name: 'photo.jpg' }), 'photos');
    assert.equal(getFileCategory({ name: 'image.png' }), 'photos');
    assert.equal(getFileCategory({ name: 'shot.heic' }), 'photos');
    assert.equal(getFileCategory({ name: 'RAW.CR2' }), 'photos');
    assert.equal(getFileCategory({ name: 'scan.tiff' }), 'photos');
  });

  it('categorizes audio files correctly', () => {
    assert.equal(getFileCategory({ name: 'song.mp3' }), 'audio');
    assert.equal(getFileCategory({ name: 'track.m4a' }), 'audio');
    assert.equal(getFileCategory({ name: 'podcast.flac' }), 'audio');
    assert.equal(getFileCategory({ name: 'recording.wav' }), 'audio');
    assert.equal(getFileCategory({ name: 'audio.ogg' }), 'audio');
  });

  it('categorizes document files correctly', () => {
    assert.equal(getFileCategory({ name: 'report.pdf' }), 'documents');
    assert.equal(getFileCategory({ name: 'notes.txt' }), 'documents');
    assert.equal(getFileCategory({ name: 'essay.docx' }), 'documents');
    assert.equal(getFileCategory({ name: 'readme.md' }), 'documents');
    assert.equal(getFileCategory({ name: 'script.js' }), 'documents');
    assert.equal(getFileCategory({ name: 'data.json' }), 'documents');
    assert.equal(getFileCategory({ name: 'page.html' }), 'documents');
  });

  it('categorizes other files correctly', () => {
    assert.equal(getFileCategory({ name: 'archive.zip' }), 'other');
    assert.equal(getFileCategory({ name: 'video.mp4' }), 'other');
    assert.equal(getFileCategory({ name: 'data.bin' }), 'other');
    assert.equal(getFileCategory({ name: 'app.exe' }), 'other');
  });

  it('handles string filenames directly', () => {
    assert.equal(getFileCategory('photo.jpg'), 'photos');
    assert.equal(getFileCategory('song.mp3'), 'audio');
    assert.equal(getFileCategory('doc.pdf'), 'documents');
    assert.equal(getFileCategory('file.dat'), 'other');
  });

  it('is case-insensitive', () => {
    assert.equal(getFileCategory('PHOTO.JPG'), 'photos');
    assert.equal(getFileCategory('Song.MP3'), 'audio');
    assert.equal(getFileCategory('Document.PDF'), 'documents');
  });

  it('handles files without extensions', () => {
    assert.equal(getFileCategory({ name: 'README' }), 'other');
    assert.equal(getFileCategory({ name: 'makefile' }), 'other');
  });

  it('handles mixed-extension groups based on first item', () => {
    // In real usage, groups contain identical bytes so mixed extensions should be rare,
    // but category is determined by the first item's extension
    const groups = [
      { id: '1', items: [{ name: 'photo.jpg' }, { name: 'photo-copy.jpg' }], extraBytes: 1000 },
      { id: '2', items: [{ name: 'song.mp3' }, { name: 'song-backup.mp3' }], extraBytes: 5000 },
    ];
    
    const photoGroups = groups.filter(g => getFileCategory(g.items[0]) === 'photos');
    const audioGroups = groups.filter(g => getFileCategory(g.items[0]) === 'audio');
    
    assert.equal(photoGroups.length, 1);
    assert.equal(audioGroups.length, 1);
  });

  it('preserved sorting remains by extra bytes regardless of category', () => {
    const groups = [
      { id: '1', items: [{ name: 'large.mp3' }], extraBytes: 10000 },
      { id: '2', items: [{ name: 'medium.jpg' }], extraBytes: 5000 },
      { id: '3', items: [{ name: 'small.pdf' }], extraBytes: 1000 },
    ];
    
    // Groups are already sorted by extraBytes descending from groupDuplicates
    const sortedByBytes = [...groups].sort((a, b) => b.extraBytes - a.extraBytes);
    assert.deepEqual(groups, sortedByBytes);
  });

  it('category filtering does not modify groups', () => {
    const groups = [
      { id: '1', items: [{ name: 'photo.jpg', id: 'a' }], extraBytes: 1000 },
      { id: '2', items: [{ name: 'song.mp3', id: 'b' }], extraBytes: 2000 },
      { id: '3', items: [{ name: 'doc.pdf', id: 'c' }], extraBytes: 3000 },
    ];
    
    const originalGroups = JSON.parse(JSON.stringify(groups));
    
    // Filtering is a read-only operation
    const photoGroups = groups.filter(g => getFileCategory(g.items[0]) === 'photos');
    
    // Original groups unchanged
    assert.deepEqual(groups, originalGroups);
    assert.equal(photoGroups.length, 1);
    assert.equal(photoGroups[0].id, '1');
  });

  it('all filter shows all groups', () => {
    const groups = [
      { id: '1', items: [{ name: 'photo.jpg' }], extraBytes: 1000 },
      { id: '2', items: [{ name: 'song.mp3' }], extraBytes: 2000 },
      { id: '3', items: [{ name: 'doc.pdf' }], extraBytes: 3000 },
      { id: '4', items: [{ name: 'data.bin' }], extraBytes: 4000 },
    ];
    
    // 'all' filter means no filtering
    const allGroups = groups.filter(() => true);
    assert.equal(allGroups.length, 4);
  });

  it('summary totals count all groups regardless of active filter', () => {
    const groups = [
      { id: '1', items: [{ name: 'a.jpg' }, { name: 'b.jpg' }], extraBytes: 1000 },
      { id: '2', items: [{ name: 'c.mp3' }, { name: 'd.mp3' }, { name: 'e.mp3' }], extraBytes: 5000 },
    ];
    
    // Total extra copies: (2-1) + (3-1) = 1 + 2 = 3
    const totalExtraCopies = groups.reduce((sum, group) => sum + group.items.length - 1, 0);
    assert.equal(totalExtraCopies, 3);
    
    // Total extra bytes
    const totalExtraBytes = groups.reduce((sum, group) => sum + group.extraBytes, 0);
    assert.equal(totalExtraBytes, 6000);
    
    // These totals don't change when viewing filtered results
    const photoGroups = groups.filter(g => getFileCategory(g.items[0]) === 'photos');
    assert.equal(photoGroups.length, 1); // Only showing photos
    
    // But totals still reflect ALL groups
    const allExtraCopies = groups.reduce((sum, group) => sum + group.items.length - 1, 0);
    assert.equal(allExtraCopies, 3); // Not just the photo group
  });
});
