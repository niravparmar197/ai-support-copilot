import { NotFoundException } from '@nestjs/common';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { LocalDiskStorageProvider } from './local-disk-storage.provider';

function fakeConfigService(root: string) {
  return { getOrThrow: jest.fn().mockReturnValue(root) } as any;
}

describe('LocalDiskStorageProvider', () => {
  let root: string;
  let provider: LocalDiskStorageProvider;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'storage-test-'));
    provider = new LocalDiskStorageProvider(fakeConfigService(root));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('round-trips a saved file, creating intermediate directories', async () => {
    await provider.saveFile('tenant-1/document-1', Buffer.from('hello world'));

    const result = await provider.getFile('tenant-1/document-1');

    expect(result.toString()).toBe('hello world');
  });

  it('throws NotFoundException for a key that was never saved', async () => {
    await expect(provider.getFile('tenant-1/missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deleteFile is idempotent — deleting a missing key does not throw', async () => {
    await expect(provider.deleteFile('tenant-1/missing')).resolves.toBeUndefined();
  });

  it('deleteFile actually removes the file', async () => {
    await provider.saveFile('tenant-1/document-1', Buffer.from('hello'));
    await provider.deleteFile('tenant-1/document-1');

    await expect(provider.getFile('tenant-1/document-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
