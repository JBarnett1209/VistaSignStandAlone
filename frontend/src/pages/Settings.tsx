import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Switch,
  FormControlLabel,
  Divider,
  Alert
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

const Settings: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    email_notifications: true,
    signature_reminders: true,
    document_updates: true,
    workflow_notifications: true,
    two_factor_auth: false,
    auto_save: true
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  const handleToggle = (setting: string) => {
    setSettings(prev => ({
      ...prev,
      [setting]: !prev[setting as keyof typeof prev]
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      // TODO: Implement settings save API call
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      setSuccess('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Notifications
              </Typography>
              <Box sx={{ mb: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.email_notifications}
                      onChange={() => handleToggle('email_notifications')}
                    />
                  }
                  label="Email Notifications"
                />
              </Box>
              <Box sx={{ mb: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.signature_reminders}
                      onChange={() => handleToggle('signature_reminders')}
                    />
                  }
                  label="Signature Reminders"
                />
              </Box>
              <Box sx={{ mb: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.document_updates}
                      onChange={() => handleToggle('document_updates')}
                    />
                  }
                  label="Document Updates"
                />
              </Box>
              <Box sx={{ mb: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.workflow_notifications}
                      onChange={() => handleToggle('workflow_notifications')}
                    />
                  }
                  label="Workflow Notifications"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Security
              </Typography>
              <Box sx={{ mb: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.two_factor_auth}
                      onChange={() => handleToggle('two_factor_auth')}
                    />
                  }
                  label="Two-Factor Authentication"
                />
              </Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Add an extra layer of security to your account
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Preferences
              </Typography>
              <Box sx={{ mb: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.auto_save}
                      onChange={() => handleToggle('auto_save')}
                    />
                  }
                  label="Auto-save Documents"
                />
              </Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Automatically save your work as you type
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Account
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Button variant="outlined" fullWidth>
                  Change Password
                </Button>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Button variant="outlined" fullWidth color="error">
                  Delete Account
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Box>
    </Box>
  );
};

export default Settings;
