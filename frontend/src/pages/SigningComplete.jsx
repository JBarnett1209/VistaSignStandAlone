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
  Alert
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Description as DocumentIcon,
  Person as PersonIcon,
  Schedule as TimeIcon,
  Security as SecurityIcon
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
    workflowStatus
  } = location.state || {};

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return 'Unknown';
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      backgroundColor: '#f5f5f5',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      p: 2
    }}>
      <Paper sx={{ 
        maxWidth: 600, 
        width: '100%', 
        p: 4,
        textAlign: 'center',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        {/* Success Icon */}
        <Box sx={{ mb: 3 }}>
          <CheckCircleIcon 
            sx={{ 
              fontSize: 80, 
              color: '#4CAF50',
              mb: 2
            }} 
          />
        </Box>

        {/* Main Title */}
        <Typography variant="h4" sx={{ 
          fontWeight: 'bold', 
          color: '#2E7D32',
          mb: 2
        }}>
          Document Successfully Signed!
        </Typography>

        {/* Subtitle */}
        <Typography variant="h6" sx={{ 
          color: '#666', 
          mb: 4,
          fontWeight: 'normal'
        }}>
          {workflowCompleted 
            ? 'Your signature has been securely recorded and all participants have completed signing. The document is now fully executed.'
            : 'Your signature has been securely recorded. Other participants may still need to sign before the document is complete.'
          }
        </Typography>

        {/* Document Details Card */}
        <Card sx={{ 
          mb: 3, 
          textAlign: 'left',
          backgroundColor: '#f9f9f9'
        }}>
          <CardContent>
            <Typography variant="h6" sx={{ 
              mb: 2, 
              color: '#333',
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}>
              <DocumentIcon color="primary" />
              Document Details
            </Typography>
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ color: '#666', mb: 0.5 }}>
                Document Title:
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                {documentTitle || 'Unknown Document'}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ color: '#666', mb: 0.5 }}>
                Workflow:
              </Typography>
              <Typography variant="body1">
                {workflowName || 'Unknown Workflow'}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ color: '#666', mb: 0.5 }}>
                Signed By:
              </Typography>
              <Typography variant="body1" sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1 
              }}>
                <PersonIcon sx={{ fontSize: 16 }} />
                {participantEmail || 'Unknown'}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ color: '#666', mb: 0.5 }}>
                Signed At:
              </Typography>
              <Typography variant="body1" sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1 
              }}>
                <TimeIcon sx={{ fontSize: 16 }} />
                {formatDate(signedAt)}
              </Typography>
            </Box>

            <Box>
              <Typography variant="body2" sx={{ color: '#666', mb: 0.5 }}>
                Workflow Status:
              </Typography>
              <Typography variant="body1" sx={{ 
                fontWeight: 'bold',
                color: workflowCompleted ? '#4CAF50' : '#FF9800'
              }}>
                {workflowCompleted ? '✅ Fully Executed' : '⏳ In Progress'}
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Security Notice */}
        <Alert 
          severity="success" 
          icon={<SecurityIcon />}
          sx={{ 
            mb: 3,
            textAlign: 'left',
            backgroundColor: '#e8f5e8',
            border: '1px solid #4CAF50'
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
            Your signature is cryptographically secured and legally binding.
          </Typography>
          <Typography variant="body2">
            The document has been digitally signed with a secure certificate, 
            ensuring authenticity and non-repudiation.
          </Typography>
        </Alert>

        <Divider sx={{ my: 3 }} />

        {/* Safe to Close Notice */}
        <Box sx={{ 
          p: 2, 
          backgroundColor: '#e3f2fd', 
          borderRadius: 2,
          border: '1px solid #2196f3',
          mb: 3
        }}>
          <Typography variant="h6" sx={{ 
            color: '#1976d2', 
            mb: 1,
            fontWeight: 'bold'
          }}>
            ✅ Safe to Close
          </Typography>
          <Typography variant="body2" sx={{ color: '#1976d2' }}>
            Your signing process is complete. You can safely close this browser window 
            or tab. The document has been saved and all parties will be notified.
          </Typography>
        </Box>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            variant="outlined"
            onClick={() => navigate('/login')}
            sx={{ 
              borderColor: '#4CAF50',
              color: '#4CAF50',
              '&:hover': {
                borderColor: '#45a049',
                backgroundColor: 'rgba(76, 175, 80, 0.1)'
              }
            }}
          >
            Go to Login
          </Button>
          <Button
            variant="contained"
            onClick={() => window.close()}
            sx={{ 
              backgroundColor: '#4CAF50',
              '&:hover': { backgroundColor: '#45a049' }
            }}
          >
            Close Window
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
