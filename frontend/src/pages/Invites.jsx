import React, { useEffect, useState } from 'react';
import { Box, Typography, Card, CardContent, Grid, TextField, Button, MenuItem, Table, TableHead, TableRow, TableCell, TableBody, Paper } from '@mui/material';
import { invitesAPI } from '../services/api';

export default function Invites() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadInvites = async () => {
    try {
      const res = await invitesAPI.list();
      setInvites(res.data || []);
    } catch (_) {}
  };

  useEffect(() => { loadInvites(); }, []);

  const createInvite = async () => {
    if (!email) return;
    setLoading(true);
    try {
      await invitesAPI.create(email, role);
      setEmail('');
      setRole('user');
      await loadInvites();
    } finally {
      setLoading(false);
    }
  };

  const revokeInvite = async (id) => {
    await invitesAPI.revoke(id);
    await loadInvites();
  };

  return (
    <Box className="content-section">
      <Typography variant="h4" gutterBottom>Invites</Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Create Invite</Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField fullWidth label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField select fullWidth label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
                <MenuItem value="user">User</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs="auto">
              <Button variant="contained" onClick={createInvite} disabled={loading}>Create</Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Code</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invites.map((i) => (
              <TableRow key={i.id || i.code}>
                <TableCell>{i.email}</TableCell>
                <TableCell>{i.role}</TableCell>
                <TableCell>{i.code}</TableCell>
                <TableCell>
                  <Button size="small" color="error" onClick={() => revokeInvite(i.id || i.code)}>Revoke</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
