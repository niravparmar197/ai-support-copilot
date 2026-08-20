import { NotFoundException } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { StorageProvider } from '../../storage/storage-provider.interface';

const TENANT_ID = 'tenant-1';
const ACTOR_ID = 'staff-1';

function buildService(
  prismaOverrides: Record<string, unknown>,
  storageOverrides: Record<string, unknown> = {},
) {
  const prisma = {
    document: {
      create: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(async (arg: unknown) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return (arg as (tx: unknown) => Promise<unknown>)(prisma);
    }),
    ...prismaOverrides,
  };
  const storage = {
    saveFile: jest.fn().mockResolvedValue(undefined),
    getFile: jest.fn(),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    ...storageOverrides,
  };

  return {
    service: new DocumentsService(
      prisma as unknown as PrismaService,
      storage as unknown as StorageProvider,
    ),
    prisma,
    storage,
  };
}

function fakeDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 'document-1',
    tenantId: TENANT_ID,
    filename: 'handbook.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    status: 'UPLOADED',
    uploadedById: ACTOR_ID,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    uploadedBy: { id: ACTOR_ID, name: 'Sam', email: 'sam@example.com' },
    ...overrides,
  };
}

function fakeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    originalname: 'handbook.pdf',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('hello'),
  } as Express.Multer.File & typeof overrides;
}

describe('DocumentsService', () => {
  it('saves the file under a tenant-namespaced key and records the upload', async () => {
    const { service, prisma, storage } = buildService({
      document: { create: jest.fn().mockResolvedValue(fakeDocument()) },
    });

    await service.uploadDocument(TENANT_ID, fakeFile(), ACTOR_ID);

    expect(storage.saveFile).toHaveBeenCalledWith(
      `${TENANT_ID}/document-1`,
      expect.any(Buffer),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'document.uploaded' }) }),
    );
  });

  it('deletes the DB row if the file write fails (compensating action)', async () => {
    const del = jest.fn().mockResolvedValue(undefined);
    const { service, prisma } = buildService(
      {
        document: { create: jest.fn().mockResolvedValue(fakeDocument()), delete: del },
      },
      { saveFile: jest.fn().mockRejectedValue(new Error('disk full')) },
    );

    await expect(
      service.uploadDocument(TENANT_ID, fakeFile(), ACTOR_ID),
    ).rejects.toThrow('disk full');

    expect(del).toHaveBeenCalledWith({ where: { id: 'document-1' } });
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('404s downloading a document from another tenant', async () => {
    const { service } = buildService({
      document: {
        findUnique: jest.fn().mockResolvedValue(fakeDocument({ tenantId: 'tenant-2' })),
      },
    });

    await expect(
      service.downloadDocument(TENANT_ID, 'document-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes both the DB row and the file', async () => {
    const del = jest.fn().mockResolvedValue(undefined);
    const { service, prisma, storage } = buildService({
      document: { findUnique: jest.fn().mockResolvedValue(fakeDocument()), delete: del },
    });

    await service.deleteDocument(TENANT_ID, 'document-1', ACTOR_ID);

    expect(del).toHaveBeenCalledWith({ where: { id: 'document-1' } });
    expect(storage.deleteFile).toHaveBeenCalledWith(`${TENANT_ID}/document-1`);
  });

  it('scopes the list query to the caller’s tenant', async () => {
    const findMany = jest.fn().mockResolvedValue([fakeDocument()]);
    const { service, prisma } = buildService({
      document: { findMany, count: jest.fn().mockResolvedValue(1) },
    });

    const result = await service.listDocuments(TENANT_ID, { page: 1, pageSize: 20 });

    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_ID } }),
    );
    expect(result.data).toHaveLength(1);
  });
});
