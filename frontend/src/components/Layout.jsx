import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
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
  alpha
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DescriptionIcon from '@mui/icons-material/Description';
import EditIcon from '@mui/icons-material/Edit';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';

const drawerWidth = 240;

export const Layout = () => {
  const location = useLocation();
  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Documents', icon: <DescriptionIcon />, path: '/documents' },
    { text: 'Signatures', icon: <EditIcon />, path: '/signatures' },
    { text: 'Workflows', icon: <AssignmentIcon />, path: '/workflows' },
    { text: 'Profile', icon: <PersonIcon />, path: '/profile' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
  ];

  return (
    <Box className="app-root">
      <AppBar position="fixed" sx={{ left: drawerWidth, width: `calc(100% - ${drawerWidth}px)` }}>
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
        </Toolbar>
      </AppBar>
      
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
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
      
      <Box component="main" className="app-main" sx={{ bgcolor: 'background.default', ml: `${drawerWidth}px` }}>
        <Toolbar />
        <Box className="app-content">
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};