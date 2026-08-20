import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Document } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { STORAGE_PROVIDER, type StorageProvider } from '../../storage/storage-provider.interface';
import type {
  DocumentResponseDto,
  PaginatedDocumentsDto,
} from './dto/document-response.dto';

type DocumentWithUploader = Document & {
  uploadedBy: { id: string; name: string | null; email: string };
};

const DOCUMENT_INCLUDE = {
  uploadedBy: { select: { id: true, name: true, email: true } },
} as const;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  /**
   * Two-step write (DB row, then file), not a real transaction — Postgres
   * and the filesystem can't share one. Creates the row first (to get an
   * id to use as the storage key), then writes the file; if that write
   * throws, deletes the row rather than leaving a Document with no
   * backing file. Still a real (small) gap: if the process dies between
   * the file write succeeding and this function returning, nothing rolls
   * back — the row and file are both already correct at that point, so
   * this only matters for the narrower window before the write completes.
   */
  async uploadDocument(
    tenantId: string,
    file: Express.Multer.File,
    actorId: string,
  ): Promise<DocumentResponseDto> {
    const document = await this.prisma.document.create({
      data: {
        tenantId,
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        status: 'UPLOADED',
        uploadedById: actorId,
      },
      include: DOCUMENT_INCLUDE,
    });

    try {
      await this.storage.saveFile(storageKey(tenantId, document.id), file.buffer);
    } catch (error) {
      await this.prisma.document.delete({ where: { id: document.id } });
      throw error;
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        actorId,
        action: 'document.uploaded',
        targetType: 'document',
        targetId: document.id,
        metadata: { filename: file.originalname, sizeBytes: file.size },
      },
    });

    return toDocumentResponse(document);
  }

  async listDocuments(
    tenantId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedDocumentsDto> {
    const { page, pageSize } = query;

    const [documents, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where: { tenantId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: DOCUMENT_INCLUDE,
      }),
      this.prisma.document.count({ where: { tenantId } }),
    ]);

    return {
      data: documents.map(toDocumentResponse),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async downloadDocument(
    tenantId: string,
    id: string,
  ): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
    const document = await this.findTenantDocument(tenantId, id);
    const buffer = await this.storage.getFile(storageKey(tenantId, id));

    return { buffer, filename: document.filename, mimeType: document.mimeType };
  }

  async deleteDocument(tenantId: string, id: string, actorId: string): Promise<void> {
    await this.findTenantDocument(tenantId, id);

    await this.prisma.document.delete({ where: { id } });
    await this.storage.deleteFile(storageKey(tenantId, id));

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        actorId,
        action: 'document.deleted',
        targetType: 'document',
        targetId: id,
        metadata: {},
      },
    });
  }

  // 404, not 403, for a wrong-tenant id — same "don't confirm existence of
  // something the caller has no business seeing" as every other lookup in
  // this app.
  private async findTenantDocument(
    tenantId: string,
    id: string,
  ): Promise<DocumentWithUploader> {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: DOCUMENT_INCLUDE,
    });

    if (!document || document.tenantId !== tenantId) {
      throw new NotFoundException();
    }

    return document;
  }
}

// Tenant-namespaced, never a user-supplied filename — see
// LocalDiskStorageProvider's comment on why that matters.
function storageKey(tenantId: string, documentId: string): string {
  return `${tenantId}/${documentId}`;
}

function toDocumentResponse(document: DocumentWithUploader): DocumentResponseDto {
  return {
    id: document.id,
    filename: document.filename,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    status: document.status,
    uploadedBy: document.uploadedBy,
    createdAt: document.createdAt,
  };
}
