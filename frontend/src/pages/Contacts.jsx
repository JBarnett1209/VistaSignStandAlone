import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography, Box, Button, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, CircularProgress, InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon,
} from '@mui/icons-material';
import { contactsAPI } from '../services/api';

const EMPTY = { name: '', email: '', company: '' };

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState({ open: false, contact: null, form: EMPTY });

  const load = useCallback(async (q) => {
    try {
      setLoading(true);
      const { data } = await contactsAPI.list(q);
      setContacts(data.contacts || []);
      setError(null);
    } catch (e) {
      setError('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setTimeout(() => load(search), 300);
    return () => clearTimeout(t);
  }, [search, load]);

  const openNew = () => setDialog({ open: true, contact: null, form: EMPTY });
  const openEdit = (c) => setDialog({ open: true, contact: c, form: { name: c.name, email: c.email, company: c.company || '' } });
  const closeDialog = () => setDialog({ open: false, contact: null, form: EMPTY });

  const save = async () => {
    const { contact, form } = dialog;
    if (!form.name.trim() || !form.email.trim()) { setError('Name and email are required'); return; }
    try {
      if (contact) await contactsAPI.update(contact.id, form);
      else await contactsAPI.create(form);
      closeDialog();
      await load(search);
      setError(null);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save contact');
    }
  };

  const remove = async (id) => {
    try { await contactsAPI.delete(id); await load(search); }
    catch (e) { setError('Failed to delete contact'); }
  };

  return (
    <Box className="content-section" sx={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Contacts</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>Add Contact</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <TextField
        size="small" placeholder="Search by name or email" value={search}
        onChange={(e) => setSearch(e.target.value)} sx={{ mb: 2, maxWidth: 360 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
      />

      <TableContainer component={Paper} elevation={0} square>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Company</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} align="center"><CircularProgress /></TableCell></TableRow>
            ) : contacts.length === 0 ? (
              <TableRow><TableCell colSpan={4} align="center">
                <Typography color="text.secondary">No contacts yet. Add one, or they’ll be saved automatically when you send for signature.</Typography>
              </TableCell></TableRow>
            ) : contacts.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell>{c.name}</TableCell>
                <TableCell>{c.email}</TableCell>
                <TableCell>{c.company || '—'}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" title="Edit" onClick={() => openEdit(c)}><EditIcon /></IconButton>
                  <IconButton size="small" title="Delete" color="error" onClick={() => remove(c.id)}><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialog.open} onClose={closeDialog} maxWidth="xs" fullWidth>
        <DialogTitle>{dialog.contact ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField label="Name" value={dialog.form.name} required
            onChange={(e) => setDialog((d) => ({ ...d, form: { ...d.form, name: e.target.value } }))} />
          <TextField label="Email" type="email" value={dialog.form.email} required
            onChange={(e) => setDialog((d) => ({ ...d, form: { ...d.form, email: e.target.value } }))} />
          <TextField label="Company" value={dialog.form.company}
            onChange={(e) => setDialog((d) => ({ ...d, form: { ...d.form, company: e.target.value } }))} />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button variant="contained" onClick={save}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
