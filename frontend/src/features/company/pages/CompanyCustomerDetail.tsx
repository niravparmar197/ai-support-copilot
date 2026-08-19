import { useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCustomer, useCustomerOrders } from '../hooks';
import type { Order } from '../ordersApi';

// Plain Stack/Paper layout, not a DataGrid — order volume per customer is
// small (Order's own schema.prisma comment: not meant to be a tenant-wide
// paginated list), so a table-grade component would be over-tooling this.
// Read-only: no order-taking workflow today, this data exists mainly for
// later AI tools (get_order/get_payment).
function OrderCard({ order }: { order: Order }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1 }}>
        <Typography sx={{ fontWeight: 600 }}>${order.totalAmount}</Typography>
        <Chip label={order.status} size="small" />
        <Typography variant="caption" color="text.secondary">
          {new Date(order.createdAt).toLocaleDateString()}
        </Typography>
      </Stack>

      {order.payments.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No payments recorded.
        </Typography>
      ) : (
        <Stack spacing={0.5} divider={<Divider />}>
          {order.payments.map((payment) => (
            <Stack
              key={payment.id}
              direction="row"
              spacing={1.5}
              sx={{ alignItems: 'center', py: 0.5 }}
            >
              <Typography variant="body2">${payment.amount}</Typography>
              <Chip label={payment.status} size="small" variant="outlined" />
              <Typography variant="caption" color="text.secondary">
                {payment.method ?? 'unknown method'} ·{' '}
                {new Date(payment.createdAt).toLocaleDateString()}
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}
    </Paper>
  );
}

export function CompanyCustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: customer, isLoading: customerLoading } = useCustomer(id ?? '');
  const { data: orders, isLoading: ordersLoading } = useCustomerOrders(id ?? '');

  if (customerLoading) {
    return <Typography color="text.secondary">Loading…</Typography>;
  }

  if (!customer) {
    return <Typography color="error">Customer not found.</Typography>;
  }

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Typography variant="h5" sx={{ fontWeight: 600 }}>
        {customer.name}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {customer.email}
        {customer.phone && ` · ${customer.phone}`}
      </Typography>

      <Typography variant="h6" sx={{ mb: 1.5 }}>
        Orders
      </Typography>

      {ordersLoading && <Typography color="text.secondary">Loading…</Typography>}

      {!ordersLoading && orders?.length === 0 && (
        <Typography color="text.secondary">No orders yet.</Typography>
      )}

      {!ordersLoading && orders && orders.length > 0 && (
        <Stack spacing={1.5}>
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </Stack>
      )}
    </Box>
  );
}
