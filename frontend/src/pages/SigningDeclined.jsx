import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Alert,
  Divider
} from '@mui/material';
import {
  Cancel as CancelIcon,
  Home as HomeIcon,
  Email as EmailIcon
} from '@mui/icons-material';

export default function SigningDeclined() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const {
    documentTitle,
    workflowName,
    participantEmail,
    declinedAt
  } = location.state || {};

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleString();
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f5f5f5',
      p: 2
    }}>
      <Card sx={{
        maxWidth: 600,
        width: '100%',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <CancelIcon 
              sx={{ 
                fontSize: 64, 
                color: '#f44336',
                mb: 2
              }} 
            />
            <Typography variant="h4" component="h1" gutterBottom>
              Signing Declined
            </Typography>
            <Typography variant="body1" color="text.secondary">
              You have declined to sign this document
            </Typography>
          </Box>

          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              Your decision to decline signing has been recorded. The document owner will be notified of your decision.
            </Typography>
          </Alert>

          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Document Details
            </Typography>
            <Box sx={{ pl: 2 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Document:</strong> {documentTitle || 'Unknown Document'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Workflow:</strong> {workflowName || 'Unknown Workflow'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Participant:</strong> {participantEmail || 'Unknown Email'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Declined At:</strong> {formatDate(declinedAt)}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              If you have any questions about this document or need to change your decision, 
              please contact the document owner directly.
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                startIcon={<EmailIcon />}
                onClick={() => {
                  if (participantEmail) {
                    window.location.href = `mailto:${participantEmail}`;
                  }
                }}
                disabled={!participantEmail}
              >
                Contact Owner
              </Button>
              <Button
                variant="contained"
                startIcon={<HomeIcon />}
                onClick={() => navigate('/')}
                sx={{
                  backgroundColor: '#7B5CFF',
                  '&:hover': { backgroundColor: '#6a4cdf' }
                }}
              >
                Return Home
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
