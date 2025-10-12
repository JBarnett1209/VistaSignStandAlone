import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  Stack,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  IconButton,
  Tooltip,
  Pagination,
  Grid,
  Card,
  CardContent
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Restore as RestoreIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Person as PersonIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { signaturesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function AdminSignatures() {
  const { user } = useAuth();
  const [signatures, setSignatures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [deletedCount, setDeletedCount] = useState(0);
  
  // Filters
  const [filters, setFilters] = useState({
    include_deleted: false,
    status: '',
    signature_level: '',
    user_id: '',
    document_id: ''
  });
  
  // Search
  const [searchTerm, setSearchTerm] = useState('');
  
  // Dialogs
  const [viewDialog, setViewDialog] = useState({ open: false, signature: null });
  const [restoreDialog, setRestoreDialog] = useState({ open: false, signature: null });
  const [userLookupDialog, setUserLookupDialog] = useState({ open: false, user: null });
  
  // User lookup
  const [userLookupTerm, setUserLookupTerm] = useState('');
  const [userLookupLoading, setUserLookupLoading] = useState(false);
  const [userLookupError, setUserLookupError] = useState(null);

  const loadSignatures = async () => {
    setLoading(true);
    setError(null);
    try {
      // Map frontend filter names to backend parameter names
      const params = {
        skip: (page - 1) * limit,
        limit,
        include_deleted: filters.include_deleted,
        status_filter: filters.status || undefined, // Backend expects status_filter
        signature_level: filters.signature_level || undefined,
        user_id: filters.user_id || undefined,
        document_id: filters.document_id || undefined
      };
      
      // Remove undefined values to avoid sending empty parameters
      Object.keys(params).forEach(key => {
        if (params[key] === undefined || params[key] === '') {
          delete params[key];
        }
      });
      
      console.log('AdminSignatures: Loading signatures with params:', params);
      
      const response = await signaturesAPI.admin.listAll(params);
      const data = response.data;
      
      console.log('AdminSignatures: Received response:', data);
      
      setSignatures(data.signatures || []);
      setTotal(data.total || 0);
      setDeletedCount(data.deleted_count || 0);
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to load signatures';
      setError(`Error: ${errorMessage}`);
      console.error('Error loading signatures:', err);
      console.error('Error response:', err.response?.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSignatures();
  }, [page, filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page when filtering
  };

  const handleSearch = () => {
    // For now, search is handled by filters
    // You could implement server-side search if needed
    loadSignatures();
  };

  const handleRestore = async (signature) => {
    try {
      await signaturesAPI.admin.restore(signature.id);
      await loadSignatures();
      setRestoreDialog({ open: false, signature: null });
    } catch (err) {
      setError('Failed to restore signature');
      console.error('Error restoring signature:', err);
    }
  };

  const handleUserLookup = async () => {
    if (!userLookupTerm.trim()) return;
    
    setUserLookupLoading(true);
    setUserLookupError(null);
    
    try {
      // Try to find user by email or UUID
      const response = await signaturesAPI.admin.listAll({ 
        user_id: userLookupTerm.trim(),
        limit: 1 
      });
      
      if (response.data.signatures && response.data.signatures.length > 0) {
        const signature = response.data.signatures[0];
        // Get user info from the signature
        const userInfo = {
          id: signature.signer_id,
          email: signature.signer_email,
          name: signature.signer_name,
          // We'll need to get more user details from a separate API call
        };
        setUserLookupDialog({ open: true, user: userInfo });
      } else {
        setUserLookupError('User not found');
      }
    } catch (err) {
      setUserLookupError('Failed to lookup user');
      console.error('Error looking up user:', err);
    } finally {
      setUserLookupLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'pending': return 'warning';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  const getSignatureLevelColor = (level) => {
    switch (level) {
      case 'qualified': return 'error';
      case 'advanced': return 'warning';
      case 'simple': return 'info';
      default: return 'default';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const filteredSignatures = signatures.filter(sig => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      sig.signer_email?.toLowerCase().includes(searchLower) ||
      sig.signer_name?.toLowerCase().includes(searchLower) ||
      sig.document_title?.toLowerCase().includes(searchLower) ||
      sig.id.toLowerCase().includes(searchLower)
    );
  });

  // Check if user has admin role
  if (user?.role !== 'admin') {
    return (
      <Box className="content-section" sx={{ 
        width: '100%', 
        height: '100%',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        overflowX: 'hidden'
      }}>
        <Alert severity="error" sx={{ maxWidth: 600 }}>
          <Typography variant="h6" gutterBottom>
            Access Denied
          </Typography>
          <Typography>
            You need administrator privileges to access this page.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Current role: {user?.role || 'Unknown'}
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box className="content-section" sx={{ 
      width: '100%', 
      height: '100%',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflowX: 'hidden'
    }}>
      <Typography variant="h4" gutterBottom>
        Document Signatures Management
      </Typography>

      {/* Debug Panel - Remove in production */}
      <Paper sx={{ p: 2, mb: 2, backgroundColor: '#f5f5f5' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Debug Information
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadSignatures}
            disabled={loading}
            size="small"
          >
            Refresh Data
          </Button>
        </Box>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="body2">
              <strong>Current User:</strong> {user?.email || 'Not logged in'}
            </Typography>
            <Typography variant="body2">
              <strong>User Role:</strong> {user?.role || 'Unknown'}
            </Typography>
            <Typography variant="body2">
              <strong>User ID:</strong> {user?.id || 'Unknown'}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="body2">
              <strong>API Endpoint:</strong> /api/v1/signatures/admin/all
            </Typography>
            <Typography variant="body2">
              <strong>Current Filters:</strong> {JSON.stringify(filters)}
            </Typography>
            <Typography variant="body2">
              <strong>Page:</strong> {page} of {Math.ceil(total / limit) || 1}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Statistics Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Signatures
              </Typography>
              <Typography variant="h5">
                {total}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Deleted Signatures
              </Typography>
              <Typography variant="h5" color="error">
                {deletedCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Active Signatures
              </Typography>
              <Typography variant="h5" color="success.main">
                {total - deletedCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Current Page
              </Typography>
              <Typography variant="h5">
                {page} of {Math.ceil(total / limit)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters and Search */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Search signatures"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                endAdornment: (
                  <IconButton onClick={handleSearch}>
                    <SearchIcon />
                  </IconButton>
                )
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Lookup User (Email or UUID)"
              value={userLookupTerm}
              onChange={(e) => setUserLookupTerm(e.target.value)}
              error={!!userLookupError}
              helperText={userLookupError}
              InputProps={{
                endAdornment: (
                  <IconButton 
                    onClick={handleUserLookup}
                    disabled={userLookupLoading || !userLookupTerm.trim()}
                  >
                    <PersonIcon />
                  </IconButton>
                )
              }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                label="Status"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Signature Level</InputLabel>
              <Select
                value={filters.signature_level}
                onChange={(e) => handleFilterChange('signature_level', e.target.value)}
                label="Signature Level"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="simple">Simple</MenuItem>
                <MenuItem value="advanced">Advanced</MenuItem>
                <MenuItem value="qualified">Qualified</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Include Deleted</InputLabel>
              <Select
                value={filters.include_deleted}
                onChange={(e) => handleFilterChange('include_deleted', e.target.value)}
                label="Include Deleted"
              >
                <MenuItem value={false}>No</MenuItem>
                <MenuItem value={true}>Yes</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              variant="outlined"
              startIcon={<FilterIcon />}
              onClick={loadSignatures}
              fullWidth
            >
              Apply Filters
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Signatures Table */}
      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Signer</TableCell>
              <TableCell>Document</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Level</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Deleted</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  Loading signatures...
                </TableCell>
              </TableRow>
            ) : filteredSignatures.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  No signatures found
                </TableCell>
              </TableRow>
            ) : (
              filteredSignatures.map((signature) => (
                <TableRow key={signature.id}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {signature.id.substring(0, 8)}...
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">
                        {signature.signer_name || 'Unknown'}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {signature.signer_email}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {signature.document_title || 'Unknown Document'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={signature.status}
                      color={getStatusColor(signature.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={signature.signature_level || 'simple'}
                      color={getSignatureLevelColor(signature.signature_level)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(signature.created_at)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {signature.is_deleted ? (
                      <Box>
                        <Typography variant="body2" color="error">
                          {formatDate(signature.deleted_at)}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {signature.deletion_reason || 'No reason provided'}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="success.main">
                        Active
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() => setViewDialog({ open: true, signature })}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      {signature.is_deleted && (
                        <Tooltip title="Restore Signature">
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => setRestoreDialog({ open: true, signature })}
                          >
                            <RestoreIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Pagination */}
      {total > limit && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination
            count={Math.ceil(total / limit)}
            page={page}
            onChange={(event, value) => setPage(value)}
            color="primary"
          />
        </Box>
      )}

      {/* View Signature Dialog */}
      <Dialog
        open={viewDialog.open}
        onClose={() => setViewDialog({ open: false, signature: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Signature Details</DialogTitle>
        <DialogContent>
          {viewDialog.signature && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Basic Information
                  </Typography>
                  <Typography variant="body2">
                    <strong>ID:</strong> {viewDialog.signature.id}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Status:</strong> {viewDialog.signature.status}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Type:</strong> {viewDialog.signature.signature_type}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Level:</strong> {viewDialog.signature.signature_level}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Legally Binding:</strong> {viewDialog.signature.is_legally_binding ? 'Yes' : 'No'}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    User Information
                  </Typography>
                  <Typography variant="body2">
                    <strong>Signer:</strong> {viewDialog.signature.signer_name}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Email:</strong> {viewDialog.signature.signer_email}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Document:</strong> {viewDialog.signature.document_title}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Created:</strong> {formatDate(viewDialog.signature.created_at)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Signed:</strong> {formatDate(viewDialog.signature.signed_at)}
                  </Typography>
                </Grid>
                {viewDialog.signature.is_deleted && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom color="error">
                      Deletion Information
                    </Typography>
                    <Typography variant="body2">
                      <strong>Deleted At:</strong> {formatDate(viewDialog.signature.deleted_at)}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Deleted By:</strong> {viewDialog.signature.deleted_by}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Reason:</strong> {viewDialog.signature.deletion_reason || 'No reason provided'}
                    </Typography>
                  </Grid>
                )}
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Digital Signature Information
                  </Typography>
                  <Typography variant="body2">
                    <strong>Verification Status:</strong> {viewDialog.signature.verification_status}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Certificate Type:</strong> {viewDialog.signature.certificate_type}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Compliance Standard:</strong> {viewDialog.signature.compliance_standard}
                  </Typography>
                  {viewDialog.signature.document_hash && (
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      <strong>Document Hash:</strong> {viewDialog.signature.document_hash}
                    </Typography>
                  )}
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialog({ open: false, signature: null })}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Restore Signature Dialog */}
      <Dialog
        open={restoreDialog.open}
        onClose={() => setRestoreDialog({ open: false, signature: null })}
      >
        <DialogTitle>Restore Signature</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to restore this signature? This will make it active again.
          </Typography>
          {restoreDialog.signature && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Signature ID:</strong> {restoreDialog.signature.id}
              </Typography>
              <Typography variant="body2">
                <strong>Signer:</strong> {restoreDialog.signature.signer_name}
              </Typography>
              <Typography variant="body2">
                <strong>Document:</strong> {restoreDialog.signature.document_title}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialog({ open: false, signature: null })}>
            Cancel
          </Button>
          <Button
            onClick={() => handleRestore(restoreDialog.signature)}
            color="success"
            variant="contained"
          >
            Restore
          </Button>
        </DialogActions>
      </Dialog>

      {/* User Profile Lookup Dialog */}
      <Dialog
        open={userLookupDialog.open}
        onClose={() => setUserLookupDialog({ open: false, user: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>User Profile</DialogTitle>
        <DialogContent>
          {userLookupDialog.user && (
            <Box>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Basic Information
                  </Typography>
                  <Typography variant="body2">
                    <strong>User ID:</strong> {userLookupDialog.user.id}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Name:</strong> {userLookupDialog.user.name || 'Not provided'}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Email:</strong> {userLookupDialog.user.email}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Signature Statistics
                  </Typography>
                  <Typography variant="body2">
                    <strong>Total Signatures:</strong> {signatures.filter(s => s.signer_id === userLookupDialog.user.id).length}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Active Signatures:</strong> {signatures.filter(s => s.signer_id === userLookupDialog.user.id && !s.is_deleted).length}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Deleted Signatures:</strong> {signatures.filter(s => s.signer_id === userLookupDialog.user.id && s.is_deleted).length}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Recent Signatures
                  </Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Document</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Level</TableCell>
                        <TableCell>Created</TableCell>
                        <TableCell>Deleted</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {signatures
                        .filter(s => s.signer_id === userLookupDialog.user.id)
                        .slice(0, 5)
                        .map((signature) => (
                          <TableRow key={signature.id}>
                            <TableCell>
                              <Typography variant="body2">
                                {signature.document_title || 'Unknown Document'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={signature.status}
                                color={getStatusColor(signature.status)}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={signature.signature_level || 'simple'}
                                color={getSignatureLevelColor(signature.signature_level)}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {formatDate(signature.created_at)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {signature.is_deleted ? (
                                <Typography variant="body2" color="error">
                                  {formatDate(signature.deleted_at)}
                                </Typography>
                              ) : (
                                <Typography variant="body2" color="success.main">
                                  Active
                                </Typography>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                  {signatures.filter(s => s.signer_id === userLookupDialog.user.id).length === 0 && (
                    <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
                      No signatures found for this user.
                    </Typography>
                  )}
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserLookupDialog({ open: false, user: null })}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
