import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Workflow as WorkflowIcon
} from '@mui/icons-material';
import { workflowsAPI } from '../services/api';

interface Workflow {
  id: string;
  name: string;
  description?: string;
  status: string;
  document_id: string;
  created_by: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

const Workflows: React.FC = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const response = await workflowsAPI.list();
      setWorkflows(response.data.workflows);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch workflows');
    } finally {
      setLoading(false);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, workflow: Workflow) => {
    setAnchorEl(event.currentTarget);
    setSelectedWorkflow(workflow);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedWorkflow(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'default';
      case 'active': return 'info';
      case 'completed': return 'success';
      case 'cancelled': return 'error';
      case 'expired': return 'error';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return 'Draft';
      case 'active': return 'Active';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      case 'expired': return 'Expired';
      default: return status;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Workflows</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          disabled
        >
          Create Workflow
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {workflows.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <WorkflowIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No workflows yet
            </Typography>
            <Typography color="text.secondary" gutterBottom>
              Create your first workflow to automate document signing processes
            </Typography>
            <Button
              variant="contained"
              startIcon={<WorkflowIcon />}
              disabled
              sx={{ mt: 2 }}
            >
              Create Workflow
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {workflows.map((workflow) => (
            <Grid item xs={12} sm={6} md={4} key={workflow.id}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Box flex={1}>
                      <Typography variant="h6" gutterBottom>
                        {workflow.name}
                      </Typography>
                      {workflow.description && (
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {workflow.description}
                        </Typography>
                      )}
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <Chip
                          label={getStatusText(workflow.status)}
                          size="small"
                          color={getStatusColor(workflow.status) as any}
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        Created: {new Date(workflow.created_at).toLocaleDateString()}
                        {workflow.started_at && (
                          <> • Started: {new Date(workflow.started_at).toLocaleDateString()}</>
                        )}
                        {workflow.completed_at && (
                          <> • Completed: {new Date(workflow.completed_at).toLocaleDateString()}</>
                        )}
                      </Typography>
                    </Box>
                    <IconButton
                      onClick={(e) => handleMenuOpen(e, workflow)}
                      size="small"
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleMenuClose}>
          <ViewIcon sx={{ mr: 1 }} />
          View Details
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <EditIcon sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleMenuClose} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default Workflows;
