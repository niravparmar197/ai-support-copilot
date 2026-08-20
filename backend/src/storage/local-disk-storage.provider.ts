import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import type { StorageProvider } from './storage-provider.interface';

// D-032: local disk, defensible specifically because this deploys to a
// single EC2 instance (Day 61), not an autoscaling group — no "which
// instance has the file" problem to solve yet. Keys are namespaced
// (tenantId/documentId, never a user-supplied filename — see
// DocumentsService) so this never needs to sanitize a path component
// itself; it only ever sees keys this codebase generated.
@Injectable()
export class LocalDiskStorageProvider implements StorageProvider {
  private readonly root: string;

  constructor(configService: ConfigService) {
    this.root = resolve(configService.getOrThrow<string>('DOCUMENT_STORAGE_PATH'));
  }

  async saveFile(key: string, buffer: Buffer): Promise<void> {
    const path = this.resolveKey(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buffer);
  }

  async getFile(key: string): Promise<Buffer> {
    try {
      return await readFile(this.resolveKey(key));
    } catch (error) {
      if (isNotFoundError(error)) {
        throw new NotFoundException();
      }
      throw error;
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      await rm(this.resolveKey(key));
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
      // Already gone — deleteFile is idempotent, same as every other
      // delete in this app (deleteFile is called from DocumentsService's
      // compensating-action rollback too, where the file may never have
      // finished writing in the first place).
    }
  }

  private resolveKey(key: string): string {
    return join(this.root, key);
  }
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'ENOENT'
  );
}
