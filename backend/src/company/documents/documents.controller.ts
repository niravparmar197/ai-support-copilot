import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UnsupportedMediaTypeException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
} from './document-upload.constants';
import { DocumentResponseDto, PaginatedDocumentsDto } from './dto/document-response.dto';
import { DocumentsService } from './documents.service';

// user.tenantId! below: @Roles() (COMPANY_ADMIN/SUPPORT_USER only)
// guarantees a non-null tenantId (D-008), same reasoning as every other
// company/* controller.
@ApiTags('company/documents')
@Controller('company/documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('COMPANY_ADMIN', 'SUPPORT_USER')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @Roles('COMPANY_ADMIN')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_DOCUMENT_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.mimetype)) {
          callback(
            new UnsupportedMediaTypeException(
              `Unsupported file type: ${file.mimetype}`,
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  @ApiOperation({ summary: 'Upload a document' })
  @ApiResponse({ status: 201, type: DocumentResponseDto })
  @ApiResponse({ status: 415, description: 'Unsupported file type.' })
  upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.uploadDocument(user.tenantId!, file, user.id);
  }

  @Get()
  @ApiOperation({ summary: "List the caller's company documents (paginated)" })
  @ApiResponse({ status: 200, type: PaginatedDocumentsDto })
  list(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.listDocuments(user.tenantId!, query);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download a document' })
  @ApiResponse({ status: 200, description: 'The file, as a binary stream.' })
  @ApiResponse({
    status: 404,
    description: 'No document with that id in the caller’s company.',
  })
  async download(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, filename, mimeType } = await this.documentsService.downloadDocument(
      user.tenantId!,
      id,
    );

    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    });

    return buffer;
  }

  @Delete(':id')
  @Roles('COMPANY_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a document' })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @ApiResponse({
    status: 404,
    description: 'No document with that id in the caller’s company.',
  })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.deleteDocument(user.tenantId!, id, user.id);
  }
}
