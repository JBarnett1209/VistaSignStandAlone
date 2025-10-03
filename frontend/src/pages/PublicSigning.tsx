import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Grid,
  Paper,
  Divider
} from '@mui/material';
import {
  Description as DocumentIcon,
  Edit as SignatureIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { publicSigningAPI } from '../services/api';

interface PublicDocument {
  id: string;
  title: string;
  description?: string;
  public_id: string;
  public_url: string;
  status: string;
  expires_at?: string;
  created_at: string;
}

interface PublicSigningRecipient {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  signed_at?: string;
}

interface PublicSigningData {
  document: PublicDocument;
  recipients: PublicSigningRecipient[];
  requires_access_code: boolean;
  access_code_provided: boolean;
}

const PublicSigning: React.FC = () => {
  const [signingData, setSigningData] = useState<PublicSigningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [showAccessCodeForm, setShowAccessCodeForm] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signatureData, setSignatureData] = useState('');
  const [signingReason, setSigningReason] = useState('');
  const [signingLocation, setSigningLocation] = useState('');

  // Get public_id from URL
  const publicId = window.location.pathname.split('/sign/')[1];

  useEffect(() => {
    if (publicId) {
      fetchSigningData();
    }
  }, [publicId]);

  const fetchSigningData = async () => {
    try {
      setLoading(true);
      const response = await publicSigningAPI.getSigningPage(publicId, {
        access_code: accessCode || undefined
      });
      setSigningData(response.data);
      
      if (response.data.requires_access_code && !response.data.access_code_provided) {
        setShowAccessCodeForm(true);
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        setShowAccessCodeForm(true);
      } else {
        setError(err.response?.data?.detail || 'Failed to load document');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAccessCodeSubmit = () => {
    fetchSigningData();
  };

  const handleSign = async () => {
    if (!signingData) return;

    try {
      setSigning(true);
      // In a real implementation, you would capture the signature here
      // For now, we'll simulate it
      const mockSignatureData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      
      await publicSigningAPI.signDocument(publicId, {
        access_token: 'mock-access-token', // In real implementation, get from URL params
        signature_data: mockSignatureData,
        signature_image: mockSignatureData,
        signing_reason: signingReason,
        signing_location: signingLocation
      });
      
      // Show success message
      setError('');
      alert('Document signed successfully!');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to sign document');
    } finally {
      setSigning(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'signed': return 'success';
      case 'pending': return 'warning';
      case 'declined': return 'error';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'signed': return 'Signed';
      case 'pending': return 'Pending';
      case 'declined': return 'Declined';
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

  if (showAccessCodeForm) {
    return (
      <Box maxWidth="sm" mx="auto" mt={4}>
        <Card>
          <CardContent>
            <Typography variant="h5" gutterBottom>
              Access Code Required
            </Typography>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              This document requires an access code to view and sign.
            </Typography>
            <TextField
              fullWidth
              label="Access Code"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              margin="normal"
            />
            <Button
              variant="contained"
              fullWidth
              onClick={handleAccessCodeSubmit}
              sx={{ mt: 2 }}
            >
              Continue
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (!signingData) {
    return (
      <Box maxWidth="sm" mx="auto" mt={4}>
        <Alert severity="error">
          Document not found or access denied.
        </Alert>
      </Box>
    );
  }

  return (
    <Box maxWidth="md" mx="auto" mt={4}>
      <Card>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            {signingData.document.title}
          </Typography>
          
          {signingData.document.description && (
            <Typography variant="body1" color="text.secondary" gutterBottom>
              {signingData.document.description}
            </Typography>
          )}

          <Divider sx={{ my: 2 }} />

          <Typography variant="h6" gutterBottom>
            Document Status
          </Typography>
          
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {signingData.recipients.map((recipient) => (
              <Grid item xs={12} sm={6} key={recipient.id}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1">
                    {recipient.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {recipient.email}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Role: {recipient.role}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    color={`${getStatusColor(recipient.status)}.main`}
                    sx={{ mt: 1 }}
                  >
                    Status: {getStatusText(recipient.status)}
                  </Typography>
                  {recipient.signed_at && (
                    <Typography variant="caption" color="text.secondary">
                      Signed: {new Date(recipient.signed_at).toLocaleString()}
                    </Typography>
                  )}
                </Paper>
              </Grid>
            ))}
          </Grid>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Typography variant="h6" gutterBottom>
            Sign Document
          </Typography>
          
          <TextField
            fullWidth
            label="Signing Reason (Optional)"
            value={signingReason}
            onChange={(e) => setSigningReason(e.target.value)}
            margin="normal"
          />
          
          <TextField
            fullWidth
            label="Signing Location (Optional)"
            value={signingLocation}
            onChange={(e) => setSigningLocation(e.target.value)}
            margin="normal"
          />

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Button
              variant="contained"
              size="large"
              onClick={handleSign}
              disabled={signing}
              startIcon={<SignatureIcon />}
            >
              {signing ? 'Signing...' : 'Sign Document'}
            </Button>
          </Box>

          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              By signing this document, you agree to the terms and conditions.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default PublicSigning;
