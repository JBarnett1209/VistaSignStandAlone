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
  Send as SendIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  NotificationsActive as RemindIcon
} from '@mui/icons-material';
import { workflowsAPI, documentsAPI, evidenceAPI } from '../services/api';
import WorkflowEditor from '../components/WorkflowEditor';

export default function Workflows() {
  const [workflows, setWorkflows] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [workflowEditorOpen, setWorkflowEditorOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [statusDialog, setStatusDialog] = useState({ open: false, workflow: null });
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    loadWorkflows();
    loadDocuments();
    // Live updates: silently refresh signing status every 5s so the list and the
    // open status dialog reflect completions in near-real-time without a manual refresh.
    const id = setInterval(() => loadWorkflows({ silent: true }), 5000);
    return () => clearInterval(id);
  }, []);

  const loadWorkflows = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const response = await workflowsAPI.list();
      setWorkflows(response.data.workflows || []);
    } catch (err) {
      if (!silent) setError('Failed to load workflows');
      console.error('Error loading workflows:', err);
    } finally {
      if (!silent) setLoading(false);
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

  const recipientStatusColor = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'completed': return 'success';
      case 'declined': return 'error';
      case 'viewed': return 'info';
      default: return 'default'; // pending
    }
  };

  const signedSummary = (workflow) => {
    const ps = workflow.participants || [];
    const done = ps.filter((p) => (p.status || '').toLowerCase() === 'completed').length;
    return { done, total: ps.length };
  };

  const pendingCount = (workflow) =>
    (workflow.participants || []).filter(
      (p) => !['completed', 'declined'].includes((p.status || '').toLowerCase())
    ).length;

  const handleRemind = async (workflow) => {
    try {
      const resp = await workflowsAPI.remind(workflow.id);
      setNotice(resp.data?.message || 'Reminder sent');
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send reminder');
    }
  };

  const handleDownloadSigned = async (workflow) => {
    if (!workflow.envelope_id) return;
    try {
      const resp = await evidenceAPI.certificate(workflow.envelope_id);
      const blob = new Blob([resp.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(workflow.name || 'document').replace(/[^a-z0-9]+/gi, '_')}_signed.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setError(null);
    } catch (err) {
      setError('Signed document is not ready yet.');
      console.error('Error downloading signed PDF:', err);
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
      {notice && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice(null)}>
          {notice}
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
                    {(() => {
                      const { done, total } = signedSummary(workflow);
                      if (workflow.status === 'draft') {
                        return <Typography variant="body2">{total} participant{total === 1 ? '' : 's'}</Typography>;
                      }
                      const allDone = total > 0 && done === total;
                      return (
                        <Chip size="small" variant={allDone ? 'filled' : 'outlined'}
                          color={allDone ? 'success' : 'warning'}
                          label={`${done}/${total} signed`} />
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(workflow.created_at)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {workflow.status !== 'draft' && (
                        <IconButton
                          size="small"
                          title="View Signing Status"
                          onClick={() => setStatusDialog({ open: true, workflowId: workflow.id })}
                        >
                          <ViewIcon />
                        </IconButton>
                      )}
                      {workflow.status === 'active' && pendingCount(workflow) > 0 && (
                        <IconButton
                          size="small"
                          title="Remind Pending Signers"
                          color="warning"
                          onClick={() => handleRemind(workflow)}
                        >
                          <RemindIcon />
                        </IconButton>
                      )}
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
                      {workflow.status === 'completed' && workflow.envelope_id && (
                        <IconButton
                          size="small"
                          title="Download Signed PDF"
                          color="primary"
                          onClick={() => handleDownloadSigned(workflow)}
                        >
                          <DownloadIcon />
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


      {/* Signing status / tracking dialog — derives from the live workflows list
          so it updates in real-time as recipients complete (5s polling). */}
      <Dialog open={statusDialog.open} onClose={() => setStatusDialog({ open: false, workflowId: null })} maxWidth="sm" fullWidth>
        {(() => {
          const w = workflows.find((x) => String(x.id) === String(statusDialog.workflowId)) || null;
          const { done, total } = w ? signedSummary(w) : { done: 0, total: 0 };
          return (
            <>
              <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {w?.name}
                {w && <Chip size="small" label={w.status} color={getStatusColor(w.status)} />}
              </DialogTitle>
              <DialogContent dividers>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">{done} of {total} recipient(s) have signed.</Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <Chip size="small" variant="outlined" color="success" label="● live" sx={{ opacity: 0.7 }} />
                </Box>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Recipient</TableCell>
                      <TableCell>Recipient #</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Signed</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(w?.participants || [])
                      .slice()
                      .sort((a, b) => (a.signingOrder || 0) - (b.signingOrder || 0))
                      .map((p) => (
                        <TableRow key={p.id || p.email}>
                          <TableCell>{p.email}</TableCell>
                          <TableCell>{p.signingOrder}</TableCell>
                          <TableCell>
                            <Chip size="small" label={p.status || 'pending'} color={recipientStatusColor(p.status)} />
                          </TableCell>
                          <TableCell>{p.signed_at ? formatDate(p.signed_at) : '—'}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </DialogContent>
              <DialogActions>
                {w?.status === 'active' && pendingCount(w) > 0 && (
                  <Button startIcon={<RemindIcon />} onClick={() => handleRemind(w)}>
                    Remind pending
                  </Button>
                )}
                {w?.status === 'completed' && w?.envelope_id && (
                  <Button startIcon={<DownloadIcon />} variant="contained" onClick={() => handleDownloadSigned(w)}>
                    Download Signed PDF
                  </Button>
                )}
                <Button onClick={() => setStatusDialog({ open: false, workflowId: null })}>Close</Button>
              </DialogActions>
            </>
          );
        })()}
      </Dialog>

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