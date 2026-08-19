import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useCustomers } from '../../company/hooks';
import type { Customer } from '../../company/customersApi';

const PAGE_SIZE = 20;

const columns: GridColDef<Customer>[] = [
  { field: 'name', headerName: 'Name', flex: 1, minWidth: 160 },
  { field: 'email', headerName: 'Email', flex: 1, minWidth: 200 },
  {
    field: 'phone',
    headerName: 'Phone',
    width: 150,
    valueFormatter: (value: string | null) => value ?? '—',
  },
];

// Read-only: SUPPORT_USER can look customers up (e.g. while working a
// ticket) but not create/edit/delete them — that stays COMPANY_ADMIN-only
// (see CompanyCustomers), enforced server-side on the write endpoints, not
// just by this page omitting the buttons.
export function SupportCustomers() {
  const [page, setPage] = useState(0); // DataGrid pages are 0-indexed
  const { data, isLoading } = useCustomers(page + 1);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
        Customers
      </Typography>

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
