import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { formatBytes } from './core.mjs';
import type { ArchiveCheck } from './types';

const number = (value: number) => value.toLocaleString();
const pageSize = 20;

function Pager({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  if (total <= pageSize) return null;
  return <div className="pagination"><span>{page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {number(total)}</span><button className="secondary-button" disabled={!page} onClick={() => onPage(page - 1)}><ChevronLeft size={16} />Previous</button><button className="secondary-button" disabled={(page + 1) * pageSize >= total} onClick={() => onPage(page + 1)}>Next<ChevronRight size={16} /></button></div>;
}

export function ArchiveResults({ check, archiveFolders, incomingFolders, onShowRelated }: { check: ArchiveCheck; archiveFolders: number; incomingFolders: number; onShowRelated: () => void }) {
  const [matchedPage, setMatchedPage] = useState(0);
  const [uniquePage, setUniquePage] = useState(0);
  useEffect(() => { setMatchedPage(0); setUniquePage(0); }, [check.alreadyCount, check.uniqueCount, check.duplicatedBytes]);
  const matched = check.groups.flatMap((group) => group.incoming.map((file) => ({ file, archive: group.archive })));
  const missingArchive = archiveFolders === 0;
  const missingIncoming = incomingFolders === 0;
  return <section aria-labelledby="archive-heading">
    <div className="study-intro"><div><span className="eyebrow">STUDY 03 · ARCHIVE VS INCOMING</span><h2 id="archive-heading">Is this already over there?</h2><p>Archive is the place you trust. Incoming is the folder you want to evaluate. A file is already archived only when an Archive file has the same size and SHA-256 fingerprint. Names and dates can differ. Nothing is moved or deleted.</p></div></div>
    {missingArchive || missingIncoming ? <div className="no-matches"><Info size={30} /><h2>{missingArchive ? 'Mark a folder as Archive.' : 'Mark a folder as Incoming.'}</h2><p>{missingArchive ? 'Archive is the collection you trust. Incoming files are not labeled unique until a checked Archive exists.' : 'Incoming is the collection you want to check against Archive. You can switch a folder’s role without comparing again.'}</p></div>
      : check.archiveChecked === 0 ? <div className="no-matches"><Info size={30} /><h2>No Archive files could be checked.</h2><p>Incoming files are not labeled unique. An unreadable Archive file might still contain the same bytes. Check the file notices, then try the Archive folder again.</p></div>
        : <>
          <div className="result-summary"><div><span className="stat-number">{number(check.alreadyCount)}</span><span>already in Archive</span></div><div><span className="stat-number stat-bytes">{formatBytes(check.duplicatedBytes)}</span><span>duplicated in Incoming</span></div><div><span className="stat-number">{number(check.uniqueCount)}</span><span>appear unique to Incoming</span></div><span className="verified-label"><Info size={16} />Exact file content</span></div>
          <div className="coverage-note"><Info size={18} /><div>
            <p>{check.weakerCount > 0 ? `${number(check.weakerCount)} Incoming ${check.weakerCount === 1 ? 'file has' : 'files have'} no exact Archive copy but share a recorded capture second with an Archive file. That is weaker evidence in Possibly related and is not counted above.` : 'Possibly related and burst groups are separate. They are not counted as already archived.'}</p>
            {(check.uncheckedArchive > 0 || check.uncheckedIncoming > 0) && <p>{check.uncheckedArchive > 0 ? `${number(check.uncheckedArchive)} Archive ${check.uncheckedArchive === 1 ? 'file' : 'files'} could not be checked. A file that appears unique might still match one of them. ` : ''}{check.uncheckedIncoming > 0 ? `${number(check.uncheckedIncoming)} Incoming ${check.uncheckedIncoming === 1 ? 'file' : 'files'} could not be checked and ${check.uncheckedIncoming === 1 ? 'is' : 'are'} not counted as archived or unique.` : ''}</p>}
            <p>These counts are Incoming files, not distinct photographs. Files that appear unique to Incoming may still match each other. An exact Archive match is not a reason to delete or move anything.</p>
            {check.weakerCount > 0 && <button className="secondary-button" onClick={onShowRelated}>Inspect weaker evidence</button>}
          </div></div>
          <div className="results-heading"><h2>Already in Archive <span>{number(check.alreadyCount)}</span></h2><p>Largest Incoming totals first</p></div>
          {matched.length ? <div className="evidence-table-wrap"><table className="evidence-table archive-table"><caption>Incoming files whose complete contents match a checked Archive file.</caption><thead><tr><th scope="col">Incoming file</th><th scope="col">Bytes</th><th scope="col">Archive locations</th></tr></thead><tbody>{matched.slice(matchedPage * pageSize, (matchedPage + 1) * pageSize).map((row) => {
            const shown = row.archive.slice(0, 8);
            return <tr key={row.file.id}><th scope="row">{row.file.path}<small>{row.file.folderName}</small></th><td>{formatBytes(row.file.size)}</td><td className="archive-paths">{shown.map((item) => <span key={item.id}>{item.path}</span>)}{row.archive.length > shown.length && <small>+ {number(row.archive.length - shown.length)} more Archive locations</small>}</td></tr>;
          })}</tbody></table></div> : <p className="candidate-footnote">No checked Incoming file has an exact copy in Archive.</p>}
          <Pager page={matchedPage} total={matched.length} onPage={setMatchedPage} />
          <div className="results-heading"><h2>Appear unique to Incoming <span>{number(check.uniqueCount)}</span></h2><p>No exact Archive copy</p></div>
          {check.unique.length ? <div className="evidence-table-wrap"><table className="evidence-table archive-table"><caption>Checked Incoming files with no byte-for-byte match in the checked Archive. They may still match other Incoming files.</caption><thead><tr><th scope="col">Incoming file</th><th scope="col">Bytes</th><th scope="col">Exact Archive copy</th></tr></thead><tbody>{check.unique.slice(uniquePage * pageSize, (uniquePage + 1) * pageSize).map((file) => <tr key={file.id}><th scope="row">{file.path}<small>{file.folderName}</small></th><td>{formatBytes(file.size)}</td><td>None in the checked Archive</td></tr>)}</tbody></table></div> : <p className="candidate-footnote">Every checked Incoming file has an exact copy in Archive.</p>}
          <Pager page={uniquePage} total={check.unique.length} onPage={setUniquePage} />
        </>}
  </section>;
}
