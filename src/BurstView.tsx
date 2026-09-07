import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Download, Info, X } from 'lucide-react';
import { CopyCard, PhotoPreview } from './PhotoCards';
import { burstStatusLabels } from './bursts.mjs';
import type { BurstCoverage, BurstGroup, Photo } from './types';

export function BurstResults({ groups, coverage, records, onSelect }: { groups: BurstGroup[]; coverage: BurstCoverage; records: Photo[]; onSelect: (group: BurstGroup) => void }) {
  const [page, setPage] = useState(0);
  const [detailPage, setDetailPage] = useState(0);
  return <section aria-labelledby="burst-heading">
    <div className="study-intro"><div><span className="eyebrow">STUDY 02 · BURSTS</span><h2 id="burst-heading">One sequence. Different moments.</h2><p>Files with the same recorded Apple burst ID appear together, even across different capture times. An ID connects a sequence; it does not identify edits of one frame.</p></div><a className="secondary-button" href="/study-02.zip" download><Download size={16} />Study folders</a></div>
    <div className="coverage-note"><Info size={18} /><div><p><strong>{coverage.identified.toLocaleString()} files</strong> have an Apple burst ID. {coverage.absent.toLocaleString()} have no ID found; {coverage.unsupported.toLocaleString()} have unsupported maker notes; {(coverage.invalid + coverage.unavailable).toLocaleString()} could not be checked reliably.</p><p>This study reads Apple burst IDs only. Missing IDs may reflect export choices or unreadable metadata. Timing and sequence numbers never create these groups.</p></div></div>
    {groups.length ? <><div className="results-heading"><h2>Burst ID groups <span>{groups.length.toLocaleString()}</span></h2><p>Shared recorded identifier</p></div><div className="group-grid related-grid">{groups.slice(page * 24, (page + 1) * 24).map((group) => {
      const previews = group.contentKeys.slice(0, 2).map((key) => group.items.find((item) => `${item.size}:${item.hash}` === key)!);
      return <button className="group-card related-card" key={group.id} onClick={() => onSelect(group)} aria-label={`Inspect burst ID ${group.uuid}`}>
        <div className="related-preview">{previews.map((photo) => <PhotoPreview key={photo.id} photo={photo} />)}</div>
        <div className="group-info"><span className={`relationship-badge ${group.conflicts.length ? 'has-conflicts' : ''}`}>{group.conflicts.length ? 'Camera details differ' : 'Apple burst ID'}</span><h3>{group.items[0].name}</h3><p className="candidate-count">{group.items.length} files · {group.distinctContents} different file contents</p><div className="group-bottom"><span>Compare the moments</span><span className="compare-link">Inspect<ArrowRight size={15} /></span></div></div>
      </button>;
    })}</div>{groups.length > 24 && <div className="pagination"><span>Groups {page * 24 + 1}–{Math.min((page + 1) * 24, groups.length)} of {groups.length}</span><button className="secondary-button" disabled={!page} onClick={() => setPage(page - 1)}><ChevronLeft size={16} />Previous</button><button className="secondary-button" disabled={(page + 1) * 24 >= groups.length} onClick={() => setPage(page + 1)}>Next<ChevronRight size={16} /></button></div>}</>
      : <div className="no-matches"><Info size={30} /><h2>No shared burst IDs found.</h2><p>A group needs an Apple burst ID shared by at least two different file contents. A single file or exact copies alone do not make a burst group. This does not rule out bursts in your selection.</p><a className="secondary-button" href="/study-02.zip" download><Download size={16} />Try the study folders</a></div>}
    <details className="burst-file-details"><summary>Inspect burst metadata for all {records.length.toLocaleString()} checked files</summary><p>Use paths to compare originals and exports, including files missing an identifier. Export burst notes includes every checked file.</p><div className="evidence-table-wrap"><table className="evidence-table"><thead><tr><th scope="col">File location</th><th scope="col">Read result</th><th scope="col">Apple burst ID</th></tr></thead><tbody>{records.slice(detailPage * 24, (detailPage + 1) * 24).map((photo) => <tr key={photo.id}><th scope="row">{photo.folderName}<small>{photo.path}</small></th><td>{burstStatusLabels[photo.capture?.burst?.status as keyof typeof burstStatusLabels] || burstStatusLabels.unavailable}</td><td>{photo.capture?.burst?.uuid || '—'}</td></tr>)}</tbody></table></div>{records.length > 24 && <div className="pagination"><span>Files {detailPage * 24 + 1}–{Math.min((detailPage + 1) * 24, records.length)} of {records.length}</span><button className="secondary-button" disabled={!detailPage} onClick={() => setDetailPage(detailPage - 1)}><ChevronLeft size={16} />Previous</button><button className="secondary-button" disabled={(detailPage + 1) * 24 >= records.length} onClick={() => setDetailPage(detailPage + 1)}>Next<ChevronRight size={16} /></button></div>}</details>
  </section>;
}

export function BurstDialog({ group, onClose }: { group: BurstGroup; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [page, setPage] = useState(0);
  useEffect(() => {
    ref.current?.showModal(); document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, []);
  return <dialog ref={ref} className="compare-dialog" aria-labelledby="burst-title" onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) ref.current?.close(); }}><div className="dialog-content">
    <header className="dialog-header"><div><span className="eyebrow">SAME BURST · STUDY 02</span><h2 id="burst-title">Compare the moments.</h2></div><button className="icon-button" aria-label="Close burst comparison" onClick={() => ref.current?.close()}><X /></button></header>
    <div className="candidate-explanation"><Info size={20} /><div><p><strong>Same recorded Apple burst ID</strong></p><p className="burst-uuid">{group.uuid}</p><p>Source: Apple MakerNote · BurstUUID (0x000b). {group.items.length} files contain {group.distinctContents} different file contents. These may include separate shots, edits, and backups.</p></div></div>
    {group.conflicts.length > 0 && <ul className="candidate-warnings">{group.conflicts.map((text) => <li key={text}>{text}</li>)}</ul>}
    <p className="candidate-footnote">Files appear in selection order, not a verified shooting order. Compare recorded times below. Missing times do not prevent ID matching, and different contents do not establish how many original frames exist.</p>
    <div className="copy-grid">{group.items.slice(page * 4, (page + 1) * 4).map((photo, index) => <CopyCard key={photo.id} photo={photo} index={page * 4 + index} related contentLabel={`File content ${group.contentKeys.indexOf(`${photo.size}:${photo.hash}`) + 1} of ${group.distinctContents} · identical numbers mean exact copies`} />)}</div>
    {group.items.length > 4 && <div className="pagination"><span>Files {page * 4 + 1}–{Math.min((page + 1) * 4, group.items.length)} of {group.items.length}</span><button className="secondary-button" disabled={!page} onClick={() => setPage(page - 1)}><ChevronLeft size={16} />Previous</button><button className="secondary-button" disabled={(page + 1) * 4 >= group.items.length} onClick={() => setPage(page + 1)}>Next<ChevronRight size={16} /></button></div>}
    <footer className="dialog-footer">Metadata can be copied or changed. A shared burst ID does not prove file redundancy or the editing history of any frame. Paths start at the selected folder.</footer>
  </div></dialog>;
}
