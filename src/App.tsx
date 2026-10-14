import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRight, Check, ChevronLeft, ChevronRight, Copy, FileImage, Folder as FolderIcon, FolderOpen, FolderPlus, Info, LoaderCircle, LockKeyhole, Plus, ScanLine, ShieldCheck, X } from 'lucide-react';
import { createReport, formatBytes, groupDuplicates, readEntry } from './core.mjs';
import { archiveCheck, createArchiveReport, rolesForCheck, viewAfterArchiveMode } from './archive.mjs';
import { clearMetadataCache, makeFolder } from './photos';
import { CopyCard, PhotoPreview } from './PhotoCards';
import { RelatedResults, RelatedDialog } from './RelatedView';
import { BurstResults, BurstDialog } from './BurstView';
import { ArchiveResults } from './ArchiveView';
import { createBurstReport } from './bursts.mjs';
import { createRelatedReport } from './relationships.mjs';
import type { ArchiveCheck, BurstGroup, BurstCoverage, Capture, CollectionRole, Folder, Group, Photo, Progress, RelatedGroup, Review } from './types';

const number = (value: number) => value.toLocaleString();

function CompareDialog({ group, onClose }: { group: Group; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [page, setPage] = useState(0);
  const items = group.items.slice(page * 4, (page + 1) * 4);
  useEffect(() => {
    ref.current?.showModal();
    document.body.classList.add('modal-open');
    return () => { document.body.classList.remove('modal-open'); };
  }, []);
  return <dialog ref={ref} className="compare-dialog" aria-labelledby="compare-title" onClose={onClose} onClick={(e) => { if (e.target === e.currentTarget) ref.current?.close(); }}>
    <div className="dialog-content">
      <header className="dialog-header"><div><span className="eyebrow">FILE COMPARISON</span><h2 id="compare-title">One file. {number(group.items.length)} copies.</h2></div><button className="icon-button" aria-label="Close comparison" onClick={() => ref.current?.close()}><X /></button></header>
      <div className="match-explanation"><ShieldCheck size={21} /><p><strong>Identical file content.</strong> The file and its contents match exactly. Names, locations, and file modification dates can differ.</p></div>
      <div className="copy-grid">{items.map((photo, index) => <CopyCard key={photo.id} photo={photo} index={page * 4 + index} />)}</div>
      {group.items.length > 4 && <div className="pagination"><span>Copies {page * 4 + 1}–{Math.min((page + 1) * 4, group.items.length)} of {number(group.items.length)}</span><button className="secondary-button" disabled={!page} onClick={() => setPage(page - 1)}><ChevronLeft size={16} />Previous</button><button className="secondary-button" disabled={(page + 1) * 4 >= group.items.length} onClick={() => setPage(page + 1)}>Next<ChevronRight size={16} /></button></div>}
      <footer className="dialog-footer"><p>Paths start at the folder you chose. File modification dates use your current time zone.</p><details><summary>How was this match verified?</summary><p>Every byte of each file was read locally. The files have equal sizes and matching SHA-256 fingerprints. This includes embedded metadata.</p><code>{group.items[0].hash}</code></details></footer>
    </div>
  </dialog>;
}

function HelpDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog className="help-dialog" ref={ref} onClose={onClose} aria-labelledby="help-title" onClick={(e) => { if (e.target === e.currentTarget) ref.current?.close(); }}>
    <header className="dialog-header"><h2 id="help-title">A closer look at matching</h2><button className="icon-button" aria-label="Close matching information" onClick={() => ref.current?.close()}><X /></button></header>
    <div className="help-content">
      <h3>Same file, wherever it lives</h3><p>Ditto reads complete files and compares their sizes and SHA-256 fingerprints. Renamed copies match. Different files with the same name do not.</p>
      <h3>Study 04: Any file type</h3><p>Ditto now inspects exact copies across all file types: photos, audio, documents, archives, and more. Photo-specific features (Possibly related and Same burst) remain available for supported photo formats only.</p>
      <h3>Exact copies and photo relationships</h3><p>Exact copies have identical full file contents. The separate Possibly related view groups different photo contents with the same recorded capture second. That can bring edits together when capture metadata survives, but it can also bring separate burst shots together. Non-photo files appear in exact copy results but not in photo relationship views.</p>
      <h3>Study 03: Archive and Incoming</h3><p>This is optional, after you have seen exact copies. Turn it on to mark one folder as Archive and another as Incoming. Already archived counts only exact file content. It shows where those Archive copies live, how much space the Incoming copies use, and which Incoming files have no exact Archive copy. Turning it off returns to exact copies without comparing again. An Archive match is not a suggestion to delete or move anything.</p><h3>Photo evidence you can inspect</h3><p>Each photo candidate group shows fractional seconds, camera model, serial number, and GPS coordinates when recorded. Conflicts and missing values stay visible. No file is labeled the original, and these groups never count as extra copies or recoverable space. Missing time-zone offsets are not guessed; files with and without offsets are assessed separately.</p><h3>Study 01: versions</h3><p>Compare a group and mark whether it looks related, contains different photographs, or leaves you unsure. Assessments stay in this session and can be exported with the evidence. <a href="/study-01.zip" download>Download the synthetic study folders</a> to try edits, burst shots, conflicting cameras, and missing metadata.</p>
      <h3>Study 02: explicit bursts</h3><p>The Same burst view connects photo files with a shared Apple BurstUUID, including files with different or missing capture times. It does not use proximity in time, sequence numbers, or Live Photo identifiers. Exports and backups can share the ID, so file counts are not frame counts. Inspect metadata for all checked files, and export burst notes to compare which exports retained the ID. <a href="/study-02.zip" download>Download the synthetic burst study folders</a>.</p>
      <h3>Your folders stay yours</h3><p>File contents, paths, and metadata are processed in this browser. Ditto has no file uploads, analytics, or file-changing controls. Closing or reloading the page clears the session. A report, including study assessments, is saved only when you export it.</p>
      <h3>Choose separate folders</h3><p>Include subfolders by selecting their parent once. Folders are not labeled Archive or Incoming unless you turn on that workflow. Avoid adding a folder and its parent separately: browsers hide full disk paths, so Ditto cannot reliably recognize overlapping selections. Choose one folder at a time, or drop several together.</p>
      <h3>Supported formats</h3><p>All file types are checked for exact copies. Empty files are excluded. Photo formats (JPEG, PNG, WebP, GIF, BMP, AVIF, HEIC, TIFF, and common camera RAW extensions) receive metadata extraction for relationship views. Your browser may not preview every format. Missing previews or metadata do not prevent file comparison.</p>
      <p className="help-note">An extra copy may be an intentional backup. Ditto shows where copies are; it does not decide which one you should keep.</p>
    </div>
  </dialog>;
}

