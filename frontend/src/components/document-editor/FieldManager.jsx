/**
 * Professional Field Manager Component
 * Handles field creation, editing, and management
 */

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Box,
  Typography,
  Divider
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon
} from '@mui/icons-material';

const FIELD_TYPES = {
  SIGNATURE: 'signature',
  DATE: 'date',
  INITIALS: 'initials',
  TEXT: 'text',
  CHECKBOX: 'checkbox',
  RADIO: 'radio',
  DROPDOWN: 'dropdown',
  NAME: 'name',
  EMAIL: 'email',
  ATTACHMENT: 'attachment',
  WHITEOUT: 'whiteout'
};

const FIELD_TYPE_CONFIG = {
  [FIELD_TYPES.SIGNATURE]: {
    label: 'Signature',
    icon: '✍️',
    defaultWidth: 200,
    defaultHeight: 50
  },
  [FIELD_TYPES.DATE]: {
    label: 'Date',
    icon: '📅',
    defaultWidth: 120,
    defaultHeight: 30
  },
  [FIELD_TYPES.INITIALS]: {
    label: 'Initials',
    icon: '🖊️',
    defaultWidth: 80,
    defaultHeight: 30
  },
  [FIELD_TYPES.TEXT]: {
    label: 'Text Field',
    icon: '📝',
    defaultWidth: 150,
    defaultHeight: 30
  },
  [FIELD_TYPES.CHECKBOX]: {
    label: 'Checkbox',
    icon: '☑️',
    defaultWidth: 20,
    defaultHeight: 20
  },
  [FIELD_TYPES.NAME]: {
    label: 'Name',
    icon: '👤',
    defaultWidth: 150,
    defaultHeight: 30
  },
  [FIELD_TYPES.EMAIL]: {
    label: 'Email',
    icon: '📧',
    defaultWidth: 200,
    defaultHeight: 30
  }
};

const FieldManager = ({ 
  open, 
  onClose, 
  onSave, 
  field = null, 
  fieldType = FIELD_TYPES.SIGNATURE 
}) => {
  const [formData, setFormData] = useState({
    label: field?.label || '',
    placeholder: field?.placeholder || '',
    required: field?.required || false,
    defaultValue: field?.defaultValue || '',
    options: field?.options || [],
    validation: field?.validation || {}
  });

  const [newOption, setNewOption] = useState('');

  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleAddOption = useCallback(() => {
    if (newOption.trim()) {
      setFormData(prev => ({
        ...prev,
        options: [...prev.options, newOption.trim()]
      }));
      setNewOption('');
    }
  }, [newOption]);

  const handleRemoveOption = useCallback((index) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  }, []);

  const handleSave = useCallback(() => {
    const fieldData = {
      ...formData,
      type: fieldType,
      ...(field && { id: field.id })
    };
    
    onSave(fieldData);
    onClose();
  }, [formData, fieldType, field, onSave, onClose]);

  const isEditing = !!field;
  const config = FIELD_TYPE_CONFIG[fieldType];

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <span>{config?.icon}</span>
          {isEditing ? 'Edit Field' : `Add ${config?.label}`}
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {/* Basic Field Properties */}
          <TextField
            label="Field Label"
            value={formData.label}
            onChange={(e) => handleInputChange('label', e.target.value)}
            fullWidth
            required
          />

          <TextField
            label="Placeholder Text"
            value={formData.placeholder}
            onChange={(e) => handleInputChange('placeholder', e.target.value)}
            fullWidth
          />

          <TextField
            label="Default Value"
            value={formData.defaultValue}
            onChange={(e) => handleInputChange('defaultValue', e.target.value)}
            fullWidth
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={formData.required}
                onChange={(e) => handleInputChange('required', e.target.checked)}
              />
            }
            label="Required Field"
          />

          {/* Field Type Specific Options */}
          {fieldType === FIELD_TYPES.DROPDOWN && (
            <>
              <Divider />
              <Typography variant="h6">Dropdown Options</Typography>
              
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  label="Add Option"
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddOption()}
                  fullWidth
                />
                <Button 
                  onClick={handleAddOption}
                  variant="outlined"
                  disabled={!newOption.trim()}
                >
                  Add
                </Button>
              </Box>

              {formData.options.map((option, index) => (
                <Box 
                  key={index}
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1,
                    p: 1,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1
                  }}
                >
                  <Typography sx={{ flexGrow: 1 }}>{option}</Typography>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => handleRemoveOption(index)}
                  >
                    <DeleteIcon fontSize="small" />
                  </Button>
                </Box>
              ))}
            </>
          )}

          {/* Validation Rules */}
          <Divider />
          <Typography variant="h6">Validation</Typography>
          
          <FormControl fullWidth>
            <InputLabel>Validation Type</InputLabel>
            <Select
              value={formData.validation.type || ''}
              onChange={(e) => handleInputChange('validation', {
                ...formData.validation,
                type: e.target.value
              })}
            >
              <MenuItem value="">None</MenuItem>
              <MenuItem value="email">Email</MenuItem>
              <MenuItem value="phone">Phone Number</MenuItem>
              <MenuItem value="number">Number</MenuItem>
              <MenuItem value="date">Date</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button 
          onClick={handleSave}
          variant="contained"
          startIcon={<SaveIcon />}
        >
          {isEditing ? 'Update Field' : 'Add Field'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FieldManager;
export { FIELD_TYPES, FIELD_TYPE_CONFIG };
