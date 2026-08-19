import { useMemo, useState } from 'react';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import {
  DataGrid,
  type GridColDef,
  type GridRenderCellParams,
} from '@mui/x-data-grid';
import { AssignTicketDialog } from './AssignTicketDialog';
import { useTickets, useUpdateTicket } from '../hooks';
import type {
  Ticket,
  TicketPriority,
  TicketStatus,
} from '../ticketsApi';

const PAGE_SIZE = 20;

const STATUS_OPTIONS: TicketStatus[] = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'WAITING_FOR_CUSTOMER',
  'RESOLVED',
  'CLOSED',
];

const PRIORITY_OPTIONS: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const PRIORITY_COLOR: Record<TicketPriority, 'default' | 'warning' | 'error'> = {
  LOW: 'default',
  MEDIUM: 'default',
  HIGH: 'warning',
  URGENT: 'error',
};

// Shared by CompanyTickets (COMPANY_ADMIN) and SupportTickets
// (SUPPORT_USER) — both roles have identical capabilities on tickets
// (list, update fields, assign), unlike Customers where SUPPORT_USER is
// read-only. One workspace, two thin page wrappers.
export function TicketsWorkspace() {
  const [page, setPage] = useState(0); // DataGrid pages are 0-indexed
  const [assignTarget, setAssignTarget] = useState<Ticket | null>(null);
  const { data, isLoading } = useTickets(page + 1);
  const updateTicket = useUpdateTicket();

  const columns: GridColDef<Ticket>[] = useMemo(
    () => [
      { field: 'subject', headerName: 'Subject', flex: 1, minWidth: 200 },
      {
        field: 'customer',
        headerName: 'Customer',
        flex: 1,
        minWidth: 180,
        valueGetter: (_value, row) => row.customer.name,
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 190,
        sortable: false,
        renderCell: (params: GridRenderCellParams<Ticket>) => (
          <Select
            size="small"
            variant="standard"
            value={params.row.status}
            disabled={updateTicket.isPending}
            onChange={(event) =>
              updateTicket.mutate({
                id: params.row.id,
                status: event.target.value as TicketStatus,
              })
            }
            sx={{ width: '100%' }}
          >
            {STATUS_OPTIONS.map((status) => (
              <MenuItem key={status} value={status}>
                {status}
              </MenuItem>
            ))}
          </Select>
        ),
      },
      {
        field: 'priority',
        headerName: 'Priority',
        width: 130,
        sortable: false,
        renderCell: (params: GridRenderCellParams<Ticket>) => (
          <Select
            size="small"
            variant="standard"
            value={params.row.priority}
            disabled={updateTicket.isPending}
            onChange={(event) =>
              updateTicket.mutate({
                id: params.row.id,
                priority: event.target.value as TicketPriority,
              })
            }
            renderValue={(value) => (
              <Chip
                label={value}
                size="small"
                color={PRIORITY_COLOR[value as TicketPriority]}
              />
            )}
            sx={{ width: '100%' }}
          >
            {PRIORITY_OPTIONS.map((priority) => (
              <MenuItem key={priority} value={priority}>
                {priority}
              </MenuItem>
            ))}
          </Select>
        ),
      },
      {
        field: 'assignedUser',
        headerName: 'Assigned To',
        flex: 1,
        minWidth: 160,
        valueGetter: (_value, row) =>
          row.assignedUser?.name ?? row.assignedUser?.email ?? '—',
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
        renderCell: (params: GridRenderCellParams<Ticket>) => (
          <Tooltip title="Assign">
            <IconButton size="small" onClick={() => setAssignTarget(params.row)}>
              <AssignmentIndIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ),
      },
    ],
    [updateTicket],
  );

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
        Tickets
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
        getRowHeight={() => 56}
      />

      {assignTarget && (
        <AssignTicketDialog
          ticket={assignTarget}
          open={Boolean(assignTarget)}
          onClose={() => setAssignTarget(null)}
        />
      )}
    </Box>
  );
}
