// D-032: storage-agnostic on purpose. Every writer/reader in this app talks
// to this interface, never to fs or an S3 client directly, so swapping the
// implementation (S3, once this deploys beyond a single EC2 instance) is a
// one-file change — a new class implementing this interface plus a
// one-line swap in StorageModule — not a rewrite of every call site.
export interface StorageProvider {
  saveFile(key: string, buffer: Buffer): Promise<void>;
  getFile(key: string): Promise<Buffer>;
  deleteFile(key: string): Promise<void>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
