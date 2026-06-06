import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import {
  Security as SecurityIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import api from '../services/api';

export default function CertificateValidation() {
  const [loading, setLoading] = useState(false);
  const [certificateStatus, setCertificateStatus] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [certificateDetails, setCertificateDetails] = useState(null);
  const [error, setError] = useState(null);

  const loadCertificateStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('/api/v1/certificates/certificate-status');
      setCertificateStatus(response.data);
    } catch (err) {
      console.error('Error loading certificate status:', err);
      setError('Failed to load certificate status');
    } finally {
      setLoading(false);
    }
  };

  const runSignatureTest = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.post('/api/v1/certificates/test-signature');
      setTestResults(response.data);
    } catch (err) {
      console.error('Error running signature test:', err);
      setError('Failed to run signature test');
    } finally {
      setLoading(false);
    }
  };

  const loadCertificateDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('/api/v1/certificates/certificate-details');
      setCertificateDetails(response.data);
    } catch (err) {
      console.error('Error loading certificate details:', err);
      setError('Failed to load certificate details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCertificateStatus();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'degraded': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getStatusIcon = (available) => {
    return available ? <CheckIcon color="success" /> : <ErrorIcon color="error" />;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <SecurityIcon sx={{ fontSize: 32, mr: 2, color: '#7B5CFF' }} />
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Certificate Validation
        </Typography>
      </Box>

      <Typography variant="body1" sx={{ mb: 3, color: '#666' }}>
        Verify that your digital signature certificates are properly loaded and functioning.
        This ensures 100% validation that private and public certificates are being used for cryptographic signing.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Certificate Status */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Certificate Status
            </Typography>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadCertificateStatus}
              disabled={loading}
            >
              Refresh
            </Button>
          </Box>

          {loading && !certificateStatus ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : certificateStatus ? (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="body1" sx={{ mr: 2 }}>
                  Overall Status:
                </Typography>
                <Chip
                  label={certificateStatus.overall_status}
                  color={getStatusColor(certificateStatus.overall_status)}
                  icon={getStatusIcon(certificateStatus.overall_status === 'healthy')}
                />
              </Box>

              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Service</TableCell>
                      <TableCell>Available</TableCell>
                      <TableCell>Certificate Loaded</TableCell>
                      <TableCell>Private Key Loaded</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(certificateStatus.certificate_services).map(([service, status]) => (
                      <TableRow key={service}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {service.replace('_', ' ').toUpperCase()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {getStatusIcon(status.available)}
                        </TableCell>
                        <TableCell>
                          {getStatusIcon(status.certificate_loaded || status.system_certificate_loaded)}
                        </TableCell>
                        <TableCell>
                          {getStatusIcon(status.private_key_loaded || status.system_private_key_loaded)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ) : null}
        </CardContent>
      </Card>

      {/* Signature Test */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Signature Test
            </Typography>
            <Button
              variant="contained"
              onClick={runSignatureTest}
              disabled={loading}
              sx={{ backgroundColor: '#7B5CFF' }}
            >
              Run Test
            </Button>
          </Box>

          <Typography variant="body2" sx={{ mb: 2, color: '#666' }}>
            Test signature creation and verification to ensure certificates are working correctly.
          </Typography>

          {testResults && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="body1" sx={{ mr: 2 }}>
                  Test Status:
                </Typography>
                <Chip
                  label={testResults.status}
                  color={getStatusColor(testResults.status)}
                  icon={getStatusIcon(testResults.status === 'success')}
                />
              </Box>

              <Typography variant="body2" sx={{ mb: 2 }}>
                Working Services: {testResults.summary.working_services} / {testResults.summary.total_services}
              </Typography>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1">Test Results Details</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <pre style={{ 
                    backgroundColor: 'rgba(255,255,255,0.04)', 
                    padding: '16px', 
                    borderRadius: '4px',
                    overflow: 'auto',
                    fontSize: '12px'
                  }}>
                    {JSON.stringify(testResults.test_results, null, 2)}
                  </pre>
                </AccordionDetails>
              </Accordion>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Certificate Details */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Certificate Details
            </Typography>
            <Button
              variant="outlined"
              onClick={loadCertificateDetails}
              disabled={loading}
            >
              Load Details
            </Button>
          </Box>

          {certificateDetails && (
            <Box>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Certificates Loaded: {certificateDetails.validation_summary.certificates_loaded}
              </Typography>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1">Certificate Information</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <pre style={{ 
                    backgroundColor: 'rgba(255,255,255,0.04)', 
                    padding: '16px', 
                    borderRadius: '4px',
                    overflow: 'auto',
                    fontSize: '12px'
                  }}>
                    {JSON.stringify(certificateDetails.certificate_details, null, 2)}
                  </pre>
                </AccordionDetails>
              </Accordion>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