export default function App() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [relatedGroups, setRelatedGroups] = useState<RelatedGroup[]>([]);
  const [coverage, setCoverage] = useState({ eligible: 0, missingTime: 0, unavailable: 0 });
  const [view, setView] = useState<'archive' | 'exact' | 'related' | 'burst'>('exact');
  const [archiveMode, setArchiveMode] = useState(false);
  const [burstGroups, setBurstGroups] = useState<BurstGroup[]>([]);
  const [burstCoverage, setBurstCoverage] = useState<BurstCoverage>({ identified: 0, absent: 0, unsupported: 0, invalid: 0, unavailable: 0 });
  const [scannedRecords, setScannedRecords] = useState<Photo[]>([]);
  const [selectedBurst, setSelectedBurst] = useState<BurstGroup>();
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  const [selectedRelated, setSelectedRelated] = useState<RelatedGroup>();
  const [result, setResult] = useState<{ checked: number; errors: { path: string; error: string }[] }>();
  const [progress, setProgress] = useState<Progress>();
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState('');
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<Group>();
  const [help, setHelp] = useState(false);
  const [page, setPage] = useState(0);
  const folderInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const worker = useRef<Worker | null>(null);
  const busy = !!progress || adding;
  const photos = useMemo(() => folders.flatMap((folder) => folder.photos), [folders]);
  const skipped = folders.reduce((sum, folder) => sum + folder.skipped, 0);
  const otherFiles = folders.reduce((sum, folder) => sum + (folder.otherFiles || 0), 0);
  const photoFiles = photos.length - otherFiles;
  const extraCopies = groups.reduce((sum, group) => sum + group.items.length - 1, 0);
  const extraBytes = groups.reduce((sum, group) => sum + group.extraBytes, 0);
  const archiveFolders = folders.filter((folder) => folder.role === 'archive').length;
  const incomingFolders = folders.filter((folder) => folder.role === 'incoming').length;
  const archive: ArchiveCheck = useMemo(() => {
    const checked = new Map(scannedRecords.map((photo) => [photo.id, photo]));
    const records = photos.map((photo) => checked.get(photo.id) ?? { ...photo, error: photo.error || 'Could not read file' });
    return archiveCheck(records, rolesForCheck(archiveMode, folders), relatedGroups);
  }, [scannedRecords, photos, folders, relatedGroups, archiveMode]);
  useEffect(() => () => { worker.current?.terminate(); clearMetadataCache(); }, []);

  function invalidate() { setBurstGroups([]); setScannedRecords([]); setSelectedBurst(undefined); setBurstCoverage({ identified: 0, absent: 0, unsupported: 0, invalid: 0, unavailable: 0 }); setRelatedGroups([]); setCoverage({ eligible: 0, missingTime: 0, unavailable: 0 }); setReviews({}); setSelectedRelated(undefined); setView('exact'); setGroups([]); setResult(undefined); setSelected(undefined); setPage(0); clearMetadataCache(); }

  async function addSelections(selections: { name: string; entries: { file: File; path: string }[] }[]) {
    setAdding(true); setNotice('');
    try {
      const incoming = await Promise.all(selections.map(({ name, entries }) => makeFolder(name, entries)));
      const accepted: Folder[] = [];
      let repeated = false;
      for (const folder of incoming) {
        if ([...folders, ...accepted].some((existing) => existing.signature === folder.signature)) { repeated = true; continue; }
        const sameName = [...folders, ...accepted].filter((existing) => existing.name === folder.name || existing.name.startsWith(`${folder.name} (`)).length;
        if (sameName) {
          folder.name = `${folder.name} (${sameName + 1})`;
          folder.photos.forEach((photo) => { photo.folderName = folder.name; });
        }
        accepted.push(folder);
      }
      if (accepted.length) { setFolders((current) => [...current, ...accepted]); invalidate(); }
      if (repeated) setNotice('A selection matches paths, sizes, and dates already added. It was not counted twice. If these are distinct folders with the same name, rename one before choosing it.');
      else if (incoming.every((folder) => !folder.photos.length)) setNotice('No files were found in that selection, or all files were empty. Empty files cannot be compared.');
    } catch { setNotice('That folder could not be read. Try choosing it again, or choose individual files.'); }
    finally { setAdding(false); }
  }

  function selectFiles(files: File[], individual = false) {
    const selections = new Map<string, { file: File; path: string }[]>();
    for (const file of files) {
      const path = individual ? `Selected files/${file.name}` : file.webkitRelativePath || file.name;
      const root = individual ? 'Selected files' : path.split('/')[0];
      if (!selections.has(root)) selections.set(root, []);
      selections.get(root)!.push({ file, path });
    }
    if (files.length) void addSelections([...selections].map(([name, entries]) => ({ name, entries })));
  }

  async function drop(event: React.DragEvent) {
    event.preventDefault(); setDragging(false);
    if (busy) return;
    // Capture entries before the drag data store becomes unavailable.
    const files = Array.from(event.dataTransfer.files);
    const entries = Array.from(event.dataTransfer.items).map((item) => item.webkitGetAsEntry?.()).filter(Boolean);
    if (!entries.length) { selectFiles(files, true); return; }
    setAdding(true); setNotice('');
    try {
      const selections = [];
      const individual: { file: File; path: string }[] = [];
      for (const entry of entries) {
        const found = await readEntry(entry);
        if (entry!.isDirectory) selections.push({ name: entry!.name, entries: found });
        else individual.push(...found.map((item: { file: File; path: string }) => ({ ...item, path: `Selected files/${item.path}` })));
      }
      if (individual.length) selections.push({ name: 'Selected files', entries: individual });
      await addSelections(selections);
    } catch { setNotice('One of those folders could not be read. Nothing from this drop was added. Try the folder picker.'); setAdding(false); }
  }

  function scan() {
    if (!photos.length || busy) return;
    invalidate(); setNotice('');
    setProgress({ completed: 0, total: photos.length, bytes: 0, totalBytes: photos.reduce((sum, photo) => sum + photo.size, 0), name: 'Starting comparison…' });
    try {
      const next = new Worker(new URL('./scan.worker.ts', import.meta.url), { type: 'module' });
      worker.current = next;
      next.onmessage = ({ data }) => {
        if (worker.current !== next) return;
        if (data.type === 'progress') setProgress(data);
        if (data.type === 'done') {
          const scans = new Map<string, { hash: string; capture: Capture }>(data.records.map((record: { id: string; hash: string; capture: Capture }) => [record.id, record]));
          const records = photos.filter((photo) => scans.has(photo.id)).map((photo) => ({ ...photo, ...scans.get(photo.id)! }));
          const recordsById = new Map(records.map((photo) => [photo.id, photo]));
          setRelatedGroups(data.related.map((group: Omit<RelatedGroup, 'items'> & { items: string[] }) => ({ ...group, items: group.items.map((id) => recordsById.get(id)!) })));
          setCoverage(data.coverage);
          setScannedRecords(records); setBurstCoverage(data.burstCoverage);
          setBurstGroups(data.bursts.map((group: Omit<BurstGroup, 'items'> & { items: string[] }) => ({ ...group, items: group.items.map((id) => recordsById.get(id)!) })));
          setGroups(groupDuplicates(records)); setResult({ checked: records.length, errors: data.errors }); setProgress(undefined);
          next.terminate(); worker.current = null;
        }
      };
      next.onerror = () => { if (worker.current !== next) return; setProgress(undefined); setNotice('The comparison stopped unexpectedly. Your files are unchanged. Try a smaller selection.'); next.terminate(); worker.current = null; };
      next.postMessage({ photos });
    } catch { worker.current?.terminate(); worker.current = null; setProgress(undefined); setNotice('Comparison could not start in this browser. Try a recent version of Firefox, Chrome, Edge, or Safari.'); }
  }

  function setRole(id: string, role: CollectionRole) { setFolders((current) => current.map((folder) => folder.id === id ? { ...folder, role } : folder)); }
  function toggleArchiveMode() {
    const enabled = !archiveMode;
    setArchiveMode(enabled);
    setView(viewAfterArchiveMode(enabled, view));
    setPage(0);
  }
  function cancel() { worker.current?.terminate(); worker.current = null; setProgress(undefined); setNotice('Comparison stopped. Your folders are still selected; you can start again.'); }
  function clear() { setFolders([]); invalidate(); setNotice(''); }
  function exportReport() {
    const body = view === 'archive' ? createArchiveReport(archive) : view === 'exact' ? createReport(groups) : view === 'burst' ? createBurstReport(scannedRecords.filter((file) => file.isPhoto !== false)) : createRelatedReport(relatedGroups, reviews);
    const filename = view === 'archive' ? 'ditto-archive-check.csv' : view === 'exact' ? 'ditto-photo-copies.csv' : view === 'burst' ? 'ditto-burst-notes.csv' : 'ditto-possible-relationships.csv';
    const url = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  const percent = progress ? Math.min(100, Math.round((progress.totalBytes ? progress.bytes / progress.totalBytes : progress.completed / progress.total) * 100)) : 0;

  return <div className={`app ${dragging ? 'is-dragging' : ''}`} onDragOver={(event) => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); if (!busy) setDragging(true); } }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={drop}>
    <a className="skip-link" href="#workspace">Skip to file workspace</a>
    <input ref={folderInput} type="file" multiple {...({ webkitdirectory: '', directory: '' } as Record<string, string>)} className="hidden-input" aria-label="Choose folder" onChange={(event) => { const files = Array.from(event.target.files || []); event.target.value = ''; selectFiles(files); }} />
    <input ref={fileInput} type="file" multiple className="hidden-input" aria-label="Choose files" onChange={(event) => { const files = Array.from(event.target.files || []); event.target.value = ''; selectFiles(files, true); }} />
    <header className="topbar"><div className="brand"><span className="brand-icon"><Copy size={24} strokeWidth={2.2} /></span><span>ditto<span className="brand-period">.</span></span></div><div className="topbar-actions"><span className="local-label"><LockKeyhole size={14} />Only on your device</span><button className="text-button help-button" onClick={() => setHelp(true)}><Info size={17} /><span>How it works</span></button></div></header>
    <div className="workspace-layout">
      <aside className="sidebar" aria-label="Selected folders">
        <div className="sidebar-title"><h2>Your folders</h2><span className="count-badge">{number(folders.length)}</span></div>
        <button className="add-folder-button" disabled={busy} onClick={() => folderInput.current?.click()}><Plus size={17} />Add a folder</button>
        {archiveMode && <p className="role-hint">Optional. Mark the folder you trust as Archive and the one you want to check as Incoming.</p>}
        {folders.length ? <ul className="folder-list">{folders.map((folder) => <li key={folder.id}><span className="folder-symbol"><FolderIcon size={21} /></span><div><strong title={folder.name}>{folder.name}</strong><span>{number(folder.photos.length)} {folder.photos.length === 1 ? 'file' : 'files'}{folder.skipped ? ` · ${number(folder.skipped)} empty` : ''}</span>{archiveMode && <div className="role-switch" role="group" aria-label={`Collection role for ${folder.name}`}><button aria-pressed={folder.role === 'archive'} onClick={() => setRole(folder.id, 'archive')}>Archive</button><button aria-pressed={folder.role === 'incoming'} onClick={() => setRole(folder.id, 'incoming')}>Incoming</button></div>}</div><button className="icon-button remove-folder" aria-label={`Remove ${folder.name}`} disabled={busy} onClick={() => { setFolders((current) => current.filter((item) => item.id !== folder.id)); invalidate(); setNotice(''); }}><X size={15} /></button></li>)}</ul>
          : <div className="folder-placeholder"><FolderOpen size={25} strokeWidth={1.4} /><p>A music folder. An old backup.<br />That folder on your desktop.</p><span>Add the places you want to compare.</span></div>}
        <div className="sidebar-bottom">
          {!!folders.length && <><div className="folder-total"><span>Files selected</span><strong>{number(photos.length)}</strong></div><button className="text-button clear-button" disabled={busy} onClick={clear}>Clear workspace</button></>}
          <div className="privacy-note"><ShieldCheck size={19} /><p>Your files stay put.<br /><span>Nothing uploaded, moved, or deleted.</span></p></div>
        </div>
      </aside>

      <main id="workspace" className="main-workspace">
        <div className="workspace-heading"><div><span className="eyebrow">FILE WORKSPACE</span><h1>{result ? (view === 'archive' ? 'Is this already over there?' : 'Comparison complete.') : 'Find your repeats.'}</h1><p>{result && view === 'archive' && archiveFolders > 0 && incomingFolders > 0 && archive.archiveChecked > 0 ? `${number(archive.alreadyCount)} Incoming ${archive.alreadyCount === 1 ? 'file is' : 'files are'} already in Archive. ${number(archive.uniqueCount)} appear unique to Incoming.` : result ? `${number(result.checked)} files compared across ${number(folders.length)} ${folders.length === 1 ? 'selection' : 'selections'}.` : 'See which files you have twice. And where they live.'}</p></div>{result && (view === 'archive' ? archive.archiveChecked > 0 && archive.incomingChecked > 0 : view === 'exact' ? groups.length > 0 : view === 'burst' ? scannedRecords.length > 0 : relatedGroups.length > 0) && <button className="secondary-button export-button" onClick={exportReport}><ArrowDownToLine size={17} />{view === 'archive' ? 'Export archive check' : view === 'exact' ? 'Export exact copies' : view === 'burst' ? 'Export burst notes' : 'Export study notes'}</button>}</div>
        {notice && <div className="notice" role="status"><Info size={19} /><p>{notice}</p><button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={16} /></button></div>}
        {adding ? <section className="scan-panel" aria-live="polite"><LoaderCircle className="spin" size={32} /><h2>Reading your folders…</h2><p>Collecting files, including subfolders.</p></section>
          : progress ? <section className="scan-panel" aria-label="Comparison progress"><div className="scan-icon"><ScanLine size={31} /></div><span className="eyebrow">COMPARING LOCALLY</span><h2>Comparing files and metadata.</h2><p>{number(progress.completed)} of {number(progress.total)} files checked</p><div className="progress-track"><progress aria-label="Files compared" max={100} value={percent} /><span>{percent}%</span></div><p className="scan-path" title={progress.name}>{progress.name}</p><button className="secondary-button" onClick={cancel}>Stop comparison</button><span className="scan-footnote">You can keep using this page. Your files are never changed.</span></section>
            : result ? <>
              <div className="relationship-switch" role="group" aria-label="Relationship view">
                <button aria-pressed={view === 'exact'} onClick={() => { setView('exact'); setPage(0); }}>Exact copies <span>{number(groups.length)}</span></button>
                <button aria-pressed={view === 'related'} onClick={() => { setView('related'); setPage(0); }}>Possibly related <span>{number(relatedGroups.length)}</span></button>
                <button aria-pressed={view === 'burst'} onClick={() => { setView('burst'); setPage(0); }}>Same burst <span>{number(burstGroups.length)}</span></button>
                {archiveMode && <button aria-pressed={view === 'archive'} onClick={() => { setView('archive'); setPage(0); }}>Already archived {archiveFolders > 0 && incomingFolders > 0 && archive.archiveChecked > 0 && <span>{number(archive.alreadyCount)}</span>}</button>}
              </div>
              <div className="archive-opt-in"><button aria-pressed={archiveMode} onClick={toggleArchiveMode}>Archive vs Incoming</button><p>{archiveMode ? 'Assign the roles on your folders. Turn this off to return to exact copies. The comparison stays.' : 'Optional, after you have seen where exact copies live.'}</p></div>
              {result.errors.length > 0 && <details className="scan-errors"><summary>{number(result.errors.length)} {result.errors.length === 1 ? 'file could' : 'files could'} not be compared</summary><ul>{result.errors.map((error, index) => <li key={index}><span>{error.path}</span><strong>{error.error}</strong></li>)}</ul><p>These files are excluded from the results.</p></details>}
              {view === 'archive' ? <ArchiveResults check={archive} archiveFolders={archiveFolders} incomingFolders={incomingFolders} onShowRelated={() => { setView('related'); setPage(0); }} /> : view === 'burst' ? <BurstResults groups={burstGroups} coverage={burstCoverage} records={scannedRecords.filter((file) => file.isPhoto !== false)} onSelect={setSelectedBurst} /> : view === 'related' ? <RelatedResults groups={relatedGroups} coverage={coverage} reviews={reviews} onSelect={setSelectedRelated} /> : <>
              <div className="result-summary"><div><span className="stat-number">{number(groups.length)}</span><span>repeated {groups.length === 1 ? 'file' : 'files'}</span></div><div><span className="stat-number">{number(extraCopies)}</span><span>extra {extraCopies === 1 ? 'copy' : 'copies'}</span></div><div><span className="stat-number stat-bytes">{formatBytes(extraBytes)}</span><span>in extra copies</span></div><span className="verified-label"><ShieldCheck size={16} />Exact matches only</span></div>
              {groups.length ? <><div className="results-heading"><h2>Meet your repeats <span>{number(groups.length)}</span></h2><p>Largest extra copies first</p></div><div className="group-grid">{groups.slice(page * 24, (page + 1) * 24).map((group, index) => <button className="group-card" key={group.id} onClick={() => setSelected(group)} aria-label={`Compare ${group.items.length} copies of ${group.items[0].name}`}>
                <div className="group-image"><PhotoPreview photo={group.items[0]} /><span className="copy-pill"><Copy size={13} />{number(group.items.length)} copies</span></div>
                <div className="group-info"><div className="group-title"><span className="group-index">{String(page * 24 + index + 1).padStart(2, '0')}</span><h3>{group.items[0].name}</h3></div><ul className="copy-locations">{group.items.slice(0, 4).map((item) => <li key={item.id}><span>{item.folderName}</span><span>{item.path}</span></li>)}{group.items.length > 4 && <li>+ {number(group.items.length - 4)} more in the comparison</li>}</ul><div className="group-bottom"><span>{formatBytes(group.extraBytes)} in extra copies</span><span className="compare-link">Compare<ArrowRight size={15} /></span></div></div>
              </button>)}</div>{groups.length > 24 && <div className="pagination"><span>{page * 24 + 1}–{Math.min((page + 1) * 24, groups.length)} of {number(groups.length)} groups</span><button className="secondary-button" disabled={!page} onClick={() => setPage(page - 1)}><ChevronLeft size={16} />Previous</button><button className="secondary-button" disabled={(page + 1) * 24 >= groups.length} onClick={() => setPage(page + 1)}>Next<ChevronRight size={16} /></button></div>}</>
                : <div className="no-matches"><span className="no-matches-icon"><Check size={31} /></span><h2>{result.checked ? 'No exact copies found.' : 'No files could be compared.'}</h2><p>{result.checked ? 'Every successfully checked file has different content. Edited or resized versions may still be present.' : 'Check the file notices above, then try another folder.'}</p><button className="secondary-button" onClick={() => folderInput.current?.click()}><FolderPlus size={17} />Add another folder</button></div>}
              </>}
              <div className="results-footer"><p>{skipped ? `${number(skipped)} empty ${skipped === 1 ? 'file' : 'files'} excluded. ` : ''}{otherFiles > 0 && (view === 'related' || view === 'burst') ? `${number(otherFiles)} non-photo ${otherFiles === 1 ? 'file' : 'files'} checked for exact copies only. ` : ''}{view === 'archive' ? 'An Archive match is exact file content, not a suggestion to delete or move the Incoming copy.' : view === 'exact' ? 'An extra copy might be a backup worth keeping.' : 'Photo relationships do not imply duplicate content or recoverable space.'}</p><button className="text-button" onClick={scan}><ScanLine size={16} />Compare again</button></div>
            </> : <>
              <section className={`dropzone ${folders.length ? 'ready' : ''}`} aria-label="Add folders">
                <div className="folder-art" aria-hidden="true"><div className="art-tile tile-back"><FileImage size={43} strokeWidth={1.1} /></div><div className="art-tile tile-front"><FolderOpen size={43} strokeWidth={1.2} /><span><Plus size={13} /></span></div></div>
                <span className="eyebrow">{photos.length ? 'READY WHEN YOU ARE' : 'START WITH A COUPLE OF FOLDERS'}</span>
                <h2>{photos.length ? `${number(photos.length)} ${photos.length === 1 ? 'file' : 'files'}. Let’s take a look.` : 'Same file. Different places.'}</h2>
                <p>{photos.length ? `Find exact copies${photoFiles > 0 ? ', possible photo versions, and recorded bursts' : ''}.` : 'Drop your folders here, or choose them below.\nSubfolders come along, too.'}</p>
                <div className="dropzone-actions">{photos.length ? <button className="primary-button" onClick={scan}><ScanLine size={18} />Compare files<ArrowRight size={17} /></button> : <button className="primary-button" onClick={() => folderInput.current?.click()}><FolderPlus size={19} />Choose a folder<ArrowRight size={17} /></button>}<button className="text-button" onClick={() => fileInput.current?.click()}>or choose files</button></div>
                <div className="format-hint">Photos, audio, documents & more<span>·</span>Exact copies · Photo relationships</div>
              </section>
              <div className="steps"><div><span>01</span><h3>Bring the folders</h3><p>Choose separate folders from your device or connected drives.</p></div><div><span>02</span><h3>Find the repeats</h3><p>Compare file contents, even when the names are different.</p></div><div><span>03</span><h3>See every copy</h3><p>Inspect locations and details. Export a list to come back to.</p></div></div>
            </>}
        <footer className="workspace-footer"><span>Your files stay on your device.</span><button className="text-button" onClick={() => setHelp(true)}>What counts as a match?<ArrowRight size={14} /></button></footer>
      </main>
    </div>
    {dragging && <div className="drop-overlay" aria-hidden="true"><FolderPlus size={42} /><strong>Drop folders to add them</strong><span>Everything stays on your device</span></div>}
    {selected && <CompareDialog key={selected.id} group={selected} onClose={() => setSelected(undefined)} />}
    {selectedBurst && <BurstDialog key={selectedBurst.id} group={selectedBurst} onClose={() => setSelectedBurst(undefined)} />}
    {selectedRelated && <RelatedDialog group={selectedRelated} review={reviews[selectedRelated.id]} onReview={(review) => setReviews((current) => ({ ...current, [selectedRelated.id]: review }))} onClose={() => setSelectedRelated(undefined)} />}
    {help && <HelpDialog onClose={() => setHelp(false)} />}
  </div>;
}
