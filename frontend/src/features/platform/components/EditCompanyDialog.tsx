import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { ApiError } from '../../../lib/api';
import { useUpdateCompany } from '../hooks';

// Minimal shape, not CompanyListItem/CompanyDetail specifically — this
// dialog is used from both the list (rows) and the detail page (a
// differently-shaped object), and only ever needs id + name.
interface EditCompanyDialogProps {
  company: { id: string; name: string };
  open: boolean;
  onClose: () => void;
}

export function EditCompanyDialog({
  company,
  open,
  onClose,
}: EditCompanyDialogProps) {
  const [name, setName] = useState(company.name);
  const updateCompany = useUpdateCompany();

  const handleSave = () => {
    updateCompany.mutate(
      { id: company.id, name },
      { onSuccess: onClose },
    );
  };

  const error =
    updateCompany.error instanceof ApiError ? updateCompany.error : undefined;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Edit Company</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Company Name"
          fullWidth
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error.errors && error.errors.length > 0
              ? error.errors.join(', ')
              : error.message}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={updateCompany.isPending || name.trim().length === 0}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
