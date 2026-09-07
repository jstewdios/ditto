import { useEffect, useState } from 'react';
import { Check, Copy, FileImage, Folder as FolderIcon, ImageOff } from 'lucide-react';
import { formatBytes } from './core.mjs';
import { photoDetails } from './photos';
import type { Details } from './photos';
import { acquirePreview } from './previews';
import type { Photo } from './types';
const number = (value: number) => value.toLocaleString();
const date = (value: number) => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not available';

function usePhotoUrl(photo: Photo) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true;
    const preview = acquirePreview(photo);
    preview.ready.then((next) => { if (active) setUrl(next); }).catch(() => {});
    return () => { active = false; preview.release(); };
  }, [photo]);
  return url;
}

export function PhotoPreview({ photo, large = false }: { photo: Photo; large?: boolean }) {
  const url = usePhotoUrl(photo);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photo.id]);
  return <div className={`photo-preview ${large ? 'photo-large' : ''}`}>
    {failed ? <div className="preview-unavailable"><ImageOff size={26} /><span>Preview unavailable</span><small>{photo.name.split('.').pop()?.toUpperCase()} · still compared by file content</small></div>
      : url ? <img src={url} alt={photo.name} loading="lazy" onError={() => setFailed(true)} /> : <FileImage size={30} />}
  </div>;
}

export function CopyCard({ photo, index, related = false, contentLabel }: { photo: Photo; index: number; related?: boolean; contentLabel?: string }) {
  const [details, setDetails] = useState<Details>();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let active = true;
    photoDetails(photo).then((result) => { if (active) setDetails(result); });
    return () => { active = false; };
  }, [photo]);
  const size = details?.width && details.height ? [details.width, details.height] : undefined;
  async function copyPath() {
    try { await navigator.clipboard.writeText(photo.path); setCopied(true); }
    catch { setCopied(false); }
  }
  return <article className="copy-card">
    <div className="copy-number"><span>{related ? 'File' : 'Copy'} {String(index + 1).padStart(2, '0')}</span><span><FolderIcon size={13} />{photo.folderName}</span></div>
    <PhotoPreview photo={photo} large />
    {contentLabel && <div className="content-label">{contentLabel}</div>}
    <div className="copy-info">
      <h3>{photo.name}</h3>
      <div className="path-box"><span className="tiny-label">LOCATION</span><p>{photo.path}</p><button className="text-button" onClick={copyPath}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Path copied' : 'Copy path'}</button></div>
      <dl className="metadata">
        <div><dt>File size</dt><dd>{formatBytes(photo.size)} <small>({number(photo.size)} bytes)</small></dd></div>
        <div><dt>Dimensions</dt><dd>{size ? `${number(size[0])} × ${number(size[1])}` : details ? 'Not available' : 'Reading…'}</dd></div>
        <div><dt>Date modified</dt><dd>{date(photo.lastModified)}</dd></div>
        <div><dt>Date taken</dt><dd>{related ? photo.capture?.time?.display || 'Not recorded' : details ? details.taken || 'Not available' : 'Reading…'}</dd></div>
        <div><dt>Camera</dt><dd>{related ? photo.capture?.camera || 'Not recorded' : details ? details.camera || 'Not available' : 'Reading…'}</dd></div>
      {related && <><div><dt>Camera serial</dt><dd>{photo.capture?.serial || 'Not recorded'}</dd></div><div><dt>GPS</dt><dd>{photo.capture?.gps?.display || 'Not recorded'}</dd></div></>}
      </dl>
    </div>
  </article>;
}
