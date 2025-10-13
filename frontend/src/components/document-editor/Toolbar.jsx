/**
 * Professional Document Editor Toolbar
 * Provides tools for field creation and document manipulation
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  IconButton,
  Tooltip,
  Divider,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  Visibility as ViewIcon,
  EditOff as WhiteoutIcon,
  ViewList as ViewListIcon,
  ViewSidebar as ViewSidebarIcon
} from '@mui/icons-material';
import { FIELD_TYPES } from './FieldManager';

const Toolbar = ({
  selectedFieldType,
  onFieldTypeSelect,
  onSave,
  onUndo,
  onRedo,
  onSend,
  onViewMode,
  onWhiteoutMode,
  canUndo = false,
  canRedo = false,
  isViewMode = false,
  isWhiteoutMode = false,
  isSaving = false,
  showFieldList = true,
  onToggleFieldList
}) => {
  const [fieldMenuAnchor, setFieldMenuAnchor] = useState(null);

  const handleFieldMenuOpen = useCallback((event) => {
    setFieldMenuAnchor(event.currentTarget);
  }, []);

  const handleFieldMenuClose = useCallback(() => {
    setFieldMenuAnchor(null);
  }, []);

  const handleFieldTypeSelect = useCallback((fieldType) => {
    onFieldTypeSelect(fieldType);
    handleFieldMenuClose();
  }, [onFieldTypeSelect]);

  const fieldTypeOptions = [
    { type: FIELD_TYPES.SIGNATURE, label: 'Signature', icon: '✍️' },
    { type: FIELD_TYPES.DATE, label: 'Date', icon: '📅' },
    { type: FIELD_TYPES.INITIALS, label: 'Initials', icon: '🖊️' },
    { type: FIELD_TYPES.TEXT, label: 'Text Field', icon: '📝' },
    { type: FIELD_TYPES.CHECKBOX, label: 'Checkbox', icon: '☑️' },
    { type: FIELD_TYPES.NAME, label: 'Name', icon: '👤' },
    { type: FIELD_TYPES.EMAIL, label: 'Email', icon: '📧' }
  ];

  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 1, 
      p: 1,
      borderBottom: 1,
      borderColor: 'divider',
      backgroundColor: 'background.paper'
    }}>
      {/* Document Actions */}
      <ButtonGroup size="small" variant="outlined">
        <Tooltip title="Save Document">
          <Button 
            onClick={onSave}
            disabled={isSaving}
            startIcon={<SaveIcon />}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </Tooltip>

        <Tooltip title="Undo">
          <IconButton 
            onClick={onUndo}
            disabled={!canUndo}
            size="small"
          >
            <UndoIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title="Redo">
          <IconButton 
            onClick={onRedo}
            disabled={!canRedo}
            size="small"
          >
            <RedoIcon />
          </IconButton>
        </Tooltip>
      </ButtonGroup>

      <Divider orientation="vertical" flexItem />

      {/* Field Creation */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip title="Add Field">
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleFieldMenuOpen}
            size="small"
          >
            Add Field
          </Button>
        </Tooltip>

        <Menu
          anchorEl={fieldMenuAnchor}
          open={Boolean(fieldMenuAnchor)}
          onClose={handleFieldMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
        >
          {fieldTypeOptions.map((option) => (
            <MenuItem 
              key={option.type}
              onClick={() => handleFieldTypeSelect(option.type)}
              selected={selectedFieldType === option.type}
            >
              <ListItemIcon>
                <span style={{ fontSize: '1.2rem' }}>{option.icon}</span>
              </ListItemIcon>
              <ListItemText>{option.label}</ListItemText>
            </MenuItem>
          ))}
        </Menu>

        {/* Current Field Type Indicator */}
        {selectedFieldType && (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 0.5,
            px: 1,
            py: 0.5,
            backgroundColor: 'primary.light',
            borderRadius: 1,
            fontSize: '0.875rem'
          }}>
            <span>
              {fieldTypeOptions.find(opt => opt.type === selectedFieldType)?.icon}
            </span>
            <span>
              {fieldTypeOptions.find(opt => opt.type === selectedFieldType)?.label}
            </span>
          </Box>
        )}
      </Box>

      <Divider orientation="vertical" flexItem />

      {/* Field List Toggle */}
      {onToggleFieldList && (
        <Tooltip title={showFieldList ? "Hide Field List" : "Show Field List"}>
          <IconButton 
            onClick={onToggleFieldList}
            color={showFieldList ? 'primary' : 'default'}
            size="small"
          >
            {showFieldList ? <ViewSidebarIcon /> : <ViewListIcon />}
          </IconButton>
        </Tooltip>
      )}

      <Divider orientation="vertical" flexItem />

      {/* Mode Toggle */}
      <ButtonGroup size="small" variant="outlined">
        <Tooltip title={isViewMode ? "Exit View Mode" : "View Mode"}>
          <IconButton 
            onClick={onViewMode}
            color={isViewMode ? 'primary' : 'default'}
            size="small"
          >
            <ViewIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title={isWhiteoutMode ? "Exit Whiteout Mode" : "Whiteout Mode"}>
          <IconButton 
            onClick={onWhiteoutMode}
            color={isWhiteoutMode ? 'primary' : 'default'}
            size="small"
          >
            <WhiteoutIcon />
          </IconButton>
        </Tooltip>
      </ButtonGroup>

      <Divider orientation="vertical" flexItem />

      {/* Send Document */}
      <Tooltip title="Send for Signing">
        <Button
          variant="contained"
          color="success"
          startIcon={<SendIcon />}
          onClick={onSend}
          size="small"
        >
          Send
        </Button>
      </Tooltip>
    </Box>
  );
};

export default Toolbar;
