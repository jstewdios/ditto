export interface Photo {
  id: string;
  folderId: string;
  folderName: string;
  name: string;
  path: string;
  size: number;
  lastModified: number;
  file: File;
  hash?: string;
  error?: string;
  capture?: Capture;
}
export interface Capture {
  burst?: { status: string; uuid: string | null; source: string | null };
  status: string;
  time: { key: string; label: string; display: string; fraction: string | null; offset: string | null } | null;
  camera: string;
  serial: string;
  gps: { latitude: number; longitude: number; display: string } | null;
}
export interface Evidence { label: string; state: string; description: string; missing: number; values: { value: string; count: number }[] }
export interface RelatedGroup { id: string; kind: string; items: Photo[]; contentKeys: string[]; distinctContents: number; captureLabel: string; evidence: Evidence[]; warnings: string[]; hasConflicts: boolean; timeOnly: boolean }
export interface BurstGroup { id: string; kind: string; uuid: string; items: Photo[]; contentKeys: string[]; distinctContents: number; conflicts: string[] }
export interface BurstCoverage { identified: number; absent: number; unsupported: number; invalid: number; unavailable: number }
export type Review = 'related' | 'different' | 'unsure';
export interface Folder {
  id: string;
  name: string;
  photos: Photo[];
  skipped: number;
  signature: string;
}
export interface Group { id: string; items: Photo[]; extraBytes: number }
export interface Progress { completed: number; total: number; bytes: number; totalBytes: number; name: string }
export interface ScanResult { records: Photo[]; errors: { id: string; path: string; error: string }[] }
