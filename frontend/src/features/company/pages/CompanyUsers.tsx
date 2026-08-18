import { useMemo, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import BlockIcon from '@mui/icons-material/Block';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
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
import { CreateUserDialog } from '../components/CreateUserDialog';
import { useActivateUser, useDeactivateUser, useUsers } from '../hooks';
import type { CompanyUser } from '../usersApi';

const PAGE_SIZE = 20;

export function CompanyUsers() {
  const [page, setPage] = useState(0); // DataGrid pages are 0-indexed
  const [createOpen, setCreateOpen] = useState(false);
  const { data, isLoading } = useUsers(page + 1);
  const deactivateUser = useDeactivateUser();
  const activateUser = useActivateUser();

  const columns: GridColDef<CompanyUser>[] = useMemo(
    () => [
      {
        field: 'name',
        headerName: 'Name',
        flex: 1,
        minWidth: 160,
        valueFormatter: (value: string | null) => value ?? '—',
      },
      { field: 'email', headerName: 'Email', flex: 1, minWidth: 200 },
      {
        field: 'status',
        headerName: 'Status',
        width: 130,
        renderCell: (params: GridRenderCellParams<CompanyUser>) => (
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
        width: 100,
        sortable: false,
        filterable: false,
        renderCell: (params: GridRenderCellParams<CompanyUser>) => (
          <Tooltip
            title={params.row.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
          >
            <IconButton
              size="small"
              disabled={deactivateUser.isPending || activateUser.isPending}
              onClick={() =>
                params.row.status === 'ACTIVE'
                  ? deactivateUser.mutate(params.row.id)
                  : activateUser.mutate(params.row.id)
              }
            >
              {params.row.status === 'ACTIVE' ? (
                <BlockIcon fontSize="small" />
              ) : (
                <PlayArrowIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        ),
      },
    ],
    [deactivateUser, activateUser],
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
          Users
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
        >
          New User
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

      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </Box>
  );
}
