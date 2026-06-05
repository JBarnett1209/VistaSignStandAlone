import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';
import './styles/layout.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import AuthLoading from './components/AuthLoading';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import DocumentView from './pages/DocumentView';
import DocumentEdit from './pages/DocumentEdit';
import Signatures from './pages/Signatures';
import Workflows from './pages/Workflows';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Pricing from './pages/Pricing';
import PublicSigning from './pages/PublicSigning';
import SigningComplete from './pages/SigningComplete';
import SigningDeclined from './pages/SigningDeclined';
import Invites from './pages/Invites';
import Users from './pages/Users';
import AdminSignatures from './pages/AdminSignatures';
import CertificateValidation from './pages/CertificateValidation';

// Create theme (UnitVista color feel)
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#7B5CFF', // UnitVista purple
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#A855F7', // accent purple
      contrastText: '#ffffff',
    },
    background: {
      default: '#F8F7FF', // softer lavender tint
      paper: '#ffffff',
    },
    text: {
      primary: '#111827',
      secondary: '#6B7280',
    },
  },
  components: {
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#ffffff', // light sidebar
          color: '#111827',
          borderRight: '1px solid #E5E7EB',
        },
      },
    },
    MuiContainer: {
      defaultProps: {
        maxWidth: false,
        disableGutters: true
      },
      styleOverrides: {
        root: {
          width: '100%'
        }
      }
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          width: '100%'
        }
      }
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '4px 8px',
          '&.Mui-selected': {
            backgroundColor: 'rgba(123, 92, 255, 0.12)',
            color: '#7B5CFF',
            '& .MuiListItemIcon-root': { color: '#7B5CFF' },
          },
          '&:hover': {
            backgroundColor: 'rgba(123, 92, 255, 0.08)',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(90deg, #6D28D9 0%, #7B5CFF 50%, #9333EA 100%)',
          color: '#FFFFFF',
          boxShadow: '0 2px 10px rgba(123, 92, 255, 0.25)',
        },
      },
    },
    MuiButton: {
      defaultProps: { variant: 'contained' },
      styleOverrides: {
        root: {
          borderRadius: 10,
          textTransform: 'none',
          fontWeight: 600
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          width: '100%',
          borderRadius: 12
        }
      }
    }
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
});

// AppRoutes component that handles authentication loading state
function AppRoutes() {
  const { isLoading } = useAuth();

  // Show loading screen while checking authentication
  if (isLoading) {
    return <AuthLoading />;
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/sign/:token" element={<PublicSigning />} />
        <Route path="/signing-complete" element={<SigningComplete />} />
        <Route path="/signing-declined" element={<SigningDeclined />} />
        
        {/* Protected routes */}
        <Route path="/" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="documents" element={<Documents />} />
          <Route path="documents/:id/view" element={<DocumentView />} />
          <Route path="documents/:id/edit" element={<DocumentEdit />} />
          <Route path="signatures" element={<Signatures />} />
          <Route path="workflows" element={<Workflows />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<Settings />} />
          <Route path="settings/invites" element={<Invites />} />
          <Route path="settings/users" element={<Users />} />
          <Route path="admin/signatures" element={<AdminSignatures />} />
          <Route path="admin/certificates" element={<CertificateValidation />} />
          <Route path="pricing" element={<Pricing />} />
        </Route>
      </Routes>
    </Box>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
