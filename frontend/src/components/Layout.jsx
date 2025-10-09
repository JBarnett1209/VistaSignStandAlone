import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Box, 
  Drawer, 
  List, 
  ListItem, 
  ListItemButton, 
  ListItemIcon, 
  ListItemText,
  Divider,
  InputBase,
  alpha,
  IconButton,
  Menu,
  MenuItem
} from '@mui/material';
import AccountCircle from '@mui/icons-material/AccountCircle';
import { useAuth } from '../contexts/AuthContext';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DescriptionIcon from '@mui/icons-material/Description';
import EditIcon from '@mui/icons-material/Edit';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
// import PeopleIcon from '@mui/icons-material/People';
// PersonIcon removed (unused)
import SettingsIcon from '@mui/icons-material/Settings';

const drawerWidth = 256;
const sidebarGutter = 32; // extra spacing between drawer and content

export const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [menuAnchor, setMenuAnchor] = React.useState(null);
  const menuOpen = Boolean(menuAnchor);
  const handleMenu = (event) => setMenuAnchor(event.currentTarget);
  const handleClose = () => setMenuAnchor(null);
  const goProfile = () => { handleClose(); navigate('/profile'); };
  const doLogout = async () => { handleClose(); try { await logout(); } finally { navigate('/login'); } };
  
  const isAdmin = user?.role === 'admin';
  
  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Documents', icon: <DescriptionIcon />, path: '/documents' },
    { text: 'Signature Templates', icon: <EditIcon />, path: '/signatures' },
    { text: 'Workflows', icon: <AssignmentIcon />, path: '/workflows' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
  ];
  
  const adminMenuItems = [
    { text: 'Document Signatures', icon: <AdminPanelSettingsIcon />, path: '/admin/signatures' },
  ];

  return (
    <Box className="app-root">
      <AppBar
        position="fixed"
        sx={{
          left: 0,
          width: '100%',
          pl: { xs: 0, sm: `${drawerWidth + sidebarGutter}px` },
        }}
      >
        <Toolbar sx={{ display: 'flex', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 150" style={{ height: '40px', width: 'auto', maxWidth: '200px' }}>
              <defs>
                <linearGradient id="uvGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#7E3AF2"/>
                  <stop offset="100%" stopColor="#A855F7"/>
                </linearGradient>
              </defs>
              <text x="240" y="75" fontFamily="Poppins, Inter, Arial, sans-serif" fontSize="60" fontWeight="600" fill="url(#uvGradient)" textAnchor="middle">
                VistaSign
              </text>
              <text x="240" y="115" fontFamily="Inter, Arial, sans-serif" fontSize="20" fill="#888" textAnchor="middle">
                powered by UnitVista
              </text>
            </svg>
          </Box>
          <Box sx={{
            ml: 2,
            flex: 1,
            maxWidth: 480,
            backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.06),
            borderRadius: 2,
            px: 2,
            py: 0.5,
          }}>
            <InputBase placeholder="Search" fullWidth />
          </Box>
          <Box sx={{ ml: 'auto' }}>
            <IconButton color="inherit" onClick={handleMenu} aria-label="account">
              <AccountCircle />
            </IconButton>
            <Menu
              anchorEl={menuAnchor}
              open={menuOpen}
              onClose={handleClose}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              PaperProps={{
                sx: {
                  maxWidth: 200,
                  minWidth: 150
                }
              }}
            >
              <MenuItem onClick={goProfile}>Profile</MenuItem>
              <MenuItem onClick={doLogout}>Logout</MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>
      
      <Drawer
        sx={{
          width: { xs: 0, sm: drawerWidth },
          flexShrink: 0,
          display: { xs: 'none', sm: 'block' },
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            backgroundColor: (theme) => theme.palette.background.paper,
            borderRight: '1px solid #E5E7EB'
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {menuItems.map((item) => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  component={Link}
                  to={item.path}
                  selected={location.pathname === item.path || (item.path === '/dashboard' && location.pathname === '/')}
                >
                  <ListItemIcon>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          
          {isAdmin && (
            <>
              <Divider />
              <List>
                <ListItem disablePadding>
                  <ListItemText 
                    primary="Admin" 
                    sx={{ 
                      px: 2, 
                      py: 1, 
                      color: 'text.secondary',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }} 
                  />
                </ListItem>
                {adminMenuItems.map((item) => (
                  <ListItem key={item.text} disablePadding>
                    <ListItemButton
                      component={Link}
                      to={item.path}
                      selected={location.pathname === item.path}
                    >
                      <ListItemIcon>
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText primary={item.text} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </>
          )}
          
          <Divider />
        </Box>
      </Drawer>
      
      <Box component="main" className="app-main" sx={{ 
        bgcolor: 'background.default', 
        ml: { xs: 0, sm: `${drawerWidth + sidebarGutter}px` },
        width: { xs: '100%', sm: `calc(100% - ${drawerWidth + sidebarGutter}px)` },
        minWidth: 0,
        flex: 1,
        display: 'flex',
        flexDirection: 'column'
      }}>
        <Toolbar />
        <Box className="app-content" sx={{ 
          flex: 1,
          width: '100%',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};