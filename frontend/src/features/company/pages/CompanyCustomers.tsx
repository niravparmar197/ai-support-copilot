import { useMemo, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  DataGrid,
  type GridColDef,
  type GridRenderCellParams,
} from '@mui/x-data-grid';
import { CustomerDialog } from '../components/CustomerDialog';
import { useCustomers, useDeleteCustomer } from '../hooks';
import type { Customer } from '../customersApi';

const PAGE_SIZE = 20;

export function CompanyCustomers() {
  const [page, setPage] = useState(0); // DataGrid pages are 0-indexed
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const { data, isLoading } = useCustomers(page + 1);
  const deleteCustomer = useDeleteCustomer();

  const columns: GridColDef<Customer>[] = useMemo(
    () => [
      { field: 'name', headerName: 'Name', flex: 1, minWidth: 160 },
      { field: 'email', headerName: 'Email', flex: 1, minWidth: 200 },
      {
        field: 'phone',
        headerName: 'Phone',
        width: 150,
        valueFormatter: (value: string | null) => value ?? '—',
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
        renderCell: (params: GridRenderCellParams<Customer>) => (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Edit">
              <IconButton
                size="small"
                onClick={() => setEditTarget(params.row)}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton
                size="small"
                disabled={deleteCustomer.isPending}
                onClick={() => deleteCustomer.mutate(params.row.id)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ),
      },
    ],
    [deleteCustomer],
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
          Customers
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateOpen(true)}
        >
          New Customer
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

      {createOpen && (
        <CustomerDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      )}
      {editTarget && (
        <CustomerDialog
          customer={editTarget}
          open={Boolean(editTarget)}
          onClose={() => setEditTarget(null)}
        />
      )}
    </Box>
  );
}
