import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody, Select, MenuItem, Button, Stack } from '@mui/material';
import { usersAPI } from '../services/api';
import ConfirmationDialog from '../components/ConfirmationDialog';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, userId: null, userEmail: '' });

  const loadUsers = async () => {
    try {
      const res = await usersAPI.list();
      setUsers(res.data?.users || res.data || []);
    } catch (_) {}
  };

  useEffect(() => { loadUsers(); }, []);

  const changeRole = async (id, role) => {
    await usersAPI.updateRole(id, role);
    await loadUsers();
  };

  const deactivate = async (id) => {
    await usersAPI.deactivate(id);
    await loadUsers();
  };

  const reactivate = async (id) => {
    await usersAPI.reactivate(id);
    await loadUsers();
  };

  const handleDeleteUser = (id, email) => {
    setDeleteDialog({
      open: true,
      userId: id,
      userEmail: email
    });
  };

  const confirmDeleteUser = async () => {
    try {
      await usersAPI.delete(deleteDialog.userId);
      await loadUsers();
      setDeleteDialog({ open: false, userId: null, userEmail: '' });
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  return (
    <Box className="content-section" sx={{ 
      width: '100%', 
      height: '100%',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflowX: 'hidden'
    }}>
      <Typography variant="h4" gutterBottom>Users</Typography>
      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>First</TableCell>
              <TableCell>Last</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.first_name}</TableCell>
                <TableCell>{u.last_name}</TableCell>
                <TableCell>
                  <Select size="small" value={u.role} onChange={(e) => changeRole(u.id, e.target.value)}>
                    <MenuItem value="user">User</MenuItem>
                    <MenuItem value="admin">Admin</MenuItem>
                  </Select>
                </TableCell>
                <TableCell>{u.status}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" onClick={() => deactivate(u.id)}>Deactivate</Button>
                    <Button size="small" onClick={() => reactivate(u.id)}>Enable</Button>
                    <Button size="small" color="error" onClick={() => handleDeleteUser(u.id, u.email)}>Delete</Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, userId: null, userEmail: '' })}
        onConfirm={confirmDeleteUser}
        title="Delete User"
        message={`Are you sure you want to delete user "${deleteDialog.userEmail}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </Box>
  );
}
