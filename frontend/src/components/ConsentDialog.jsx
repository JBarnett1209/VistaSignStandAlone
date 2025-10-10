import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Checkbox,
  FormControlLabel,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Security as SecurityIcon,
  LocationOn as LocationIcon,
  Fingerprint as FingerprintIcon,
  Description as DocumentIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

const ConsentDialog = ({ 
  open, 
  onAccept, 
  onDecline,
  participantInfo = null,
  documentInfo = null 
}) => {
  const [consentGiven, setConsentGiven] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [legalBindingAccepted, setLegalBindingAccepted] = useState(false);

  const handleAccept = () => {
    if (consentGiven && privacyAccepted && legalBindingAccepted) {
      onAccept({
        consentGiven: true,
        privacyAccepted: true,
        legalBindingAccepted: true,
        timestamp: new Date().toISOString()
      });
    }
  };

  const allAccepted = consentGiven && privacyAccepted && legalBindingAccepted;

  return (
    <Dialog 
      open={open} 
      onClose={() => {}} // Prevent closing without decision
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '600px' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <SecurityIcon sx={{ color: '#7B5CFF', fontSize: 28 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Digital Signature Consent
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Legal and Privacy Information
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pb: 2 }}>
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Important:</strong> By signing this document, you are creating a legally binding digital signature. 
            Please read all information below before proceeding.
          </Typography>
        </Alert>

        {/* Document Information */}
        {documentInfo && (
          <Box sx={{ mb: 3, p: 2, backgroundColor: '#f8f9fa', borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <DocumentIcon sx={{ color: '#7B5CFF' }} />
              Document Information
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Document:</strong> {documentInfo.title}<br/>
              <strong>Workflow:</strong> {documentInfo.workflowName}<br/>
              <strong>Your Signing Order:</strong> #{participantInfo?.signingOrder || 1}
            </Typography>
          </Box>
        )}

        {/* Data Collection Notice */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FingerprintIcon sx={{ color: '#7B5CFF' }} />
            Data Collection & Privacy
          </Typography>
          
          <Typography variant="body2" paragraph>
            To create a legally binding digital signature and maintain an audit trail, we collect the following information:
          </Typography>

          <List dense>
            <ListItem>
              <ListItemIcon>
                <LocationIcon sx={{ color: '#7B5CFF', fontSize: 20 }} />
              </ListItemIcon>
              <ListItemText 
                primary="IP Address" 
                secondary="Your internet protocol address for legal verification"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <FingerprintIcon sx={{ color: '#7B5CFF', fontSize: 20 }} />
              </ListItemIcon>
              <ListItemText 
                primary="Device Information" 
                secondary="Browser type, operating system, and device details"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <DocumentIcon sx={{ color: '#7B5CFF', fontSize: 20 }} />
              </ListItemIcon>
              <ListItemText 
                primary="Signature Data" 
                secondary="Your signature, timestamp, and signing method"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <SecurityIcon sx={{ color: '#7B5CFF', fontSize: 20 }} />
              </ListItemIcon>
              <ListItemText 
                primary="Legal Metadata" 
                secondary="Document hash, certificate data, and audit trail"
              />
            </ListItem>
          </List>

          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Data Retention:</strong> This information is stored securely and may be retained for legal and compliance purposes as required by law.
            </Typography>
          </Alert>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Legal Binding Notice */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckIcon sx={{ color: '#4CAF50' }} />
            Legal Binding Agreement
          </Typography>
          
          <Typography variant="body2" paragraph>
            Your digital signature will be:
          </Typography>

          <List dense>
            <ListItem>
              <ListItemIcon>
                <CheckIcon sx={{ color: '#4CAF50', fontSize: 20 }} />
              </ListItemIcon>
              <ListItemText 
                primary="Cryptographically Secured" 
                secondary="Protected with industry-standard encryption"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckIcon sx={{ color: '#4CAF50', fontSize: 20 }} />
              </ListItemIcon>
              <ListItemText 
                primary="Legally Binding" 
                secondary="Enforceable under ESIGN Act, UETA, and eIDAS regulations"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckIcon sx={{ color: '#4CAF50', fontSize: 20 }} />
              </ListItemIcon>
              <ListItemText 
                primary="Non-Repudiable" 
                secondary="Cannot be denied or disputed once applied"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckIcon sx={{ color: '#4CAF50', fontSize: 20 }} />
              </ListItemIcon>
              <ListItemText 
                primary="Audit Trail" 
                secondary="Complete record of signing process and verification"
              />
            </ListItem>
          </List>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Consent Checkboxes */}
        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Typography variant="body2">
                <strong>I consent to the collection and processing of my data</strong> as described above for the purpose of creating a legally binding digital signature.
              </Typography>
            }
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={privacyAccepted}
                onChange={(e) => setPrivacyAccepted(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Typography variant="body2">
                <strong>I acknowledge the privacy notice</strong> and understand how my data will be used, stored, and protected.
              </Typography>
            }
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={legalBindingAccepted}
                onChange={(e) => setLegalBindingAccepted(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Typography variant="body2">
                <strong>I understand that my digital signature will be legally binding</strong> and equivalent to a handwritten signature under applicable law.
              </Typography>
            }
          />
        </Box>

        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Your Rights:</strong> You have the right to withdraw consent before signing, request access to your data, and file complaints with relevant authorities. 
            However, once you sign, the signature becomes legally binding and cannot be withdrawn.
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button 
          onClick={onDecline}
          variant="outlined"
          color="error"
          size="large"
        >
          Decline & Exit
        </Button>
        <Button 
          onClick={handleAccept}
          variant="contained"
          disabled={!allAccepted}
          size="large"
          sx={{ minWidth: 200 }}
        >
          Accept & Continue to Sign
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConsentDialog;
