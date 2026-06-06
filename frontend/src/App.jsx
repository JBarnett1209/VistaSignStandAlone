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
import Contacts from './pages/Contacts';
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
// Dark-grey background "levels" (purple kept as the accent).
const BG = {
  level0: '#0f0f11', // app background
  level1: '#161619', // sidebar / app bar
  level2: '#1c1c20', // cards / surfaces
  level3: '#26262b', // borders / hover
};

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#7B5CFF', // UnitVista purple
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#A855F7', // accent purple
      contrastText: '#ffffff',
    },
    background: {
      default: BG.level0,
      paper: BG.level2,
    },
    text: {
      primary: '#ECECEE',
      secondary: '#9CA3AF',
    },
    divider: BG.level3,
  },
  components: {
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: BG.level1,
          color: '#ECECEE',
          // Full-height sidebar: a single divider on the right, no box outline
          // or rounded corners (overrides the generic Paper styling).
          border: 'none',
          borderRight: `1px solid ${BG.level3}`,
          borderRadius: 0,
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
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: BG.level3 },
        head: { backgroundColor: BG.level1 },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '4px 8px',
          '&.Mui-selected': {
            backgroundColor: 'rgba(123, 92, 255, 0.18)',
            color: '#C4B5FD',
            '& .MuiListItemIcon-root': { color: '#C4B5FD' },
            '&:hover': { backgroundColor: 'rgba(123, 92, 255, 0.24)' },
          },
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
          },
        },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: BG.level1,
          backgroundImage: 'none',
          color: '#ECECEE',
          borderBottom: `1px solid ${BG.level3}`,
          boxShadow: 'none',
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
          borderRadius: 12,
          backgroundImage: 'none',
          backgroundColor: BG.level2,
        },
      },
    },
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
          <Route path="contacts" element={<Contacts />} />
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
