import React, { useEffect, useState } from 'react';
import {
  Typography,
  Box,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { usersAPI, invitesAPI } from '../services/api';

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [users, setUsers] = useState([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviting, setInviting] = useState(false);

  const loadUsers = async () => {
    try {
      const res = await usersAPI.list();
      setUsers(res.data || []);
    } catch (_) {}
  };

  useEffect(() => { if (isAdmin) loadUsers(); }, [isAdmin]);

  const openInvite = () => setInviteOpen(true);
  const closeInvite = () => { setInviteOpen(false); setInviteEmail(''); setInviteRole('user'); };
  const createInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    try {
      await invitesAPI.create(inviteEmail, inviteRole);
      closeInvite();
    } finally { setInviting(false); }
  };

  return (
    <Box className="content-section">
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      {/* Top row: Notifications, Security, Account */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Notifications
              </Typography>
              <FormControlLabel control={<Switch defaultChecked />} label="Email notifications" />
              <br />
              <FormControlLabel control={<Switch />} label="SMS notifications" />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Security
              </Typography>
              <Button variant="outlined" sx={{ mr: 2 }}>Change Password</Button>
              <Button variant="outlined">Enable 2FA</Button>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Account
              </Typography>
              <Button variant="outlined" color="error">Delete Account</Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* User Management section at bottom */}
      {isAdmin && (
        <Card>
          <CardContent>
            <Box className="page-header">
              <Typography variant="h6">User Management</Typography>
              <Box>
                <Button variant="outlined" onClick={loadUsers} sx={{ mr: 2 }}>Refresh</Button>
                <Button onClick={openInvite}>Invite User</Button>
              </Box>
            </Box>
            <TableContainer component={Paper} className="full-width-table">
              <Table stickyHeader sx={{ tableLayout: 'fixed', width: '100%', minWidth: 0 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id || u.email}>
                      <TableCell>{u.first_name ? `${u.first_name} ${u.last_name || ''}` : '-'}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{u.role}</TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        <Typography color="text.secondary">No users yet.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onClose={closeInvite} fullWidth maxWidth="sm">
        <DialogTitle>Invite User</DialogTitle>
        <DialogContent>
          <TextField fullWidth margin="normal" label="Email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
          <TextField fullWidth select margin="normal" label="Role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
            <MenuItem value="user">User</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={closeInvite}>Cancel</Button>
          <Button onClick={createInvite} disabled={inviting}>Send Invite</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}