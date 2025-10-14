import React from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Chip
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';

const FieldList = ({ 
  fields = [], 
  onFieldSelect, 
  onFieldDelete 
}) => {
  return (
    <Paper sx={{ p: 2, width: 250, height: '100%', bgcolor: '#f5f5f5' }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Fields</Typography>
      
      {fields.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No fields added yet
        </Typography>
      ) : (
        <List dense>
          {fields.map((field) => (
            <ListItem
              key={field.id}
              sx={{
                bgcolor: 'white',
                mb: 1,
                borderRadius: 1,
                border: '1px solid #ddd'
              }}
            >
              <ListItemText
                primary={field.type}
                secondary={`Position: ${field.x}, ${field.y}`}
              />
              <IconButton
                size="small"
                onClick={() => onFieldDelete?.(field.id)}
                color="error"
              >
                <DeleteIcon />
              </IconButton>
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
};

export default FieldList;