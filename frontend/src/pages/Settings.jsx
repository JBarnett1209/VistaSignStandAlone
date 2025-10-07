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
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [invites, setInvites] = useState([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviting, setInviting] = useState(false);

  const loadUsers = async () => {
    setUsersLoading(true);
    setUsersError('');
    try {
      const [usersRes, invitesRes] = await Promise.all([
        usersAPI.list(),
        invitesAPI.list()
      ]);
      const data = usersRes?.data;
      const normalized = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.results)
            ? data.results
            : Array.isArray(data?.users)
              ? data.users
              : [];
      // Normalize invites
      const invitesData = invitesRes?.data;
      const normalizedInvites = Array.isArray(invitesData?.invites)
        ? invitesData.invites
        : Array.isArray(invitesData)
          ? invitesData
          : [];
      setUsers(normalized);
      setInvites(normalizedInvites);
    } catch (e) {
      setUsers([]);
      setInvites([]);
      setUsersError('Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => { if (isAdmin) loadUsers(); }, [isAdmin]);

  const openInvite = () => setInviteOpen(true);
  const closeInvite = () => { setInviteOpen(false); setInviteEmail(''); setInviteRole('user'); };
  const createInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    try {
      const res = await invitesAPI.create(inviteEmail, inviteRole);
      // Optimistically add to invites list
      const newInvite = res?.data || { email: inviteEmail, role: inviteRole, status: 'invited' };
      setInvites((prev) => [{
        id: newInvite.id || `temp-${Date.now()}`,
        email: newInvite.email || inviteEmail,
        role: newInvite.role || inviteRole,
        status: 'invited'
      }, ...prev]);
      // Refresh users/invites from server
      loadUsers();
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
                    <TableCell>Name / Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* Invited entries first */}
                  {Array.isArray(invites) && invites.map((i) => (
                    <TableRow key={`invite-${i.id}`}>
                      <TableCell>{i.email}</TableCell>
                      <TableCell>{i.role}</TableCell>
                      <TableCell>Invited</TableCell>
                    </TableRow>
                  ))}
                  {/* Existing users */}
                  {Array.isArray(users) && users.map((u) => (
                    <TableRow key={u.id || u.email}>
                      <TableCell>{u.first_name ? `${u.first_name} ${u.last_name || ''}` : u.email}</TableCell>
                      <TableCell>{u.role}</TableCell>
                      <TableCell>{u.status || (u.is_active ? 'active' : 'inactive')}</TableCell>
                    </TableRow>
                  ))}
                  {!usersLoading && (!Array.isArray(users) || users.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        <Typography color="text.secondary">{usersError || 'No users yet.'}</Typography>
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