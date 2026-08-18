import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import BlockIcon from '@mui/icons-material/Block';
import EditIcon from '@mui/icons-material/Edit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VisibilityIcon from '@mui/icons-material/Visibility';
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
import type { CompanyListItem } from '../companiesApi';
import { EditCompanyDialog } from '../components/EditCompanyDialog';
import { useCompanies, useUpdateCompany } from '../hooks';

const PAGE_SIZE = 20;

export function PlatformCompanies() {
  const [page, setPage] = useState(0); // DataGrid pages are 0-indexed
  const [editTarget, setEditTarget] = useState<CompanyListItem | null>(null);
  const { data, isLoading } = useCompanies(page + 1);
  const updateCompany = useUpdateCompany();

  const columns: GridColDef<CompanyListItem>[] = useMemo(
    () => [
      { field: 'name', headerName: 'Name', flex: 1, minWidth: 160 },
      {
        field: 'adminEmail',
        headerName: 'Admin',
        flex: 1,
        minWidth: 200,
        valueFormatter: (value: string | null) => value ?? '—',
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 130,
        renderCell: (params: GridRenderCellParams<CompanyListItem>) => (
          <Chip
            label={params.value}
            size="small"
            color={params.value === 'ACTIVE' ? 'success' : 'default'}
          />
        ),
      },
      {
        field: 'createdAt',
        headerName: 'Created',
        width: 130,
        valueFormatter: (value: string) => new Date(value).toLocaleDateString(),
      },
      {
        field: 'actions',
        headerName: 'Actions',
        width: 150,
        sortable: false,
        filterable: false,
        renderCell: (params: GridRenderCellParams<CompanyListItem>) => (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="View">
              <IconButton
                size="small"
                component={RouterLink}
                to={`/platform/companies/${params.row.id}`}
              >
                <VisibilityIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => setEditTarget(params.row)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip
              title={params.row.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
            >
              <IconButton
                size="small"
                disabled={updateCompany.isPending}
                onClick={() =>
                  updateCompany.mutate({
                    id: params.row.id,
                    status:
                      params.row.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
                  })
                }
              >
                {params.row.status === 'ACTIVE' ? (
                  <BlockIcon fontSize="small" />
                ) : (
                  <PlayArrowIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          </Box>
        ),
      },
    ],
    [updateCompany],
  );

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
          Companies
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          component={RouterLink}
          to="/platform/companies/new"
        >
          New Company
        </Button>
      </Box>

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

      {editTarget && (
        <EditCompanyDialog
          company={editTarget}
          open={Boolean(editTarget)}
          onClose={() => setEditTarget(null)}
        />
      )}
    </Box>
  );
}
