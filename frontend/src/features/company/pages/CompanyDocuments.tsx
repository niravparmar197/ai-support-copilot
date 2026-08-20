import { useMemo, useRef, useState } from 'react';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  DataGrid,
  type GridColDef,
  type GridRenderCellParams,
} from '@mui/x-data-grid';
import { useCurrentUser } from '../../auth/hooks';
import { ApiError } from '../../../lib/api';
import { documentDownloadUrl, type CompanyDocument, type DocumentStatus } from '../documentsApi';
import { useDeleteDocument, useDocuments, useUploadDocument } from '../hooks';

const PAGE_SIZE = 20;

const STATUS_COLOR: Record<DocumentStatus, 'default' | 'warning' | 'success' | 'error'> = {
  UPLOADED: 'default',
  PROCESSING: 'warning',
  INDEXED: 'success',
  FAILED: 'error',
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CompanyDocuments() {
  const [page, setPage] = useState(0); // DataGrid pages are 0-indexed
  const { data: currentUser } = useCurrentUser();
  const { data, isLoading } = useDocuments(page + 1);
  const uploadDocument = useUploadDocument();
  const deleteDocument = useDeleteDocument();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canManage = currentUser?.role === 'COMPANY_ADMIN';

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-selecting the same file next time
    if (file) {
      uploadDocument.mutate(file);
    }
  };

  const columns: GridColDef<CompanyDocument>[] = useMemo(
    () => [
      { field: 'filename', headerName: 'Filename', flex: 1, minWidth: 200 },
      {
        field: 'sizeBytes',
        headerName: 'Size',
        width: 100,
        valueFormatter: (value: number) => formatSize(value),
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 130,
        renderCell: (params: GridRenderCellParams<CompanyDocument>) => (
          <Chip label={params.value} size="small" color={STATUS_COLOR[params.row.status]} />
        ),
      },
      {
        field: 'uploadedBy',
        headerName: 'Uploaded By',
        flex: 1,
        minWidth: 160,
        valueGetter: (_value, row) => row.uploadedBy.name ?? row.uploadedBy.email,
      },
      {
        field: 'createdAt',
        headerName: 'Uploaded',
        width: 130,
        valueFormatter: (value: string) => new Date(value).toLocaleDateString(),
      },
      {
        field: 'actions',
        headerName: 'Actions',
        width: canManage ? 100 : 60,
        sortable: false,
        filterable: false,
        renderCell: (params: GridRenderCellParams<CompanyDocument>) => (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Download">
              <IconButton
                size="small"
                component="a"
                href={documentDownloadUrl(params.row.id)}
              >
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {canManage && (
              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  disabled={deleteDocument.isPending}
                  onClick={() => deleteDocument.mutate(params.row.id)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        ),
      },
    ],
    [canManage, deleteDocument],
  );

  const uploadError =
    uploadDocument.error instanceof ApiError ? uploadDocument.error : undefined;

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Documents
        </Typography>
        {canManage && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              onChange={handleFileSelected}
              accept=".pdf,.txt,.md,.docx"
            />
            <Button
              variant="contained"
              startIcon={<UploadIcon />}
              disabled={uploadDocument.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadDocument.isPending ? 'Uploading…' : 'Upload'}
            </Button>
          </>
        )}
      </Box>

      {uploadError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {uploadError.errors && uploadError.errors.length > 0
            ? uploadError.errors.join(', ')
            : uploadError.message}
        </Alert>
      )}

      <DataGrid
        rows={data?.data ?? []}
        columns={columns}
        loading={isLoading}
        paginationMode="server"
        rowCount={data?.pagination.total ?? 0}
        paginationModel={{ page, pageSize: PAGE_SIZE }}
        onPaginationModelChange={(model) => setPage(model.page)}
        pageSizeOptions={[PAGE_SIZE]}
        disableRowSelectionOnClick
        autoHeight
      />
    </Box>
  );
}
