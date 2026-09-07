import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Download, Info, X } from 'lucide-react';
import { CopyCard, PhotoPreview } from './PhotoCards';
import type { RelatedGroup, Review } from './types';

const verdicts: Record<Review, string> = { related: 'Looks related', different: 'Different photographs', unsure: 'Not sure' };

export function RelatedResults({ groups, coverage, reviews, onSelect }: { groups: RelatedGroup[]; coverage: { eligible: number; missingTime: number; unavailable: number }; reviews: Record<string, Review>; onSelect: (group: RelatedGroup) => void }) {
  const [page, setPage] = useState(0);
  return <section aria-labelledby="related-heading">
    <div className="study-intro"><div><span className="eyebrow">STUDY 01 · VERSIONS</span><h2 id="related-heading">Possibly the same photograph.</h2><p>These groups share a recorded capture second and contain different file contents. Inspect the evidence before treating them as versions of one photograph.</p></div><a className="secondary-button" href="/study-01.zip" download><Download size={16} />Study folders</a></div>
    <div className="coverage-note"><Info size={18} /><div><p><strong>{coverage.eligible.toLocaleString()} files</strong> have a usable capture time. {coverage.missingTime.toLocaleString()} have no usable capture time; {coverage.unavailable.toLocaleString()} could not be checked for capture metadata.</p><p>Files without usable capture times remain in the exact-copy comparison. Metadata outside the first 1 MiB may be unavailable.</p></div></div>
    {groups.length ? <><div className="results-heading"><h2>Candidate groups <span>{groups.length.toLocaleString()}</span></h2><p>No original is assumed</p></div><div className="group-grid related-grid">{groups.slice(page * 24, (page + 1) * 24).map((group) => {
      const variants = group.contentKeys.slice(0, 2).map((key) => group.items.find((item) => `${item.size}:${item.hash}` === key)!);
      return <button key={group.id} className="group-card related-card" onClick={() => onSelect(group)} aria-label={`Inspect possible relationship at ${group.captureLabel}`}>
        <div className="related-preview">{variants.map((photo) => <PhotoPreview key={photo.id} photo={photo} />)}</div>
        <div className="group-info"><span className={`relationship-badge ${group.hasConflicts ? 'has-conflicts' : ''}`}>{group.hasConflicts ? 'Conflicting details' : group.timeOnly ? 'Capture time only' : 'Shared capture details'}</span><h3>{group.captureLabel}</h3><p className="candidate-count">{group.items.length.toLocaleString()} files · {group.distinctContents.toLocaleString()} different file contents</p><div className="group-bottom"><span>{reviews[group.id] ? verdicts[reviews[group.id]] : 'Not reviewed'}</span><span className="compare-link">Inspect<ArrowRight size={15} /></span></div></div>
      </button>;
    })}</div>{groups.length > 24 && <div className="pagination"><span>Groups {page * 24 + 1}–{Math.min((page + 1) * 24, groups.length)} of {groups.length}</span><button className="secondary-button" disabled={!page} onClick={() => setPage(page - 1)}><ChevronLeft size={16} />Previous</button><button className="secondary-button" disabled={(page + 1) * 24 >= groups.length} onClick={() => setPage(page + 1)}>Next<ChevronRight size={16} /></button></div>}</>
      : <div className="no-matches"><Info size={30} /><h2>No candidate groups found.</h2><p>That does not mean there are no related photos. Capture metadata may be missing or changed. Groups made entirely of exact copies appear in the Exact copies view.</p><a className="secondary-button" href="/study-01.zip" download><Download size={16} />Try the study folders</a></div>}
  </section>;
}

export function RelatedDialog({ group, review, onReview, onClose }: { group: RelatedGroup; review?: Review; onReview: (review: Review) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [page, setPage] = useState(0);
  useEffect(() => {
    ref.current?.showModal(); document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, []);
  return <dialog ref={ref} className="compare-dialog" aria-labelledby="related-title" onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) ref.current?.close(); }}>
    <div className="dialog-content">
      <header className="dialog-header"><div><span className="eyebrow">POSSIBLY RELATED · STUDY 01</span><h2 id="related-title">Do these belong together?</h2></div><button className="icon-button" aria-label="Close possible relationship" onClick={() => ref.current?.close()}><X /></button></header>
      <div className="candidate-explanation"><Info size={20} /><p><strong>Same recorded capture second:</strong> {group.captureLabel}. These {group.items.length} files contain {group.distinctContents} different file contents. Shared metadata suggests a connection; it does not prove common origin.</p></div>
      <div className="evidence-table-wrap"><table className="evidence-table"><caption>Capture evidence across {group.distinctContents} different file contents. Exact copies count once here.</caption><thead><tr><th scope="col">Detail</th><th scope="col">Evidence</th><th scope="col">Recorded values</th></tr></thead><tbody>{group.evidence.map((field) => <tr key={field.label}><th scope="row">{field.label}</th><td><span className={`evidence-state ${field.state}`}>{field.description}</span>{field.missing > 0 && <small>{field.missing} not recorded</small>}</td><td>{field.values.length ? field.values.slice(0, 6).map((value) => <span key={value.value}>{field.label === 'Fractional seconds' ? `.${value.value}` : value.value} <small>({value.count})</small></span>) : 'Unknown'}{field.values.length > 6 && <small>+ {field.values.length - 6} more values; inspect individual files below.</small>}</td></tr>)}</tbody></table></div>
      {group.warnings.length > 0 && <ul className="candidate-warnings">{group.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
      <p className="candidate-footnote">A camera model is not a unique device ID. Metadata can be copied, removed, or changed. No file here is designated as the original.</p>
      <fieldset className="study-review"><legend>Your read on this group</legend><div>{(Object.entries(verdicts) as [Review, string][]).map(([value, label]) => <label key={value} className={review === value ? 'chosen' : ''}><input type="radio" name="relationship-review" value={value} checked={review === value} onChange={() => onReview(value)} />{label}</label>)}</div><p>Your assessment stays in this session and is included in “Export study notes.” It does not change grouping or exact-copy results.</p></fieldset>
      <div className="copy-grid">{group.items.slice(page * 4, (page + 1) * 4).map((photo, index) => <CopyCard key={photo.id} photo={photo} index={page * 4 + index} related contentLabel={`File content ${group.contentKeys.indexOf(`${photo.size}:${photo.hash}`) + 1} of ${group.distinctContents} · identical numbers mean exact copies`} />)}</div>
      {group.items.length > 4 && <div className="pagination"><span>Files {page * 4 + 1}–{Math.min((page + 1) * 4, group.items.length)} of {group.items.length}</span><button className="secondary-button" disabled={!page} onClick={() => setPage(page - 1)}><ChevronLeft size={16} />Previous</button><button className="secondary-button" disabled={(page + 1) * 4 >= group.items.length} onClick={() => setPage(page + 1)}>Next<ChevronRight size={16} /></button></div>}
      <footer className="dialog-footer">File numbers and content numbers are labels for this comparison, not an editing history. Paths start at the selected folder.</footer>
    </div>
  </dialog>;
}
