import React, { useState, useEffect } from 'react';
import {
  Typography, Box, Button, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Paper, Chip, IconButton, Dialog, DialogTitle, 
  DialogContent, DialogActions, Alert, CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Send as SendIcon
} from '@mui/icons-material';
import { workflowsAPI, documentsAPI } from '../services/api';
import WorkflowEditor from '../components/WorkflowEditor';

export default function Workflows() {
  const [workflows, setWorkflows] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [workflowEditorOpen, setWorkflowEditorOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });

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

  const handleResendWorkflow = async (workflowId) => {
    try {
      await workflowsAPI.send(workflowId);
      await loadWorkflows();
      setError(null);
    } catch (err) {
      setError('Failed to re-send workflow emails');
      console.error('Error re-sending workflow:', err);
    }
  };

  const handleDeleteWorkflow = (workflowId) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Workflow',
      message: 'Are you sure you want to delete this workflow? This action cannot be undone.',
      onConfirm: async () => {
        try {
          await workflowsAPI.delete(workflowId);
          await loadWorkflows();
          setError(null);
          setConfirmDialog({ open: false, title: '', message: '', onConfirm: null });
        } catch (err) {
          const errorMessage = err.response?.data?.detail || 'Failed to delete workflow';
          setError(errorMessage);
          console.error('Error deleting workflow:', err);
          setConfirmDialog({ open: false, title: '', message: '', onConfirm: null });
        }
      }
    });
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




  const handleEditWorkflow = (workflow) => {
    setEditingWorkflow(workflow);
    setWorkflowEditorOpen(true);
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
                      {workflow.status === 'draft' && (
                        <IconButton 
                          size="small" 
                          title="Send for Signing"
                          onClick={() => handleSendWorkflow(workflow.id)}
                        >
                          <SendIcon />
                        </IconButton>
                      )}
                      {workflow.status === 'active' && (
                        <IconButton 
                          size="small" 
                          title="Re-send Signing Emails"
                          onClick={() => handleResendWorkflow(workflow.id)}
                        >
                          <SendIcon />
                        </IconButton>
                      )}
                      <IconButton 
                        size="small" 
                        title="Edit Workflow"
                        onClick={() => handleEditWorkflow(workflow)}
                      >
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
        onClose={() => {
          setWorkflowEditorOpen(false);
          setEditingWorkflow(null);
        }}
        onSuccess={handleWorkflowSuccess}
        initialWorkflow={editingWorkflow}
      />


      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ open: false, title: '', message: '', onConfirm: null })}>
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, title: '', message: '', onConfirm: null })}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            color="error" 
            onClick={confirmDialog.onConfirm}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}