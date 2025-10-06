import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody, Select, MenuItem, Button, Stack } from '@mui/material';
import { usersAPI } from '../services/api';

export default function Users() {
  const [users, setUsers] = useState([]);

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

  const remove = async (id) => {
    await usersAPI.delete(id);
    await loadUsers();
  };

  return (
    <Box className="content-section">
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
                    <Button size="small" color="error" onClick={() => remove(u.id)}>Delete</Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
