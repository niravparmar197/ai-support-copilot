import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { ApiError } from '../../../lib/api';
import type { Customer } from '../customersApi';
import { useCreateCustomer, useUpdateCustomer } from '../hooks';

interface CustomerDialogProps {
  // Undefined -> create mode. Present -> edit mode, pre-filled from the
  // already-loaded row (same approach as EditCompanyDialog — no separate
  // detail fetch).
  customer?: Customer;
  open: boolean;
  onClose: () => void;
}

export function CustomerDialog({ customer, open, onClose }: CustomerDialogProps) {
  const [name, setName] = useState(customer?.name ?? '');
  const [email, setEmail] = useState(customer?.email ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const mutation = customer ? updateCustomer : createCustomer;

  const handleClose = () => {
    mutation.reset();
    onClose();
  };

  const handleSave = () => {
    const input = { name, email, phone: phone || undefined };

    if (customer) {
      updateCustomer.mutate({ id: customer.id, ...input }, { onSuccess: handleClose });
    } else {
      createCustomer.mutate(input, { onSuccess: handleClose });
    }
  };

  const error = mutation.error instanceof ApiError ? mutation.error : undefined;
  const canSubmit = name.trim().length > 0 && email.trim().length > 0;

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>{customer ? 'Edit Customer' : 'New Customer'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            autoFocus
            label="Name"
            fullWidth
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <TextField
            label="Email"
            type="email"
            fullWidth
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <TextField
            label="Phone"
            fullWidth
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </Stack>
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
          disabled={!canSubmit || mutation.isPending}
        >
          {customer ? 'Save' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
