import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Typography, 
  Box, 
  Card, 
  CardContent, 
  Button, 
  Alert, 
  CircularProgress,
  Paper,
  Divider,
  Chip
} from '@mui/material';
import { Document, CheckCircle, Clock, User } from 'lucide-react';
import api from '../services/api';

export default function PublicSigning() {
  const { workflowId, participantId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState(null);
  const [workflowData, setWorkflowData] = useState(null);
  const [signatureData, setSignatureData] = useState('');

  useEffect(() => {
    loadSigningData();
  }, [workflowId, participantId]);

  const loadSigningData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get(`/api/v1/workflows/${workflowId}/sign/${participantId}`);
      setWorkflowData(response.data);
      
      // Check if already signed
      if (response.data.participant.status === 'completed') {
        setError('This document has already been signed.');
      }
    } catch (err) {
      console.error('Error loading signing data:', err);
      if (err.response?.status === 404) {
        setError('Signing link not found or expired.');
      } else if (err.response?.status === 400) {
        setError('This document has already been signed or is no longer available.');
      } else {
        setError('Failed to load document. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignDocument = async () => {
    if (!signatureData.trim()) {
      setError('Please provide your signature.');
      return;
    }

    try {
      setSigning(true);
      setError(null);

      const response = await api.post(`/api/v1/workflows/${workflowId}/sign/${participantId}`, {
        signature_data: {
          type: 'typed',
          text: signatureData,
          timestamp: new Date().toISOString()
        }
      });

      // Show success message
      setError(null);
      setWorkflowData(prev => ({
        ...prev,
        participant: {
          ...prev.participant,
          status: 'completed',
          signed_at: new Date().toISOString()
        }
      }));

      // Redirect to success page or show success message
      setTimeout(() => {
        navigate('/login', { 
          state: { 
            message: 'Document signed successfully! You can now log in to view the completed workflow.' 
          }
        });
      }, 3000);

    } catch (err) {
      console.error('Error signing document:', err);
      setError('Failed to sign document. Please try again.');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        gap: 2,
        p: 3
      }}>
        <CircularProgress size={40} />
        <Typography variant="body1" color="text.secondary">
          Loading document...
        </Typography>
      </Box>
    );
  }

  if (error && !workflowData) {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        gap: 2,
        p: 3
      }}>
        <Alert severity="error" sx={{ maxWidth: 500, width: '100%' }}>
          {error}
        </Alert>
        <Button 
          variant="outlined" 
          onClick={() => navigate('/login')}
        >
          Go to Login
        </Button>
      </Box>
    );
  }

  const isCompleted = workflowData?.participant?.status === 'completed';

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      p: 3
    }}>
      <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
        {/* Header */}
        <Paper sx={{ p: 4, mb: 3, textAlign: 'center' }}>
          <Typography variant="h4" gutterBottom sx={{ color: 'primary.main', fontWeight: 600 }}>
            Document Signing Request
          </Typography>
          <Typography variant="body1" color="text.secondary">
            You have been requested to sign a document
          </Typography>
        </Paper>

        {/* Document Info */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Document size={24} color="#7B5CFF" />
              <Typography variant="h6">
                {workflowData?.document?.title || 'Document'}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
              <Chip 
                icon={<User size={16} />}
                label={`Signing Order: #${workflowData?.participant?.signing_order || 1}`}
                variant="outlined"
              />
              <Chip 
                icon={isCompleted ? <CheckCircle size={16} /> : <Clock size={16} />}
                label={isCompleted ? 'Completed' : 'Pending'}
                color={isCompleted ? 'success' : 'default'}
                variant="outlined"
              />
            </Box>

            {workflowData?.workflow?.description && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  <strong>Description:</strong> {workflowData.workflow.description}
                </Typography>
              </>
            )}
          </CardContent>
        </Card>

        {/* Signing Form */}
        {!isCompleted ? (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Sign Document
              </Typography>
              
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Type your full name to sign this document:
                </Typography>
                <input
                  type="text"
                  value={signatureData}
                  onChange={(e) => setSignatureData(e.target.value)}
                  placeholder="Enter your full name"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontFamily: 'cursive'
                  }}
                />
              </Box>

              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={handleSignDocument}
                disabled={signing || !signatureData.trim()}
                sx={{ py: 1.5 }}
              >
                {signing ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    Signing Document...
                  </>
                ) : (
                  'Sign Document'
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <CheckCircle size={48} color="#4CAF50" style={{ marginBottom: 16 }} />
              <Typography variant="h6" gutterBottom>
                Document Already Signed
              </Typography>
              <Typography color="text.secondary" paragraph>
                This document was signed on {new Date(workflowData.participant.signed_at).toLocaleDateString()}
              </Typography>
              <Button 
                variant="outlined" 
                onClick={() => navigate('/login')}
              >
                Go to Login
              </Button>
            </CardContent>
          </Card>
        )}
      </Box>
    </Box>
  );
}