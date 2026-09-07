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
}
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
