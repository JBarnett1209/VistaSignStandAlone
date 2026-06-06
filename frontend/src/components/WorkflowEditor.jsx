import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  IconButton,
  Alert,
  CircularProgress,
  Grid,
  Chip,
  Autocomplete
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { workflowsAPI, documentsAPI, contactsAPI } from '../services/api';

export default function WorkflowEditor({ 
  open, 
  onClose, 
  onSuccess,
  initialWorkflow = null, // For editing existing workflows
  initialDocument = null  // For creating workflow from document
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [availableSigningOrders, setAvailableSigningOrders] = useState([]);
  const [participants, setParticipants] = useState([{ email: '', signingOrder: 1 }]);
  const [contacts, setContacts] = useState([]);
  
  const [workflowData, setWorkflowData] = useState({
    name: '',
    description: '',
    document_id: ''
  });

  useEffect(() => {
    if (open) {
      loadDocuments();
      loadContacts();
      if (initialDocument) {
        setWorkflowData({
          name: `Workflow for ${initialDocument.title}`,
          description: '',
          document_id: initialDocument.id
        });
        loadDocumentSigningOrders(initialDocument.id);
      } else if (initialWorkflow) {
        setWorkflowData({
          name: initialWorkflow.name,
          description: initialWorkflow.description || '',
          document_id: initialWorkflow.document_id
        });
        loadDocumentSigningOrders(initialWorkflow.document_id);
        // Load existing participants for editing
        if (initialWorkflow.participants && initialWorkflow.participants.length > 0) {
          setParticipants(initialWorkflow.participants.map(p => ({
            email: p.email,
            signingOrder: p.signingOrder
          })));
        } else {
          setParticipants([{ email: '', signingOrder: 1 }]);
        }
      } else {
        setWorkflowData({ name: '', description: '', document_id: '' });
        setParticipants([{ email: '', signingOrder: 1 }]);
      }
    }
  }, [open, initialDocument, initialWorkflow]);

  const loadDocuments = async () => {
    try {
      const response = await documentsAPI.list();
      setDocuments(response.data.documents || []);
    } catch (err) {
      console.error('Error loading documents:', err);
    }
  };

  const loadContacts = async () => {
    try {
      const response = await contactsAPI.list();
      setContacts(response.data.contacts || []);
    } catch (err) {
      console.error('Error loading contacts:', err);
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

  const handleDocumentChange = (documentId) => {
    setWorkflowData({ ...workflowData, document_id: documentId });
    if (documentId) {
      loadDocumentSigningOrders(documentId);
    } else {
      setAvailableSigningOrders([1]);
    }
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

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validate workflow data
      if (!workflowData.name.trim()) {
        setError('Workflow name is required');
        return;
      }
      if (!workflowData.document_id) {
        setError('Please select a document');
        return;
      }

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

      let workflow;
      
      if (initialWorkflow) {
        // Update existing workflow
        const updateData = {
          ...workflowData,
          workflow_data: initialWorkflow.workflow_data || {
            steps: [],
            participants: [],
            settings: {
              email_notifications: true,
              reminder_frequency: 'daily'
            }
          }
        };
        workflow = await workflowsAPI.update(initialWorkflow.id, updateData);
      } else {
        // Create new workflow
        const newWorkflowData = {
          ...workflowData,
          workflow_data: {
            steps: [],
            participants: [],
            settings: {
              email_notifications: true,
              reminder_frequency: 'daily'
            }
          }
        };
        workflow = await workflowsAPI.create(newWorkflowData);
      }

      // Handle participants
      if (initialWorkflow) {
        // For existing workflows, remove all existing participants first
        if (initialWorkflow.participants && initialWorkflow.participants.length > 0) {
          for (const existingParticipant of initialWorkflow.participants) {
            await workflowsAPI.removeParticipant(workflow.data.id, existingParticipant.id);
          }
        }
      }
      
      // Add new participants
      for (const participant of validParticipants) {
        await workflowsAPI.addParticipant(workflow.data.id, {
          email: participant.email.trim(),
          signingOrder: participant.signingOrder,
          role: 'signer'
        });
      }

      // Send workflow if requested
      if (!initialWorkflow) {
        await workflowsAPI.send(workflow.data.id);
      }

      onSuccess && onSuccess(workflow.data);
      handleClose();
    } catch (err) {
      setError('Failed to save workflow');
      console.error('Error saving workflow:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setWorkflowData({ name: '', description: '', document_id: '' });
    setParticipants([{ email: '', signingOrder: 1 }]);
    setAvailableSigningOrders([]);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          {initialWorkflow ? 'Edit Workflow' : 'Create Workflow'}
        </Typography>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Workflow Name"
              value={workflowData.name}
              onChange={(e) => setWorkflowData({ ...workflowData, name: e.target.value })}
              required
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              value={workflowData.description}
              onChange={(e) => setWorkflowData({ ...workflowData, description: e.target.value })}
              multiline
              rows={3}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth required>
              <InputLabel>Document</InputLabel>
              <Select
                value={workflowData.document_id}
                onChange={(e) => handleDocumentChange(e.target.value)}
                label="Document"
                disabled={!!initialDocument} // Disable if document is pre-selected
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

        {workflowData.document_id && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Add Participants
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Add email addresses and assign them to signing orders. Each person will receive an email with a link to sign their assigned fields.
            </Typography>
            
            {availableSigningOrders.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Available signing orders:
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {availableSigningOrders.map(order => (
                    <Chip key={order} label={`Order ${order}`} size="small" color="primary" variant="outlined" />
                  ))}
                </Box>
              </Box>
            )}

            {participants.map((participant, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                <Autocomplete
                  freeSolo
                  fullWidth
                  options={contacts}
                  value={participant.email}
                  getOptionLabel={(o) => (typeof o === 'string' ? o : o.email)}
                  filterOptions={(opts, state) => {
                    const q = (state.inputValue || '').toLowerCase();
                    return q
                      ? opts.filter((o) => o.email.toLowerCase().includes(q) || (o.name || '').toLowerCase().includes(q))
                      : opts;
                  }}
                  onChange={(e, val) => updateParticipant(index, 'email', typeof val === 'string' ? val : (val?.email || ''))}
                  onInputChange={(e, val) => updateParticipant(index, 'email', val)}
                  renderOption={(props, o) => (
                    <li {...props} key={o.id}>
                      <Box>
                        <Typography variant="body2">{o.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{o.email}{o.company ? ` · ${o.company}` : ''}</Typography>
                      </Box>
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField {...params} label="Email Address" placeholder="participant@example.com" required />
                  )}
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
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button 
          variant="contained"
          onClick={handleSave}
          disabled={loading || !workflowData.name.trim() || !workflowData.document_id || participants.every(p => !p.email.trim())}
        >
          {loading ? <CircularProgress size={20} /> : (initialWorkflow ? 'Update Workflow' : 'Create & Send Workflow')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
