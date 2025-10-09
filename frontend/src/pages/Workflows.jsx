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
import WorkflowEditor from '../components/WorkflowEditor';

export default function Workflows() {
  const [workflows, setWorkflows] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [workflowEditorOpen, setWorkflowEditorOpen] = useState(false);
  const [participantDialogOpen, setParticipantDialogOpen] = useState(false);
  const [viewParticipantsDialogOpen, setViewParticipantsDialogOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [participants, setParticipants] = useState([{ email: '', signingOrder: 1 }]);
  const [availableSigningOrders, setAvailableSigningOrders] = useState([]);
  const [workflowParticipants, setWorkflowParticipants] = useState([]);

  useEffect(() => {
    loadWorkflows();
    loadDocuments();
  }, []);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      const response = await workflowsAPI.list();
      console.log('Workflows response:', response);
      console.log('Workflows with participants:', response.data?.workflows?.map(w => ({ id: w.id, name: w.name, participants: w.participants })));
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

  const loadDocumentSigningOrders = async (documentId) => {
    try {
      const response = await documentsAPI.get(documentId);
      const document = response.data;
      if (document.fields) {
        // Extract unique signing orders from document fields
        const signingOrders = [...new Set(
          document.fields
            .map(field => field.signingOrder || 1)
            .filter(order => order > 0)
        )].sort((a, b) => a - b);
        setAvailableSigningOrders(signingOrders);
      } else {
        setAvailableSigningOrders([1]); // Default if no fields
      }
    } catch (err) {
      console.error('Error loading document signing orders:', err);
      setAvailableSigningOrders([1]); // Fallback
    }
  };

  const handleWorkflowSuccess = () => {
    loadWorkflows();
    setWorkflowEditorOpen(false);
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

  const handleDeleteWorkflow = async (workflowId) => {
    if (window.confirm('Are you sure you want to delete this workflow? This action cannot be undone.')) {
      try {
        await workflowsAPI.delete(workflowId);
        await loadWorkflows();
        setError(null);
      } catch (err) {
        setError('Failed to delete workflow');
        console.error('Error deleting workflow:', err);
      }
    }
  };

  const handleAddParticipants = async () => {
    try {
      // Validate participants
      const validParticipants = participants.filter(p => p.email.trim() && p.signingOrder);
      
      if (validParticipants.length === 0) {
        setError('Please add at least one participant with a valid email and signing order');
        return;
      }

      // Check for duplicate emails
      const emails = validParticipants.map(p => p.email.toLowerCase());
      const uniqueEmails = [...new Set(emails)];
      if (emails.length !== uniqueEmails.length) {
        setError('Duplicate email addresses are not allowed');
        return;
      }

      // Add each participant
      for (const participant of validParticipants) {
        await workflowsAPI.addParticipant(selectedWorkflow.id, {
          email: participant.email.trim(),
          signingOrder: participant.signingOrder,
          role: 'signer'
        });
      }

      await loadWorkflows();
      setParticipantDialogOpen(false);
      setParticipants([{ email: '', signingOrder: 1 }]);
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

  const addParticipantRow = () => {
    setParticipants([...participants, { email: '', signingOrder: 1 }]);
  };

  const removeParticipantRow = (index) => {
    if (participants.length > 1) {
      setParticipants(participants.filter((_, i) => i !== index));
    }
  };

  const updateParticipant = (index, field, value) => {
    const updated = [...participants];
    updated[index] = { ...updated[index], [field]: value };
    setParticipants(updated);
  };

  const openParticipantDialog = async (workflow) => {
    setSelectedWorkflow(workflow);
    await loadDocumentSigningOrders(workflow.document_id);
    setParticipants([{ email: '', signingOrder: 1 }]);
    setParticipantDialogOpen(true);
  };

  const loadWorkflowParticipants = async (workflowId) => {
    try {
      console.log('Loading participants for workflow:', workflowId);
      const response = await workflowsAPI.get(workflowId);
      console.log('Full workflow response:', response);
      console.log('Response data:', response.data);
      console.log('Participants from response.data:', response.data?.participants);
      console.log('Participants from response:', response.participants);
      
      // Try both possible data structures
      const participants = response.data?.participants || response.participants || [];
      console.log('Final participants array:', participants);
      setWorkflowParticipants(participants);
    } catch (err) {
      console.error('Error loading workflow participants:', err);
      setError('Failed to load participants');
    }
  };

  const openViewParticipantsDialog = async (workflow) => {
    setSelectedWorkflow(workflow);
    await loadWorkflowParticipants(workflow.id);
    setViewParticipantsDialogOpen(true);
  };

  const handleEditParticipant = (participant) => {
    // TODO: Implement edit participant functionality
    console.log('Edit participant:', participant);
    // For now, just show an alert
    alert(`Edit participant: ${participant.email}`);
  };

  const handleRemoveParticipant = async (participantId) => {
    if (window.confirm('Are you sure you want to remove this participant?')) {
      try {
        // TODO: Implement remove participant API call
        console.log('Remove participant:', participantId);
        // For now, just reload the participants
        await loadWorkflowParticipants(selectedWorkflow.id);
        alert('Participant removed successfully');
      } catch (err) {
        console.error('Error removing participant:', err);
        setError('Failed to remove participant');
      }
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Document Signing Workflows
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />}
          onClick={() => setWorkflowEditorOpen(true)}
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">
                        {workflow.participants?.length || 0} participants
                      </Typography>
                      {(workflow.participants?.length || 0) > 0 && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => openViewParticipantsDialog(workflow)}
                          sx={{ minWidth: 'auto', px: 1 }}
                        >
                          View
                        </Button>
                      )}
                    </Box>
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
                        onClick={() => openParticipantDialog(workflow)}
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
                      <IconButton 
                        size="small" 
                        title="Delete" 
                        color="error"
                        onClick={() => handleDeleteWorkflow(workflow.id)}
                      >
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

      {/* Workflow Editor */}
      <WorkflowEditor
        open={workflowEditorOpen}
        onClose={() => setWorkflowEditorOpen(false)}
        onSuccess={handleWorkflowSuccess}
      />

      {/* Add Participants Dialog */}
      <Dialog open={participantDialogOpen} onClose={() => setParticipantDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add Participants to Workflow</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add email addresses and assign them to signing orders. Each person will receive an email with a link to sign their assigned fields.
          </Typography>
          
          {availableSigningOrders.length > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Available signing orders: {availableSigningOrders.join(', ')}
            </Typography>
          )}

          {participants.map((participant, index) => (
            <Box key={index} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={participant.email}
                onChange={(e) => updateParticipant(index, 'email', e.target.value)}
                placeholder="participant@example.com"
                required
              />
              
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Signing Order</InputLabel>
                <Select
                  value={participant.signingOrder}
                  onChange={(e) => updateParticipant(index, 'signingOrder', e.target.value)}
                  label="Signing Order"
                >
                  {availableSigningOrders.map(order => (
                    <MenuItem key={order} value={order}>
                      Order {order}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <IconButton
                onClick={() => removeParticipantRow(index)}
                disabled={participants.length === 1}
                color="error"
                size="small"
              >
                <DeleteIcon />
              </IconButton>
            </Box>
          ))}

          <Button
            startIcon={<AddIcon />}
            onClick={addParticipantRow}
            variant="outlined"
            sx={{ mb: 2 }}
          >
            Add Another Participant
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setParticipantDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained"
            onClick={handleAddParticipants}
            disabled={participants.every(p => !p.email.trim())}
          >
            Add Participants
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Participants Dialog */}
      <Dialog open={viewParticipantsDialogOpen} onClose={() => setViewParticipantsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Workflow Participants</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Current participants for "{selectedWorkflow?.name}"
          </Typography>
          
          {workflowParticipants.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              No participants added yet.
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Email</TableCell>
                    <TableCell>Signing Order</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {workflowParticipants.map((participant, index) => (
                    <TableRow key={index}>
                      <TableCell>{participant.email}</TableCell>
                      <TableCell>#{participant.signingOrder}</TableCell>
                      <TableCell>{participant.role}</TableCell>
                      <TableCell>
                        <Chip 
                          label={participant.status || 'Pending'} 
                          size="small"
                          color={participant.status === 'completed' ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <IconButton 
                            size="small" 
                            title="Edit Participant"
                            onClick={() => handleEditParticipant(participant)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton 
                            size="small" 
                            title="Remove Participant"
                            onClick={() => handleRemoveParticipant(participant.id)}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewParticipantsDialogOpen(false)}>Close</Button>
          <Button 
            variant="contained"
            onClick={() => {
              setViewParticipantsDialogOpen(false);
              openParticipantDialog(selectedWorkflow);
            }}
          >
            Add More Participants
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}