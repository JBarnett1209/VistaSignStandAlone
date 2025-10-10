import React, { useState, useEffect, useRef } from 'react';
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
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import { 
  Description as Document, 
  CheckCircle, 
  Schedule as Clock, 
  Person as User,
  Edit as EditIcon
} from '@mui/icons-material';
import { Document as PDFDocument, Page, pdfjs } from 'react-pdf';
import api from '../services/api';
import SignatureCapture from '../components/SignatureCapture';
import ConsentDialog from '../components/ConsentDialog';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

export default function PublicSigning() {
  const { workflowId, participantId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState(null);
  const [workflowData, setWorkflowData] = useState(null);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [selectedField, setSelectedField] = useState(null);
  const [signedFields, setSignedFields] = useState({});
  const [showSidebar, setShowSidebar] = useState(true);
  const [signingField, setSigningField] = useState(false);
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [consentData, setConsentData] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const documentRef = useRef(null);

  useEffect(() => {
    loadSigningData();
  }, [workflowId, participantId]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

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

  const handleFieldClick = (field) => {
    if (isCompleted) return;
    
    // Check if this field is assigned to this participant's signing order
    const participantSigningOrder = workflowData?.participant?.signing_order || 1;
    if (field.signingOrder !== participantSigningOrder) {
      setError(`This field is assigned to signing order #${field.signingOrder}. Your signing order is #${participantSigningOrder}.`);
      return;
    }

    // Check if consent has been given
    if (!consentGiven) {
      setSelectedField(field);
      setConsentDialogOpen(true);
      setError(null);
      return;
    }

    // Proceed to signature capture
    setSelectedField(field);
    setSignatureDialogOpen(true);
    setError(null);
  };

  const handleConsentAccept = (consentInfo) => {
    setConsentGiven(true);
    setConsentData(consentInfo);
    setConsentDialogOpen(false);
    // Now proceed to signature capture
    setSignatureDialogOpen(true);
  };

  const handleConsentDecline = () => {
    setConsentDialogOpen(false);
    setSelectedField(null);
    setError('You must accept the consent terms to sign this document.');
  };

  const handleSignatureSubmit = async (signatureData) => {
    try {
      setSigningField(true);
      setError(null);

      // Mark this field as signed locally
      setSignedFields(prev => ({
        ...prev,
        [selectedField.id]: {
          ...signatureData,
          timestamp: new Date().toISOString(),
          fieldId: selectedField.id
        }
      }));

      setSignatureDialogOpen(false);
      setSelectedField(null);

      // Check if all required fields are signed
      const participantSigningOrder = workflowData?.participant?.signing_order || 1;
      const requiredFields = workflowData?.document?.fields?.filter(f => f.signingOrder === participantSigningOrder) || [];
      const signedFieldIds = Object.keys(signedFields);
      const allFieldsSigned = requiredFields.every(field => signedFieldIds.includes(field.id));

      if (allFieldsSigned) {
        // Submit all signatures to backend
        await submitAllSignatures();
      }

    } catch (err) {
      console.error('Error signing field:', err);
      setError('Failed to sign field. Please try again.');
    } finally {
      setSigningField(false);
    }
  };

  const submitAllSignatures = async () => {
    try {
      const participantSigningOrder = workflowData?.participant?.signing_order || 1;
      const requiredFields = workflowData?.document?.fields?.filter(f => f.signingOrder === participantSigningOrder) || [];
      
      const signatureData = requiredFields.map(field => ({
        fieldId: field.id,
        signature: signedFields[field.id]?.signature || '',
        timestamp: signedFields[field.id]?.timestamp || new Date().toISOString()
      }));

      const response = await api.post(`/api/v1/workflows/${workflowId}/sign/${participantId}`, {
        signature_data: {
          type: 'field_signatures',
          fields: signatureData,
          timestamp: new Date().toISOString(),
          // Include consent data
          ...consentData
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

      // Redirect to success page
      setTimeout(() => {
        navigate('/login', { 
          state: { 
            message: 'Document signed successfully! You can now log in to view the completed workflow.' 
          }
        });
      }, 3000);

    } catch (err) {
      console.error('Error submitting signatures:', err);
      setError('Failed to submit signatures. Please try again.');
    }
  };

  const renderSignatureField = (field) => {
    const isSigned = signedFields[field.id];
    const participantSigningOrder = workflowData?.participant?.signing_order || 1;
    const isAssignedToMe = field.signingOrder === participantSigningOrder;
    const isClickable = !isCompleted && isAssignedToMe && !isSigned;

    return (
      <Box
        key={field.id}
        onClick={() => handleFieldClick(field)}
        sx={{
          position: 'absolute',
          left: `${field.x}%`,
          top: `${field.y}%`,
          width: `${field.width}%`,
          height: `${field.height}%`,
          border: isSigned ? '2px solid #4CAF50' : isClickable ? '2px dashed #7B5CFF' : '2px solid #ccc',
          backgroundColor: isSigned ? 'rgba(76, 175, 80, 0.1)' : isClickable ? 'rgba(123, 92, 255, 0.1)' : 'rgba(204, 204, 204, 0.1)',
          borderRadius: '4px',
          cursor: isClickable ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '30px',
          transition: 'all 0.2s ease',
          '&:hover': isClickable ? {
            backgroundColor: 'rgba(123, 92, 255, 0.2)',
            borderColor: '#7B5CFF'
          } : {},
        }}
      >
        {isSigned ? (
          <Box sx={{ textAlign: 'center', p: 1 }}>
            <CheckCircle sx={{ color: '#4CAF50', fontSize: 16, mb: 0.5 }} />
            {signedFields[field.id]?.type === 'typed' || signedFields[field.id]?.type === 'adopted' ? (
              <Typography 
                variant="caption" 
                sx={{ 
                  color: '#4CAF50', 
                  fontSize: '10px',
                  fontFamily: 'cursive',
                  display: 'block'
                }}
              >
                {signedFields[field.id]?.text}
              </Typography>
            ) : signedFields[field.id]?.type === 'drawn' ? (
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <img 
                  src={signedFields[field.id]?.image} 
                  alt="Signature" 
                  style={{ 
                    maxWidth: '60px', 
                    maxHeight: '20px',
                    objectFit: 'contain'
                  }}
                />
              </Box>
            ) : (
              <Typography variant="caption" sx={{ color: '#4CAF50', fontSize: '10px' }}>
                Signed
              </Typography>
            )}
            <Typography variant="caption" sx={{ color: '#4CAF50', fontSize: '8px', display: 'block' }}>
              {signedFields[field.id]?.signatureType}
            </Typography>
          </Box>
        ) : isClickable ? (
          <Typography variant="caption" sx={{ color: '#7B5CFF', fontSize: '10px', textAlign: 'center' }}>
            Click to sign
          </Typography>
        ) : (
          <Typography variant="caption" sx={{ color: '#999', fontSize: '10px', textAlign: 'center' }}>
            Order #{field.signingOrder}
          </Typography>
        )}
      </Box>
    );
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
      backgroundColor: '#f5f5f5',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <Paper sx={{ 
        p: 2, 
        borderRadius: 0,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        backgroundColor: '#fff'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Document sx={{ color: '#7B5CFF', fontSize: 28 }} />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {workflowData?.document?.title || 'Document'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Signing Order #{workflowData?.participant?.signing_order || 1}
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip 
              icon={isCompleted ? <CheckCircle sx={{ fontSize: 16 }} /> : <Clock sx={{ fontSize: 16 }} />}
              label={isCompleted ? 'Completed' : 'Pending'}
              color={isCompleted ? 'success' : 'default'}
              variant="outlined"
            />
            <Button
              variant="outlined"
              size="small"
              onClick={() => setShowSidebar(!showSidebar)}
            >
              {showSidebar ? 'Hide' : 'Show'} Details
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Main Content */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Document Viewer */}
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          backgroundColor: '#fff',
          margin: 2,
          borderRadius: 2,
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          {error && (
            <Alert severity="error" sx={{ m: 2, mb: 0 }}>
              {error}
            </Alert>
          )}
          
          {workflowData?.document?.file_url ? (
            <Box sx={{ 
              flex: 1, 
              position: 'relative',
              overflow: 'auto',
              backgroundColor: '#f0f0f0'
            }}>
              <Box sx={{ 
                position: 'relative',
                minHeight: '100%',
                display: 'flex',
                justifyContent: 'center',
                p: 2
              }}>
                <Box sx={{ 
                  position: 'relative',
                  backgroundColor: '#fff',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  borderRadius: 1,
                  overflow: 'hidden'
                }}>
                  <Box sx={{ 
                    width: '800px', 
                    height: '1000px',
                    overflow: 'auto',
                    border: '1px solid #ddd',
                    backgroundColor: '#f5f5f5'
                  }}>
                    <PDFDocument
                      file={workflowData.document.file_url}
                      onLoadSuccess={onDocumentLoadSuccess}
                      loading={<CircularProgress />}
                      error={<Alert severity="error">Failed to load document</Alert>}
                    >
                      <Page 
                        pageNumber={pageNumber} 
                        width={800}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                      />
                    </PDFDocument>
                  </Box>
                  
                  {/* Signature Fields Overlay */}
                  {workflowData?.document?.fields?.map(field => renderSignatureField(field))}
                </Box>
              </Box>
            </Box>
          ) : (
            <Box sx={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              p: 3
            }}>
              <Typography color="text.secondary">
                Document preview not available
              </Typography>
            </Box>
          )}
        </Box>

        {/* Sidebar */}
        {showSidebar && (
          <Box sx={{ 
            width: 300, 
            backgroundColor: '#fff',
            borderLeft: '1px solid #e0e0e0',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
              <Typography variant="h6" gutterBottom>
                Signing Instructions
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Click on the signature fields highlighted in purple to sign this document.
              </Typography>
              
              {workflowData?.workflow?.description && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    <strong>Description:</strong> {workflowData.workflow.description}
                  </Typography>
                </>
              )}
            </Box>

            <Box sx={{ flex: 1, p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Your Fields to Sign:
              </Typography>
              {workflowData?.document?.fields
                ?.filter(f => f.signingOrder === (workflowData?.participant?.signing_order || 1))
                ?.map(field => (
                  <Box key={field.id} sx={{ 
                    p: 1, 
                    mb: 1, 
                    border: '1px solid #e0e0e0', 
                    borderRadius: 1,
                    backgroundColor: signedFields[field.id] ? '#e8f5e8' : '#f9f9f9'
                  }}>
                    <Typography variant="body2">
                      {signedFields[field.id] ? (
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <CheckCircle sx={{ color: '#4CAF50', fontSize: 16 }} />
                            <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>Signed</span>
                          </Box>
                          <Typography variant="caption" sx={{ color: '#4CAF50', display: 'block' }}>
                            Type: {signedFields[field.id].signatureType}
                          </Typography>
                          {signedFields[field.id].type === 'typed' || signedFields[field.id].type === 'adopted' ? (
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                color: '#4CAF50', 
                                fontFamily: 'cursive',
                                display: 'block'
                              }}
                            >
                              {signedFields[field.id].text}
                            </Typography>
                          ) : signedFields[field.id].type === 'drawn' ? (
                            <Box sx={{ mt: 1 }}>
                              <img 
                                src={signedFields[field.id].image} 
                                alt="Signature" 
                                style={{ 
                                  maxWidth: '100px', 
                                  maxHeight: '40px',
                                  objectFit: 'contain',
                                  border: '1px solid #ddd',
                                  borderRadius: '4px'
                                }}
                              />
                            </Box>
                          ) : null}
                        </Box>
                      ) : (
                        <span style={{ color: '#7B5CFF' }}>Click to sign</span>
                      )}
                    </Typography>
                  </Box>
                ))}
            </Box>
          </Box>
        )}
      </Box>

      {/* Consent Dialog */}
      <ConsentDialog
        open={consentDialogOpen}
        onAccept={handleConsentAccept}
        onDecline={handleConsentDecline}
        participantInfo={workflowData?.participant}
        documentInfo={{
          title: workflowData?.document?.title,
          workflowName: workflowData?.workflow?.name
        }}
      />

      {/* Signature Capture Dialog */}
      <SignatureCapture
        open={signatureDialogOpen}
        onClose={() => setSignatureDialogOpen(false)}
        onSubmit={handleSignatureSubmit}
        loading={signingField}
        fieldInfo={selectedField}
      />
    </Box>
  );
}