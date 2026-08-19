import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { ApiError } from '../../../lib/api';
import type { Ticket } from '../ticketsApi';
import { useAssignableSupportUsers, useAssignTicket } from '../hooks';

const UNASSIGNED = '__unassigned__';

interface AssignTicketDialogProps {
  ticket: Ticket;
  open: boolean;
  onClose: () => void;
}

export function AssignTicketDialog({
  ticket,
  open,
  onClose,
}: AssignTicketDialogProps) {
  const [assignedUserId, setAssignedUserId] = useState(
    ticket.assignedUser?.id ?? UNASSIGNED,
  );
  const { data: supportUsers, isLoading } = useAssignableSupportUsers();
  const assignTicket = useAssignTicket();

  const handleClose = () => {
    assignTicket.reset();
    onClose();
  };

  const handleSave = () => {
    assignTicket.mutate(
      {
        id: ticket.id,
        assignedUserId: assignedUserId === UNASSIGNED ? null : assignedUserId,
      },
      { onSuccess: handleClose },
    );
  };

  const error =
    assignTicket.error instanceof ApiError ? assignTicket.error : undefined;

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Assign Ticket</DialogTitle>
      <DialogContent>
        <TextField
          select
          label="Assigned to"
          fullWidth
          margin="dense"
          value={assignedUserId}
          onChange={(event) => setAssignedUserId(event.target.value)}
          disabled={isLoading}
        >
          <MenuItem value={UNASSIGNED}>Unassigned</MenuItem>
          {supportUsers?.data.map((user) => (
            <MenuItem key={user.id} value={user.id}>
              {user.name ?? user.email}
            </MenuItem>
          ))}
        </TextField>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error.errors && error.errors.length > 0
              ? error.errors.join(', ')
              : error.message}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={assignTicket.isPending}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
