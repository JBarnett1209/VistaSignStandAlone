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
import FieldRenderer from '../components/document-editor/FieldRenderer';
import { handleError } from '../utils/errorHandler';
import LoadingErrorState from '../components/LoadingErrorState';

export default function PublicSigning() {
  const { workflowId, participantId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [workflowData, setWorkflowData] = useState(null);
  const [documentData, setDocumentData] = useState(null);
  const [signedFields, setSignedFields] = useState({});
  const [showConsent, setShowConsent] = useState(false);
  const [showSignatureCapture, setShowSignatureCapture] = useState(false);
  const [currentField, setCurrentField] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [scale, setScale] = useState(1);
  const [pdfOffset, setPdfOffset] = useState({ x: 0, y: 0 });

  const loadSigningData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get(`/api/v1/public-signing/${workflowId}/${participantId}`);
      const data = response.data;

      setWorkflowData(data.workflow);
      setDocumentData(data.document);
      setSignedFields(data.signedFields || {});

      // Check if consent is required
      if (data.workflow.requireConsent && !data.workflow.participant.consentGiven) {
        setShowConsent(true);
      }
    } catch (err) {
      console.error('Error loading signing data:', err);
      setError(handleError(err));
    } finally {
      setLoading(false);
    }
  }, [workflowId, participantId]);

  const handlePdfOffsetChange = useCallback((offset) => {
    setPdfOffset(offset);
  }, []);

  const handleScaleChange = useCallback((newScale) => {
    setScale(newScale);
  }, []);

  useEffect(() => {
    if (workflowId && participantId) {
      loadSigningData();
    }
  }, [workflowId, participantId, loadSigningData]);

  const handleConsentAccept = async () => {
    try {
      await api.post(`/api/v1/public-signing/${workflowId}/${participantId}/consent`);
      setShowConsent(false);
      // Reload data to get updated consent status
      await loadSigningData();
    } catch (err) {
      console.error('Error accepting consent:', err);
      setError('Failed to accept consent. Please try again.');
    }
  };

  const handleConsentDecline = () => {
    navigate('/signing-declined');
  };

  const handleFieldClick = (field) => {
    const isSigned = signedFields[field.id];
    const participantSigningOrder = workflowData?.participant?.signing_order || 1;
    const isAssignedToMe = field.signingOrder === participantSigningOrder;
    const isClickable = !isCompleted && isAssignedToMe && !isSigned;

    if (isClickable) {
      setCurrentField(field);
      setShowSignatureCapture(true);
    }
  };

  const handleSignatureComplete = async (signatureData) => {
    try {
      if (!currentField) return;

      // Store the signature data
      setSignedFields(prev => ({
        ...prev,
        [currentField.id]: {
          ...signatureData,
          timestamp: new Date().toISOString(),
          fieldId: currentField.id
        }
      }));

      setShowSignatureCapture(false);
      setCurrentField(null);
    } catch (err) {
      console.error('Error saving signature:', err);
      setError('Failed to save signature. Please try again.');
    }
  };

  const handleSubmitSignatures = async () => {
    try {
      setSubmitting(true);
      
      const signatureData = Object.values(signedFields).map(sig => ({
        fieldId: sig.fieldId,
        signatureType: sig.type,
        signatureData: sig.type === 'drawn' ? sig.image : sig.text,
        timestamp: sig.timestamp
      }));

      await api.post(`/api/v1/public-signing/${workflowId}/${participantId}/submit`, {
        signatures: signatureData
      });

      // Redirect to completion page
      navigate('/signing-complete');
    } catch (err) {
      console.error('Error submitting signatures:', err);
      setError('Failed to submit signatures. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

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

  // Show consent dialog if required
  if (showConsent) {
    return (
      <ConsentDialog
        open={showConsent}
        onAccept={handleConsentAccept}
        onDecline={handleConsentDecline}
        workflowTitle={workflowData?.title}
        participantName={workflowData?.participant?.name}
      />
    );
  }

  // Show signature capture dialog
  if (showSignatureCapture && currentField) {
    return (
      <SignatureCapture
        open={showSignatureCapture}
        onClose={() => {
          setShowSignatureCapture(false);
          setCurrentField(null);
        }}
        onComplete={handleSignatureComplete}
        fieldType={currentField.type}
        fieldLabel={currentField.label}
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
        p: 3, 
        mb: 2, 
        borderRadius: 0,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" sx={{ 
              fontWeight: 'bold', 
              color: '#333',
              mb: 1
            }}>
              {workflowData?.title || 'Document Signing'}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Please review and sign the document below
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip 
              label={isCompleted ? 'Completed' : 'Pending'} 
              color={isCompleted ? 'success' : 'warning'}
              variant="outlined"
            />
            {workflowData?.participant?.name && (
              <Typography variant="body2" color="text.secondary">
                Signing as: {workflowData.participant.name}
              </Typography>
            )}
          </Box>
        </Box>
      </Paper>

      {/* Document Viewer */}
      <Box sx={{ flex: 1, p: 2 }}>
        <Paper sx={{ 
          height: 'calc(100vh - 200px)',
          overflow: 'hidden',
          borderRadius: 2,
          boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
        }}>
          <UnifiedDocumentViewer
            document={documentData}
            fields={workflowData?.fields || []}
            signedFields={signedFields}
            onFieldClick={handleFieldClick}
            scale={scale}
            onScaleChange={handleScaleChange}
            onPdfOffsetChange={handlePdfOffsetChange}
            fieldRenderer={(field, screenCoords) => (
              <FieldRenderer
                field={field}
                screenCoords={screenCoords}
                isSigned={!!signedFields[field.id]}
                onClick={() => handleFieldClick(field)}
                signedData={signedFields[field.id]}
              />
            )}
            readOnly={isCompleted}
          />
        </Paper>
      </Box>

      {/* Footer with Submit Button */}
      {!isCompleted && (
        <Paper sx={{ 
          p: 3, 
          borderRadius: 0,
          boxShadow: '0 -2px 4px rgba(0,0,0,0.1)'
        }}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center' 
          }}>
            <Typography variant="body2" color="text.secondary">
              {Object.keys(signedFields).length} of {workflowData?.fields?.length || 0} fields signed
            </Typography>
            
            <Button
              variant="contained"
              size="large"
              onClick={handleSubmitSignatures}
              disabled={submitting || Object.keys(signedFields).length === 0}
              sx={{
                backgroundColor: '#7B5CFF',
                '&:hover': {
                  backgroundColor: '#6A4CFF'
                },
                px: 4,
                py: 1.5
              }}
            >
              {submitting ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1, color: 'white' }} />
                  Submitting...
                </>
              ) : (
                'Submit Signatures'
              )}
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  );
}