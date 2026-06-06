import React, { useState } from 'react';
import { Navigate, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Container, Paper, TextField, Button, Typography, Box, Alert, Link, Grid,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

export default function Register() {
  const navigate = useNavigate();
  const { user, register } = useAuth();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('Please enter your first and last name');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    setLoading(true);
    try {
      await register({
        email: form.email.trim(),
        password: form.password,
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs" sx={{ display: 'flex', alignItems: 'center', minHeight: '100vh' }}>
      <Paper elevation={8} sx={{ p: 4, width: '100%', borderRadius: 3 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 150" style={{ height: '100px', width: 'auto', maxWidth: '360px' }}>
              <defs>
                <linearGradient id="uvGradientR" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#7E3AF2" />
                  <stop offset="100%" stopColor="#A855F7" />
                </linearGradient>
              </defs>
              <text x="240" y="75" fontFamily="Poppins, Inter, Arial, sans-serif" fontSize="60" fontWeight="600" fill="url(#uvGradientR)" textAnchor="middle">VistaSign</text>
              <text x="240" y="115" fontFamily="Inter, Arial, sans-serif" fontSize="20" fill="#888" textAnchor="middle">powered by UnitVista</text>
            </svg>
          </Box>
          <Typography variant="body2" color="text.secondary">Create your account</Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField required fullWidth label="First Name" name="firstName" autoFocus
                InputLabelProps={{ shrink: true }} value={form.firstName} onChange={change} />
            </Grid>
            <Grid item xs={6}>
              <TextField required fullWidth label="Last Name" name="lastName"
                InputLabelProps={{ shrink: true }} value={form.lastName} onChange={change} />
            </Grid>
          </Grid>
          <TextField margin="normal" required fullWidth label="Email Address" name="email" type="email"
            autoComplete="email" InputLabelProps={{ shrink: true }} value={form.email} onChange={change} />
          <TextField margin="normal" required fullWidth label="Password" name="password" type="password"
            autoComplete="new-password" helperText="At least 8 characters"
            InputLabelProps={{ shrink: true }} value={form.password} onChange={change} />
          <TextField margin="normal" required fullWidth label="Confirm Password" name="confirmPassword" type="password"
            autoComplete="new-password" InputLabelProps={{ shrink: true }}
            value={form.confirmPassword} onChange={change} />
          <Button type="submit" fullWidth sx={{ mt: 2, py: 1.25 }} disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
            Already have an account?{' '}
            <Link component={RouterLink} to="/login" underline="hover">Sign in</Link>
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}
