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
  MenuItem,
  Checkbox,
  Chip,
  Tooltip,
  IconButton
} from '@mui/material';
import { Delete as DeleteIcon, Block as BlockIcon, CheckCircle as AllowIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { usersAPI, invitesAPI } from '../services/api';
import SignatureManager from '../components/SignatureManager';
import ConfirmationDialog from '../components/ConfirmationDialog';

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
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkActionDialog, setBulkActionDialog] = useState({ 
    open: false, 
    action: null, 
    count: 0 
  });

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

  // Multi-selection handlers
  const handleSelectAll = (checked) => {
    if (checked) {
      const allIds = new Set([
        ...users.map(u => u.id),
        ...invites.map(i => `invite-${i.id}`)
      ]);
      setSelectedUsers(allIds);
    } else {
      setSelectedUsers(new Set());
    }
  };

  const handleSelectUser = (userId, checked) => {
    const newSelected = new Set(selectedUsers);
    if (checked) {
      newSelected.add(userId);
    } else {
      newSelected.delete(userId);
    }
    setSelectedUsers(newSelected);
  };

  const isAllSelected = () => {
    const totalItems = users.length + invites.length;
    return totalItems > 0 && selectedUsers.size === totalItems;
  };

  const isIndeterminate = () => {
    return selectedUsers.size > 0 && selectedUsers.size < (users.length + invites.length);
  };

  // Bulk actions
  const handleBulkAction = (action) => {
    if (selectedUsers.size === 0) return;
    
    setBulkActionDialog({
      open: true,
      action,
      count: selectedUsers.size
    });
  };

  const confirmBulkAction = async () => {
    const { action } = bulkActionDialog;
    setBulkActionLoading(true);
    setBulkActionDialog({ open: false, action: null, count: 0 });
    
    try {
      const selectedArray = Array.from(selectedUsers);
      const userIds = selectedArray.filter(id => !id.startsWith('invite-'));
      const inviteIds = selectedArray.filter(id => id.startsWith('invite-')).map(id => id.replace('invite-', ''));
      
      // Process users
      if (userIds.length > 0) {
        const promises = userIds.map(id => {
          if (action === 'deactivate') {
            return usersAPI.deactivate(id);
          } else if (action === 'activate') {
            return usersAPI.reactivate(id);
          } else if (action === 'delete') {
            return usersAPI.delete(id);
          }
          return Promise.resolve();
        });
        await Promise.all(promises);
      }
      
      // Process invites
      if (inviteIds.length > 0 && action === 'delete') {
        const promises = inviteIds.map(id => invitesAPI.revoke(id));
        await Promise.all(promises);
      }
      
      // Refresh data
      await loadUsers();
      setSelectedUsers(new Set());
    } catch (error) {
      console.error('Bulk action failed:', error);
    } finally {
      setBulkActionLoading(false);
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
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      {/* Signature Management */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <SignatureManager />
        </CardContent>
      </Card>

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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {selectedUsers.size > 0 && (
                  <Chip 
                    label={`${selectedUsers.size} selected`} 
                    color="primary" 
                    size="small"
                    onDelete={() => setSelectedUsers(new Set())}
                  />
                )}
                <Button variant="outlined" onClick={loadUsers} sx={{ mr: 2 }}>Refresh</Button>
                <Button onClick={openInvite}>Invite User</Button>
              </Box>
            </Box>
            
            {/* Bulk Actions */}
            {selectedUsers.size > 0 && (
              <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Bulk Actions:
                </Typography>
                <Tooltip title="Activate selected users">
                  <IconButton 
                    size="small" 
                    color="success"
                    onClick={() => handleBulkAction('activate')}
                    disabled={bulkActionLoading}
                  >
                    <AllowIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Deactivate selected users">
                  <IconButton 
                    size="small" 
                    color="warning"
                    onClick={() => handleBulkAction('deactivate')}
                    disabled={bulkActionLoading}
                  >
                    <BlockIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete selected users/invites">
                  <IconButton 
                    size="small" 
                    color="error"
                    onClick={() => handleBulkAction('delete')}
                    disabled={bulkActionLoading}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
            <TableContainer component={Paper} className="full-width-table">
              <Table stickyHeader sx={{ tableLayout: 'fixed', width: '100%', minWidth: 0 }}>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isAllSelected()}
                        indeterminate={isIndeterminate()}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </TableCell>
                    <TableCell>Name / Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* Invited entries first */}
                  {Array.isArray(invites) && invites.map((i) => (
                    <TableRow key={`invite-${i.id}`}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedUsers.has(`invite-${i.id}`)}
                          onChange={(e) => handleSelectUser(`invite-${i.id}`, e.target.checked)}
                        />
                      </TableCell>
                      <TableCell>{i.email}</TableCell>
                      <TableCell>{i.role}</TableCell>
                      <TableCell>Invited</TableCell>
                    </TableRow>
                  ))}
                  {/* Existing users */}
                  {Array.isArray(users) && users.map((u) => (
                    <TableRow key={u.id || u.email}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedUsers.has(u.id)}
                          onChange={(e) => handleSelectUser(u.id, e.target.checked)}
                        />
                      </TableCell>
                      <TableCell>{u.first_name ? `${u.first_name} ${u.last_name || ''}` : u.email}</TableCell>
                      <TableCell>{u.role}</TableCell>
                      <TableCell>{u.status || (u.is_active ? 'active' : 'inactive')}</TableCell>
                    </TableRow>
                  ))}
                  {!usersLoading && (!Array.isArray(users) || users.length === 0) && (!Array.isArray(invites) || invites.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
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

      {/* Bulk Action Confirmation Dialog */}
      <ConfirmationDialog
        open={bulkActionDialog.open}
        onClose={() => setBulkActionDialog({ open: false, action: null, count: 0 })}
        onConfirm={confirmBulkAction}
        title={`${bulkActionDialog.action === 'delete' ? 'Delete' : 
                bulkActionDialog.action === 'deactivate' ? 'Deactivate' : 
                bulkActionDialog.action === 'activate' ? 'Activate' : 'Process'} ${bulkActionDialog.count} Item${bulkActionDialog.count > 1 ? 's' : ''}`}
        message={`Are you sure you want to ${bulkActionDialog.action} ${bulkActionDialog.count} selected item${bulkActionDialog.count > 1 ? 's' : ''}? This action cannot be undone.`}
        confirmText={bulkActionDialog.action === 'delete' ? 'Delete' : 
                    bulkActionDialog.action === 'deactivate' ? 'Deactivate' : 
                    bulkActionDialog.action === 'activate' ? 'Activate' : 'Confirm'}
        cancelText="Cancel"
        type={bulkActionDialog.action === 'delete' ? 'danger' : 'warning'}
        loading={bulkActionLoading}
      />
    </Box>
  );
}