import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Alert,
  Snackbar,
  Tooltip,
  Divider,
  Grid,
  InputAdornment
} from '@mui/material';
import {
  Add as AddIcon,
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Security as SecurityIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import api from '../services/api';

const SCOPE_DESCRIPTIONS = {
  read: 'Read access to your data and logs',
  write: 'Write access to documents and signatures',
  admin: 'Full administrative access (admin users only)'
};

const SCOPE_COLORS = {
  read: 'primary',
  write: 'secondary',
  admin: 'error'
};

export default function ApiTokenManager() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newToken, setNewToken] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  
  // Form state for creating new token
  const [tokenName, setTokenName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState(['read']);
  const [expiresDays, setExpiresDays] = useState(365);
  const [showNewToken, setShowNewToken] = useState(false);

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api-tokens/');
      setTokens(response.data);
    } catch (error) {
      console.error('Error loading API tokens:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load API tokens',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const createToken = async () => {
    try {
      setLoading(true);
      const response = await api.post('/api-tokens/', {
        name: tokenName,
        scopes: selectedScopes,
        expires_days: expiresDays
      });
      
      setNewToken(response.data);
      setShowNewToken(true);
      setSnackbar({
        open: true,
        message: 'API token created successfully!',
        severity: 'success'
      });
      
      // Reset form
      setTokenName('');
      setSelectedScopes(['read']);
      setExpiresDays(365);
      setCreateDialogOpen(false);
      
      // Reload tokens
      loadTokens();
    } catch (error) {
      console.error('Error creating API token:', error);
      setSnackbar({
        open: true,
        message: 'Failed to create API token',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const revokeToken = async (tokenId) => {
    if (!window.confirm('Are you sure you want to revoke this API token? This action cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/api-tokens/${tokenId}`);
      setSnackbar({
        open: true,
        message: 'API token revoked successfully',
        severity: 'success'
      });
      loadTokens();
    } catch (error) {
      console.error('Error revoking API token:', error);
      setSnackbar({
        open: true,
        message: 'Failed to revoke API token',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setSnackbar({
        open: true,
        message: 'Copied to clipboard!',
        severity: 'success'
      });
    }).catch(() => {
      setSnackbar({
        open: true,
        message: 'Failed to copy to clipboard',
        severity: 'error'
      });
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const isExpired = (expiresAt) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const getStatusColor = (token) => {
    if (!token.is_active) return 'error';
    if (isExpired(token.expires_at)) return 'warning';
    return 'success';
  };

  const getStatusText = (token) => {
    if (!token.is_active) return 'Revoked';
    if (isExpired(token.expires_at)) return 'Expired';
    return 'Active';
  };

  return (
    <Box>
      <Card>
        <CardHeader
          title={
            <Box display="flex" alignItems="center" gap={1}>
              <SecurityIcon />
              <Typography variant="h6">API Tokens</Typography>
            </Box>
          }
          subheader="Manage API tokens for programmatic access to your account"
          action={
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
              disabled={loading}
            >
              Create Token
            </Button>
          }
        />
        <CardContent>
          {tokens.length === 0 ? (
            <Box textAlign="center" py={4}>
              <SecurityIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No API tokens created
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Create an API token to access your account programmatically
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateDialogOpen(true)}
              >
                Create Your First Token
              </Button>
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Token</TableCell>
                    <TableCell>Scopes</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Last Used</TableCell>
                    <TableCell>Expires</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tokens.map((token) => (
                    <TableRow key={token.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {token.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2" fontFamily="monospace">
                            {token.token_prefix}...
                          </Typography>
                          <Tooltip title="Copy token prefix">
                            <IconButton
                              size="small"
                              onClick={() => copyToClipboard(token.token_prefix)}
                            >
                              <CopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" gap={0.5} flexWrap="wrap">
                          {token.scopes.split(',').map((scope) => (
                            <Chip
                              key={scope}
                              label={scope}
                              size="small"
                              color={SCOPE_COLORS[scope.trim()] || 'default'}
                              variant="outlined"
                            />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusText(token)}
                          color={getStatusColor(token)}
                          size="small"
                          icon={getStatusColor(token) === 'success' ? <CheckCircleIcon /> : undefined}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(token.last_used_at)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {token.expires_at ? formatDate(token.expires_at) : 'Never'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title="Revoke token">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => revokeToken(token.id)}
                            disabled={loading}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Create Token Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create API Token</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={3} pt={1}>
            <TextField
              label="Token Name"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              placeholder="e.g., Debug Token, Production API"
              fullWidth
              required
            />

            <FormControl component="fieldset">
              <FormLabel component="legend">Scopes</FormLabel>
              <FormGroup>
                {Object.entries(SCOPE_DESCRIPTIONS).map(([scope, description]) => (
                  <FormControlLabel
                    key={scope}
                    control={
                      <Checkbox
                        checked={selectedScopes.includes(scope)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedScopes([...selectedScopes, scope]);
                          } else {
                            setSelectedScopes(selectedScopes.filter(s => s !== scope));
                          }
                        }}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {scope}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {description}
                        </Typography>
                      </Box>
                    }
                  />
                ))}
              </FormGroup>
            </FormControl>

            <TextField
              label="Expires In (Days)"
              type="number"
              value={expiresDays}
              onChange={(e) => setExpiresDays(parseInt(e.target.value) || 365)}
              InputProps={{
                endAdornment: <InputAdornment position="end">days</InputAdornment>
              }}
              helperText="Leave empty for no expiration"
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={createToken}
            variant="contained"
            disabled={!tokenName || selectedScopes.length === 0 || loading}
          >
            Create Token
          </Button>
        </DialogActions>
      </Dialog>

      {/* New Token Display Dialog */}
      <Dialog open={showNewToken} onClose={() => setShowNewToken(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <CheckCircleIcon color="success" />
            API Token Created
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight="bold">
              Important: Save this token now!
            </Typography>
            <Typography variant="body2">
              This is the only time you'll see the full token. Copy it to a secure location.
            </Typography>
          </Alert>

          <Box display="flex" flexDirection="column" gap={2}>
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Token Name
              </Typography>
              <Typography variant="body1" fontWeight="medium">
                {newToken?.token_info?.name}
              </Typography>
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                API Token
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <TextField
                  value={newToken?.token || ''}
                  fullWidth
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => copyToClipboard(newToken?.token)}
                          edge="end"
                        >
                          <CopyIcon />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                  sx={{
                    '& .MuiInputBase-input': {
                      fontFamily: 'monospace',
                      fontSize: '0.875rem'
                    }
                  }}
                />
              </Box>
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Usage Example
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="body2" fontFamily="monospace" component="pre">
{`curl -H "Authorization: Bearer ${newToken?.token}" \\
  https://vistasign.unitvista.com/api/v1/logs/`}
                </Typography>
              </Paper>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowNewToken(false)} variant="contained">
            I've Saved the Token
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
