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
// PersonIcon removed (unused)
import SettingsIcon from '@mui/icons-material/Settings';

const drawerWidth = 256;
const sidebarGutter = 32; // extra spacing between drawer and content

export const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [menuAnchor, setMenuAnchor] = React.useState(null);
  const menuOpen = Boolean(menuAnchor);
  const handleMenu = (event) => setMenuAnchor(event.currentTarget);
  const handleClose = () => setMenuAnchor(null);
  const goProfile = () => { handleClose(); navigate('/profile'); };
  const doLogout = async () => { handleClose(); try { await logout(); } finally { navigate('/login'); } };
  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Documents', icon: <DescriptionIcon />, path: '/documents' },
    { text: 'Signatures', icon: <EditIcon />, path: '/signatures' },
    { text: 'Workflows', icon: <AssignmentIcon />, path: '/workflows' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
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
          <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 600 }}>
            VistaSign
          </Typography>
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
          <Divider />
        </Box>
      </Drawer>
      
      <Box component="main" className="app-main" sx={{ 
        bgcolor: 'background.default', 
        ml: { xs: 0, sm: `${drawerWidth + sidebarGutter}px` }
      }}>
        <Toolbar />
        <Box className="app-content">
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};