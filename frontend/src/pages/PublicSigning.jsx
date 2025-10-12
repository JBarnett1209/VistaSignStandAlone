import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Typography, 
  Box, 
  Button, 
  Alert, 
  CircularProgress,
  Paper,
  Divider,
  Chip,
  Switch,
  FormControlLabel
} from '@mui/material';
import { 
  Description as Document, 
  CheckCircle, 
  Schedule as Clock
} from '@mui/icons-material';
import api from '../services/api';
import SignatureCapture from '../components/SignatureCapture';
import ConsentDialog from '../components/ConsentDialog';
import UnifiedDocumentViewer from '../components/UnifiedDocumentViewer';
import { handleError } from '../utils/errorHandler';
import LoadingErrorState from '../components/LoadingErrorState';

export default function PublicSigning() {
  const { workflowId, participantId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
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
  const [signingComplete, setSigningComplete] = useState(false);
  const [autoProgressing, setAutoProgressing] = useState(false);
  const [autoProgressEnabled, setAutoProgressEnabled] = useState(true);
  const pdfContainerRef = useRef(null);

  const loadSigningData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get(`/api/v1/workflows/${workflowId}/sign/${participantId}`);
      setWorkflowData(response.data);
      
      // Load existing signature data if participant has already signed
      if (response.data.participant.status === 'completed' && response.data.participant.signature_data) {
        const signatureData = response.data.participant.signature_data;
        
        // Extract field signatures from the signature data
        if (signatureData.fields && Array.isArray(signatureData.fields)) {
          const existingSignatures = {};
          signatureData.fields.forEach(fieldSig => {
            if (fieldSig.fieldId && fieldSig.signature) {
              existingSignatures[fieldSig.fieldId] = {
                signature: fieldSig.signature,
                timestamp: fieldSig.timestamp,
                type: fieldSig.type || 'typed',
                text: fieldSig.text || fieldSig.signature,
                image: fieldSig.image,
                signatureType: fieldSig.signatureType || 'Typed Signature',
                // Include digital signature metadata if available
                digitalSignature: signatureData.legal_signature_metadata?.digital_signature,
                documentHash: signatureData.legal_signature_metadata?.document_hash,
                certificateThumbprint: signatureData.legal_signature_metadata?.certificate_thumbprint
              };
            }
          });
          setSignedFields(existingSignatures);
        }
        
        setError('This document has already been signed.');
      }
    } catch (err) {
      console.error('Error loading signing data:', err);
      const handledError = handleError(err, { 
        workflowId, 
        participantId, 
        action: 'loadSigningData' 
      });
      setError(handledError.userMessage);
    } finally {
      setLoading(false);
    }
  }, [workflowId, participantId]);

  useEffect(() => {
    loadSigningData();
  }, [loadSigningData]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const getAllSignatures = () => {
    // Convert signedFields state to the format expected by signature system
    return Object.entries(signedFields).map(([fieldId, signatureData]) => ({
      id: fieldId,
      document_id: workflowData?.document?.id,
      field_id: fieldId,
      signature_data: signatureData.signature || '',
      signature_image: signatureData.image,
      digital_signature: signatureData.signature,
      participant_email: workflowData?.participant?.email,
      signed_at: signatureData.timestamp || new Date().toISOString(),
      signature_type: signatureData.type || 'typed'
    }));
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

  const handleDeclineSigning = async () => {
    try {
      setLoading(true);
      
      // Call backend to mark participant as declined
      await api.post(`/api/v1/workflows/${workflowId}/sign/${participantId}`, {
        action: 'decline',
        reason: 'Participant declined to sign'
      });
      
      // Navigate to decline completion page
      navigate('/signing-declined', {
        state: {
          documentTitle: workflowData?.document?.title,
          workflowName: workflowData?.workflow?.name,
          participantEmail: workflowData?.participant?.email,
          declinedAt: new Date().toISOString()
        }
      });
      
    } catch (err) {
      console.error('Error declining signature:', err);
      setError('Failed to record your decline. Please contact the document owner.');
    } finally {
      setLoading(false);
    }
  };

  const findNextFieldToSign = () => {
    const participantSigningOrder = workflowData?.participant?.signing_order || 1;
    const requiredFields = workflowData?.document?.fields?.filter(f => f.signingOrder === participantSigningOrder) || [];
    
    // Sort fields by page first, then by position (top to bottom, left to right)
    const sortedFields = requiredFields.sort((a, b) => {
      if (a.page !== b.page) {
        return (a.page || 1) - (b.page || 1);
      }
      // If same page, sort by Y position (top to bottom), then X position (left to right)
      if (a.y !== b.y) {
        return a.y - b.y;
      }
      return a.x - b.x;
    });

    // Find the first unsigned field
    return sortedFields.find(field => !signedFields[field.id]);
  };

  const autoProgressToNextField = () => {
    const nextField = findNextFieldToSign();
    
    if (nextField) {
      setAutoProgressing(true);
      
      // If the next field is on a different page, navigate to that page first
      const nextFieldPage = nextField.page || 1;
      if (nextFieldPage !== pageNumber) {
        setPageNumber(nextFieldPage);
        // Wait a bit for page to load, then open signature dialog
        setTimeout(() => {
          setSelectedField(nextField);
          setSignatureDialogOpen(true);
          setAutoProgressing(false);
        }, 500);
      } else {
        // Same page, open signature dialog immediately
        setSelectedField(nextField);
        setSignatureDialogOpen(true);
        setAutoProgressing(false);
      }
    } else {
      // No more fields to sign
      setAutoProgressing(false);
    }
  };

  const handleSignatureSubmit = async (signatureData) => {
    try {
      setSigningField(true);
      setError(null);

      // Mark this field as signed locally
      const updatedSignedFields = {
        ...signedFields,
        [selectedField.id]: {
          ...signatureData,
          timestamp: new Date().toISOString(),
          fieldId: selectedField.id
        }
      };
      setSignedFields(updatedSignedFields);

      setSignatureDialogOpen(false);
      setSelectedField(null);

      // Check if all required fields are signed using the updated state
      const participantSigningOrder = workflowData?.participant?.signing_order || 1;
      const requiredFields = workflowData?.document?.fields?.filter(f => f.signingOrder === participantSigningOrder) || [];
      const signedFieldIds = Object.keys(updatedSignedFields);
      const allFieldsSigned = requiredFields.every(field => signedFieldIds.includes(field.id));

      if (allFieldsSigned) {
        // Submit all signatures to backend
        await submitAllSignatures();
      } else if (autoProgressEnabled) {
        // Auto-progress to next field if there are more to sign and auto-progress is enabled
        setTimeout(() => {
          autoProgressToNextField();
        }, 1000); // Small delay to show the signed field
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
      setSigningField(true);
      setError(null);
      
      const participantSigningOrder = workflowData?.participant?.signing_order || 1;
      const requiredFields = workflowData?.document?.fields?.filter(f => f.signingOrder === participantSigningOrder) || [];
      
      // Validate that all required fields are signed
      const unsignedFields = requiredFields.filter(field => !signedFields[field.id]);
      if (unsignedFields.length > 0) {
        setError(`Please sign all required fields before submitting. ${unsignedFields.length} field(s) remaining.`);
        setSigningField(false);
        return;
      }
      
      const signatureData = requiredFields.map(field => {
        const fieldSignature = signedFields[field.id];
        if (!fieldSignature) {
          throw new Error(`No signature data found for field ${field.id}`);
        }
        
        return {
          fieldId: field.id,
          signature: fieldSignature.signature || '',
          timestamp: fieldSignature.timestamp || new Date().toISOString(),
          type: fieldSignature.type || 'typed',
          text: fieldSignature.text || fieldSignature.signature,
          image: fieldSignature.image,
          signatureType: fieldSignature.signatureType || 'Typed Signature',
          position: field // Include full field position data for reliable matching
        };
      });

      const response = await api.post(`/api/v1/workflows/${workflowId}/sign/${participantId}`, {
        signature_data: {
          type: 'field_signatures',
          fields: signatureData,
          timestamp: new Date().toISOString(),
          // Include consent data
          ...consentData
        }
      });

      // Validate response
      if (!response.data) {
        throw new Error('No response data received from server');
      }


      // Update workflow data with response from backend
      setWorkflowData(prev => ({
        ...prev,
        workflow: {
          ...prev.workflow,
          status: response.data.workflow?.status || prev.workflow?.status,
          completed: response.data.workflow?.completed || false
        },
        participant: {
          ...prev.participant,
          status: response.data.participant?.status || 'completed',
          signed_at: response.data.participant?.signed_at || new Date().toISOString()
        }
      }));

      // Update signedFields with digital signature metadata from backend
      const updatedSignedFields = { ...signedFields };
      requiredFields.forEach(field => {
        if (updatedSignedFields[field.id]) {
          updatedSignedFields[field.id] = {
            ...updatedSignedFields[field.id],
            // Add digital signature metadata if available in response
            digitalSignature: response.data.signatures?.digital_signature,
            documentHash: response.data.signatures?.document_hash,
            certificateThumbprint: response.data.signatures?.certificate_thumbprint,
            signatureIds: response.data.signatures?.created_signature_ids
          };
        }
      });
      setSignedFields(updatedSignedFields);

      // Show completion success message
      const isWorkflowComplete = response.data.workflow?.completed;
      const message = isWorkflowComplete 
        ? 'Document signed successfully! All participants have completed signing. Click "Finish" to complete the process.'
        : 'Document signed successfully! Click "Finish" to complete the signing process.';
      
      setError(message);
      setSigningComplete(true);

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

    // Note: screenCoords will be calculated by UnifiedDocumentViewer
    // We just need to return the field styling and content

    return (
      <Box
        onClick={() => handleFieldClick(field)}
        sx={{
          // Position and size are now handled by UnifiedDocumentViewer wrapper
          width: '100%',
          height: '100%',
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
          <Box sx={{ 
            textAlign: 'center', 
            p: 0.5,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.05) 0%, rgba(76, 175, 80, 0.1) 100%)',
            borderRadius: '4px',
            border: '1px solid rgba(76, 175, 80, 0.3)'
          }}>
            {/* Professional Signature Display */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              mb: 0.5,
              gap: 0.5
            }}>
              <CheckCircle sx={{ color: '#2E7D32', fontSize: 14 }} />
              <Typography variant="caption" sx={{ 
                color: '#2E7D32', 
                fontSize: '8px', 
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Signed
              </Typography>
            </Box>

            {/* Signature Content */}
            {signedFields[field.id]?.type === 'typed' || signedFields[field.id]?.type === 'adopted' ? (
              <Typography 
                variant="caption" 
                sx={{ 
                  color: '#1B5E20', 
                  fontSize: field.height > 40 ? '11px' : '9px',
                  fontFamily: "'Dancing Script', cursive",
                  display: 'block',
                  fontWeight: 'bold',
                  lineHeight: 1.2,
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {signedFields[field.id]?.text}
              </Typography>
            ) : signedFields[field.id]?.type === 'drawn' ? (
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center',
                alignItems: 'center',
                maxWidth: '100%',
                maxHeight: field.height > 40 ? '30px' : '20px'
              }}>
                <img 
                  src={signedFields[field.id]?.image} 
                  alt="Signature" 
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '100%',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))'
                  }}
                />
              </Box>
            ) : (
              <Typography variant="caption" sx={{ 
                color: '#1B5E20', 
                fontSize: '9px',
                fontWeight: 'bold'
              }}>
                ✓ Signed
              </Typography>
            )}

            {/* Timestamp and Type */}
            <Box sx={{ 
              mt: 0.5,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.25
            }}>
              <Typography variant="caption" sx={{ 
                color: '#4CAF50', 
                fontSize: '7px', 
                fontWeight: '500',
                opacity: 0.8
              }}>
                {signedFields[field.id]?.signatureType}
              </Typography>
              
              {/* Timestamp */}
              {signedFields[field.id]?.timestamp && (
                <Typography variant="caption" sx={{ 
                  color: '#666', 
                  fontSize: '6px',
                  opacity: 0.7
                }}>
                  {new Date(signedFields[field.id].timestamp).toLocaleDateString()}
                </Typography>
              )}
            </Box>

            {/* Digital Signature Badge */}
            {signedFields[field.id]?.digitalSignature && (
              <Box sx={{ 
                position: 'absolute',
                top: 2,
                right: 2,
                display: 'flex', 
                alignItems: 'center', 
                gap: 0.25,
                backgroundColor: 'rgba(46, 125, 50, 0.9)',
                borderRadius: '2px',
                px: 0.5,
                py: 0.25
              }}>
                <Box sx={{ 
                  width: 3, 
                  height: 3, 
                  backgroundColor: '#fff', 
                  borderRadius: '50%' 
                }} />
                <Typography variant="caption" sx={{ 
                  color: '#fff', 
                  fontSize: '5px', 
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px'
                }}>
                  Digital
                </Typography>
              </Box>
            )}

            {/* Professional Border Effect */}
            <Box sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              border: '1px solid rgba(76, 175, 80, 0.2)',
              borderRadius: '4px',
              pointerEvents: 'none'
            }} />
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

  // Show loading or error state
  if (loading || error) {
    return (
      <LoadingErrorState
        loading={loading}
        error={error}
        onRetry={() => {
          setError(null);
          loadSigningData();
        }}
        loadingMessage="Loading document for signing..."
        fullHeight={true}
      />
    );
  }

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
            {autoProgressing && (
              <Chip 
                icon={<CircularProgress size={12} sx={{ color: '#7B5CFF' }} />}
                label="Moving to next field..."
                color="primary"
                variant="outlined"
                sx={{ 
                  backgroundColor: 'rgba(123, 92, 255, 0.1)',
                  borderColor: '#7B5CFF',
                  color: '#7B5CFF'
                }}
              />
            )}
            {!isCompleted && !signingComplete && (
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={handleDeclineSigning}
                disabled={loading}
                sx={{ 
                  borderColor: '#f44336',
                  color: '#f44336',
                  '&:hover': {
                    borderColor: '#d32f2f',
                    backgroundColor: 'rgba(244, 67, 54, 0.04)'
                  }
                }}
              >
                Decline to Sign
              </Button>
            )}
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
            <Alert 
              severity={isCompleted || signingComplete ? "success" : "error"} 
              sx={{ 
                m: 2, 
                mb: 0,
                '& .MuiAlert-action': {
                  alignItems: 'center',
                  padding: '8px 0'
                }
              }}
              action={isCompleted || signingComplete ? (
                <Button
                  color="inherit"
                  size="small"
                  variant="contained"
                  onClick={() => navigate('/signing-complete', { 
                    state: { 
                      documentTitle: workflowData?.document?.title,
                      workflowName: workflowData?.workflow?.name,
                      participantEmail: workflowData?.participant?.email,
                      signedAt: workflowData?.participant?.signed_at || new Date().toISOString(),
                      workflowCompleted: workflowData?.workflow?.completed || false,
                      workflowStatus: workflowData?.workflow?.status
                    }
                  })}
                  sx={{ 
                    backgroundColor: '#4CAF50',
                    '&:hover': { backgroundColor: '#45a049' },
                    minWidth: '80px',
                    height: '32px'
                  }}
                >
                  Finish
                </Button>
              ) : null}
            >
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
              <UnifiedDocumentViewer
                documentUrl={workflowData.document.file_url}
                fields={workflowData.document?.fields || []}
                signatures={getAllSignatures()}
                documentId={workflowData.document?.id}
                scale={1.0}
                onScaleChange={() => {}} // No zoom controls in public signing
                onPdfLoad={onDocumentLoadSuccess}
                onPageChange={setPageNumber}
                pageNumber={pageNumber}
                numPages={numPages}
                showControls={false}
                showFields={true}
                fieldRenderer={renderSignatureField}
                containerRef={pdfContainerRef}
                sx={{ 
                  flex: 1, 
                  overflow: 'auto', 
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: '#f5f5f5',
                  minHeight: 0,
                  position: 'relative'
                }}
              />
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
          
          {/* Finish Button - Show when signing is complete */}
          {signingComplete && (
            <Box sx={{ 
              p: 2, 
              display: 'flex', 
              justifyContent: 'center',
              borderTop: '1px solid #e0e0e0',
              backgroundColor: '#f8f9fa'
            }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate('/signing-complete', { 
                  state: { 
                    documentTitle: workflowData?.document?.title,
                    workflowName: workflowData?.workflow?.name,
                    participantEmail: workflowData?.participant?.email,
                    signedAt: workflowData?.participant?.signed_at || new Date().toISOString(),
                    workflowCompleted: workflowData?.workflow?.completed || false,
                    workflowStatus: workflowData?.workflow?.status
                  }
                })}
                sx={{ 
                  backgroundColor: '#4CAF50',
                  '&:hover': { backgroundColor: '#45a049' },
                  px: 4,
                  py: 1.5
                }}
              >
                Finish Signing
              </Button>
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
              
              {/* Auto-Progress Toggle */}
              <FormControlLabel
                control={
                  <Switch
                    checked={autoProgressEnabled}
                    onChange={(e) => setAutoProgressEnabled(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      Auto-Progress
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Automatically move to next field after signing
                    </Typography>
                  </Box>
                }
                sx={{ 
                  alignItems: 'flex-start',
                  '& .MuiFormControlLabel-label': {
                    marginLeft: 1
                  }
                }}
              />
              
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
              {/* Page indicator */}
              {numPages && numPages > 1 && (
                <Box sx={{ mb: 2, p: 1, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
                  <Typography variant="body2" gutterBottom>
                    <strong>Current Page:</strong> {pageNumber} of {numPages}
                  </Typography>
              <Typography variant="caption" color="text.secondary">
                Use the navigation buttons to find signature fields on other pages
              </Typography>
              {(() => {
                const userFields = workflowData?.document?.fields?.filter(f => f.signingOrder === (workflowData?.participant?.signing_order || 1)) || [];
                const pagesWithFields = [...new Set(userFields.map(f => f.page || 1))];
                if (pagesWithFields.length > 0) {
                  return (
                    <Typography variant="caption" color="primary" sx={{ display: 'block', mt: 1 }}>
                      Signature fields are on pages: {pagesWithFields.sort((a, b) => a - b).join(', ')}
                    </Typography>
                  );
                }
                return null;
              })()}
                </Box>
              )}
              
              {/* Progress Indicator */}
              {(() => {
                const participantSigningOrder = workflowData?.participant?.signing_order || 1;
                const userFields = workflowData?.document?.fields?.filter(f => f.signingOrder === participantSigningOrder) || [];
                const signedCount = userFields.filter(f => signedFields[f.id]).length;
                const totalCount = userFields.length;
                
                if (totalCount > 0) {
                  return (
                    <Box sx={{ mb: 2, p: 2, backgroundColor: '#f0f8ff', borderRadius: 1, border: '1px solid #e3f2fd' }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ color: '#1976d2', fontWeight: 'bold' }}>
                        Signing Progress
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Box sx={{ 
                          flex: 1, 
                          height: 8, 
                          backgroundColor: '#e3f2fd', 
                          borderRadius: 4,
                          overflow: 'hidden'
                        }}>
                          <Box sx={{ 
                            width: `${(signedCount / totalCount) * 100}%`, 
                            height: '100%', 
                            backgroundColor: '#4CAF50',
                            transition: 'width 0.3s ease'
                          }} />
                        </Box>
                        <Typography variant="caption" sx={{ color: '#1976d2', fontWeight: 'bold', minWidth: '60px' }}>
                          {signedCount}/{totalCount}
                        </Typography>
                      </Box>
                      <Typography variant="caption" sx={{ color: '#666' }}>
                        {signedCount === totalCount ? 'All fields completed!' : `${totalCount - signedCount} field${totalCount - signedCount === 1 ? '' : 's'} remaining`}
                      </Typography>
                    </Box>
                  );
                }
                return null;
              })()}
              
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
                        <Box sx={{
                          p: 1.5,
                          backgroundColor: 'rgba(76, 175, 80, 0.05)',
                          borderRadius: 2,
                          border: '1px solid rgba(76, 175, 80, 0.2)',
                          borderLeft: '4px solid #4CAF50'
                        }}>
                          {/* Professional Header */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                            <CheckCircle sx={{ color: '#2E7D32', fontSize: 18 }} />
                            <Box>
                              <Typography variant="caption" sx={{ 
                                color: '#2E7D32', 
                                fontWeight: 'bold',
                                fontSize: '11px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}>
                                ✓ Signed
                              </Typography>
                              <Typography variant="caption" sx={{ 
                                color: '#4CAF50', 
                                display: 'block',
                                fontSize: '9px',
                                fontWeight: '500'
                              }}>
                                {signedFields[field.id].signatureType}
                              </Typography>
                            </Box>
                          </Box>

                          {/* Signature Content */}
                          {signedFields[field.id].type === 'typed' || signedFields[field.id].type === 'adopted' ? (
                            <Box sx={{ 
                              p: 1, 
                              backgroundColor: '#fff', 
                              borderRadius: 1, 
                              border: '1px solid rgba(76, 175, 80, 0.1)',
                              mb: 1
                            }}>
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  color: '#1B5E20', 
                                  fontFamily: "'Dancing Script', cursive",
                                  fontSize: '14px',
                                  fontWeight: 'bold',
                                  display: 'block',
                                  textAlign: 'center'
                                }}
                              >
                                {signedFields[field.id].text}
                              </Typography>
                            </Box>
                          ) : signedFields[field.id].type === 'drawn' ? (
                            <Box sx={{ 
                              p: 1, 
                              backgroundColor: '#fff', 
                              borderRadius: 1, 
                              border: '1px solid rgba(76, 175, 80, 0.1)',
                              mb: 1,
                              display: 'flex',
                              justifyContent: 'center'
                            }}>
                              <img 
                                src={signedFields[field.id].image} 
                                alt="Signature" 
                                style={{ 
                                  maxWidth: '120px', 
                                  maxHeight: '50px',
                                  objectFit: 'contain',
                                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                                }}
                              />
                            </Box>
                          ) : null}

                          {/* Timestamp */}
                          {signedFields[field.id]?.timestamp && (
                            <Typography variant="caption" sx={{ 
                              color: '#666', 
                              fontSize: '8px',
                              display: 'block',
                              mb: 1,
                              fontStyle: 'italic'
                            }}>
                              Signed on {new Date(signedFields[field.id].timestamp).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </Typography>
                          )}

                          {/* Digital Signature Information */}
                          {signedFields[field.id]?.digitalSignature && (
                            <Box sx={{ 
                              p: 1, 
                              backgroundColor: 'rgba(46, 125, 50, 0.1)', 
                              borderRadius: 1, 
                              border: '1px solid rgba(46, 125, 50, 0.3)',
                              borderLeft: '3px solid #2E7D32'
                            }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                <Box sx={{ 
                                  width: 8, 
                                  height: 8, 
                                  backgroundColor: '#2E7D32', 
                                  borderRadius: '50%' 
                                }} />
                                <Typography variant="caption" sx={{ 
                                  color: '#2E7D32', 
                                  fontSize: '10px', 
                                  fontWeight: 'bold',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px'
                                }}>
                                  Digitally Signed
                                </Typography>
                              </Box>
                              <Typography variant="caption" sx={{ 
                                color: '#1B5E20', 
                                fontSize: '9px', 
                                display: 'block',
                                fontStyle: 'italic',
                                lineHeight: 1.3
                              }}>
                                This signature is cryptographically secured and legally binding
                              </Typography>
                            </Box>
                          )}
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