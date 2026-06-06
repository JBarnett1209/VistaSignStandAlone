import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  Card,
  CardContent,
  Divider,
  Alert,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Description as DocumentIcon,
  Person as PersonIcon,
  Schedule as TimeIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';

export default function SigningComplete() {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    documentTitle,
    workflowName,
    participantEmail,
    signedAt,
    workflowCompleted,
  } = location.state || {};

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return 'Unknown';
    }
  };

  const Detail = ({ label, icon, children }) => (
    <Box sx={{ mb: 2 }}>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>{label}</Typography>
      <Typography variant="body1" sx={{ color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
        {icon}{children}
      </Typography>
    </Box>
  );

  return (
    <Box sx={{
      minHeight: '100vh',
      width: '100%',
      backgroundColor: 'background.default',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      p: 2,
    }}>
      <Paper sx={{ maxWidth: 600, width: '100%', p: 4, textAlign: 'center' }}>
        <CheckCircleIcon sx={{ fontSize: 80, color: '#4CAF50', mb: 2 }} />

        <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#66BB6A', mb: 2 }}>
          Document Successfully Signed!
        </Typography>

        <Typography variant="h6" sx={{ color: 'text.secondary', mb: 4, fontWeight: 'normal' }}>
          {workflowCompleted
            ? 'Your signature has been securely recorded and all participants have completed signing. The document is now fully executed.'
            : 'Your signature has been securely recorded. Other participants may still need to sign before the document is complete.'}
        </Typography>

        {/* Document Details */}
        <Card sx={{ mb: 3, textAlign: 'left', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid', borderColor: 'divider' }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}>
              <DocumentIcon color="primary" />
              Document Details
            </Typography>

            <Detail label="Document Title:">
              <strong>{documentTitle || 'Unknown Document'}</strong>
            </Detail>
            <Detail label="Workflow:">{workflowName || 'Unknown Workflow'}</Detail>
            <Detail label="Signed By:" icon={<PersonIcon sx={{ fontSize: 16 }} />}>{participantEmail || 'Unknown'}</Detail>
            <Detail label="Signed At:" icon={<TimeIcon sx={{ fontSize: 16 }} />}>{formatDate(signedAt)}</Detail>

            <Box>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>Workflow Status:</Typography>
              <Typography variant="body1" sx={{ fontWeight: 'bold', color: workflowCompleted ? '#66BB6A' : '#FFB74D' }}>
                {workflowCompleted ? '✅ Fully Executed' : '⏳ In Progress'}
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Security notice */}
        <Alert severity="success" variant="outlined" icon={<SecurityIcon />} sx={{ mb: 3, textAlign: 'left' }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
            Your signature is cryptographically secured and legally binding.
          </Typography>
          <Typography variant="body2">
            The document has been digitally signed with a secure certificate, ensuring authenticity and non-repudiation.
          </Typography>
        </Alert>

        <Divider sx={{ my: 3 }} />

        {/* Safe to close */}
        <Box sx={{ p: 2, backgroundColor: 'rgba(33,150,243,0.12)', borderRadius: 2, border: '1px solid', borderColor: 'rgba(33,150,243,0.5)', mb: 3 }}>
          <Typography variant="h6" sx={{ color: '#90CAF9', mb: 1, fontWeight: 'bold' }}>
            ✅ Safe to Close
          </Typography>
          <Typography variant="body2" sx={{ color: '#90CAF9' }}>
            Your signing process is complete. You can safely close this browser window or tab.
            The document has been saved and all parties will be notified.
          </Typography>
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button variant="outlined" color="success" onClick={() => navigate('/login')}>Go to Login</Button>
          <Button variant="contained" color="success" onClick={() => window.close()}>Close Window</Button>
        </Box>
      </Paper>
    </Box>
  );
}
