import React, { useState, useEffect } from 'react';
import {
  Typography, Box, Button, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Paper, Chip, IconButton, Dialog, DialogTitle, 
  DialogContent, DialogActions, TextField, FormControl, InputLabel, 
  Select, MenuItem, Alert, CircularProgress, Grid
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  Visibility as ViewIcon,
  PersonAdd as PersonAddIcon
} from '@mui/icons-material';
import { workflowsAPI, documentsAPI } from '../services/api';

export default function Workflows() {
  const [workflows, setWorkflows] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [participantDialogOpen, setParticipantDialogOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [participantEmails, setParticipantEmails] = useState('');
  const [newWorkflow, setNewWorkflow] = useState({
    name: '',
    description: '',
    document_id: ''
  });

  useEffect(() => {
    loadWorkflows();
    loadDocuments();
  }, []);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      const response = await workflowsAPI.list();
      setWorkflows(response.data.workflows || []);
    } catch (err) {
      setError('Failed to load workflows');
      console.error('Error loading workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async () => {
    try {
      const response = await documentsAPI.list();
      setDocuments(response.data.documents || []);
    } catch (err) {
      console.error('Error loading documents:', err);
    }
  };

  const handleCreateWorkflow = async () => {
    try {
      const workflowData = {
        ...newWorkflow,
        workflow_data: {
          steps: [],
          participants: [],
          settings: {
            email_notifications: true,
            reminder_frequency: 'daily'
          }
        }
      };
      
      await workflowsAPI.create(workflowData);
      await loadWorkflows();
      setCreateDialogOpen(false);
      setNewWorkflow({ name: '', description: '', document_id: '' });
    } catch (err) {
      setError('Failed to create workflow');
      console.error('Error creating workflow:', err);
    }
  };

  const handleSendWorkflow = async (workflowId) => {
    try {
      await workflowsAPI.send(workflowId);
      await loadWorkflows();
      setError(null);
    } catch (err) {
      setError('Failed to send workflow');
      console.error('Error sending workflow:', err);
    }
  };

  const handleAddParticipants = async () => {
    try {
      if (!participantEmails.trim()) {
        setError('Please enter at least one email address');
        return;
      }

      const emails = participantEmails
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0);

      if (emails.length === 0) {
        setError('Please enter valid email addresses');
        return;
      }

      // Add each participant
      for (const email of emails) {
        await workflowsAPI.addParticipant(selectedWorkflow.id, {
          email: email,
          role: 'signer'
        });
      }

      await loadWorkflows();
      setParticipantDialogOpen(false);
      setParticipantEmails('');
      setSelectedWorkflow(null);
      setError(null);
    } catch (err) {
      setError('Failed to add participants');
      console.error('Error adding participants:', err);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return 'default';
      case 'active': return 'primary';
      case 'completed': return 'success';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Document Signing Workflows
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create Workflow
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      <TableContainer component={Paper} elevation={0} square className="full-width-table" sx={{ maxWidth: 'none' }}>
        <Table stickyHeader sx={{ width: '100%', tableLayout: 'fixed', minWidth: 0 }}>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Document</TableCell>
              <TableCell>Participants</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : workflows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="text.secondary">
                    No workflows yet. Create your first workflow to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              workflows.map((workflow) => (
                <TableRow key={workflow.id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="body1" fontWeight="medium">
                        {workflow.name}
                      </Typography>
                      {workflow.description && (
                        <Typography variant="body2" color="text.secondary">
                          {workflow.description}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={workflow.status}
                      color={getStatusColor(workflow.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {documents.find(doc => doc.id === workflow.document_id)?.title || 'Unknown Document'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {workflow.participants?.length || 0} participants
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(workflow.created_at)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton size="small" title="View Details">
                        <ViewIcon />
                      </IconButton>
                      <IconButton 
                        size="small" 
                        title="Add Participants"
                        onClick={() => {
                          setSelectedWorkflow(workflow);
                          setParticipantDialogOpen(true);
                        }}
                      >
                        <PersonAddIcon />
                      </IconButton>
                      {workflow.status === 'draft' && (
                        <IconButton 
                          size="small" 
                          title="Send for Signing"
                          onClick={() => handleSendWorkflow(workflow.id)}
                        >
                          <SendIcon />
                        </IconButton>
                      )}
                      <IconButton size="small" title="Edit">
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" title="Delete" color="error">
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Workflow Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Workflow</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Workflow Name"
                value={newWorkflow.name}
                onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={newWorkflow.description}
                onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
                multiline
                rows={3}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>Document</InputLabel>
                <Select
                  value={newWorkflow.document_id}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, document_id: e.target.value })}
                  label="Document"
                >
                  {documents.map((doc) => (
                    <MenuItem key={doc.id} value={doc.id}>
                      {doc.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateWorkflow}
            variant="contained"
            disabled={!newWorkflow.name || !newWorkflow.document_id}
          >
            Create Workflow
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Participants Dialog */}
      <Dialog open={participantDialogOpen} onClose={() => setParticipantDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add Participants to Workflow</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add email addresses of people who need to sign this document. They will receive an email with a link to sign.
          </Typography>
          <TextField
            fullWidth
            label="Email Addresses"
            placeholder="Enter email addresses separated by commas"
            multiline
            rows={4}
            value={participantEmails}
            onChange={(e) => setParticipantEmails(e.target.value)}
            helperText="Example: john@example.com, jane@example.com"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setParticipantDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained"
            onClick={handleAddParticipants}
            disabled={!participantEmails.trim()}
          >
            Add Participants
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}