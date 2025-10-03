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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Create as CreateIcon
} from '@mui/icons-material';
import { signaturesAPI } from '../services/api';

interface Signature {
  id: string;
  document_id: string;
  signer_id: string;
  signature_type: string;
  status: string;
  signature_position?: any;
  signing_reason?: string;
  signing_location?: string;
  created_at: string;
  signed_at?: string;
}

const Signatures: React.FC = () => {
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedSignature, setSelectedSignature] = useState<Signature | null>(null);

  useEffect(() => {
    fetchSignatures();
  }, []);

  const fetchSignatures = async () => {
    try {
      setLoading(true);
      const response = await signaturesAPI.list();
      setSignatures(response.data.signatures);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch signatures');
    } finally {
      setLoading(false);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, signature: Signature) => {
    setAnchorEl(event.currentTarget);
    setSelectedSignature(signature);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedSignature(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'signed': return 'success';
      case 'rejected': return 'error';
      case 'expired': return 'error';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'signed': return 'Signed';
      case 'rejected': return 'Rejected';
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
        <Typography variant="h4">Signatures</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          disabled
        >
          Create Signature
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {signatures.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <CreateIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              No signatures yet
            </Typography>
            <Typography color="text.secondary" gutterBottom>
              Create your first digital signature to get started
            </Typography>
            <Button
              variant="contained"
              startIcon={<CreateIcon />}
              disabled
              sx={{ mt: 2 }}
            >
              Create Signature
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {signatures.map((signature) => (
            <Grid item xs={12} sm={6} md={4} key={signature.id}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Box flex={1}>
                      <Typography variant="h6" gutterBottom>
                        Signature #{signature.id.slice(-8)}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <Chip
                          label={getStatusText(signature.status)}
                          size="small"
                          color={getStatusColor(signature.status) as any}
                        />
                        <Chip
                          label={signature.signature_type.toUpperCase()}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                      {signature.signing_reason && (
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Reason: {signature.signing_reason}
                        </Typography>
                      )}
                      {signature.signing_location && (
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Location: {signature.signing_location}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        Created: {new Date(signature.created_at).toLocaleDateString()}
                        {signature.signed_at && (
                          <> • Signed: {new Date(signature.signed_at).toLocaleDateString()}</>
                        )}
                      </Typography>
                    </Box>
                    <IconButton
                      onClick={(e) => handleMenuOpen(e, signature)}
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

export default Signatures;
