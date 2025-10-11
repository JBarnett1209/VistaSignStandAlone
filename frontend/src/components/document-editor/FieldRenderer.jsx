/**
 * Professional Field Renderer Component
 * Handles rendering and interaction with document fields
 */

import React, { useCallback, useMemo } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon
} from '@mui/icons-material';
import { fieldToScreenCoords, isFieldSigned } from '../../utils/pdfCoordinates';
import { FIELD_TYPE_CONFIG } from './FieldManager';

const FieldRenderer = ({
  field,
  scale,
  pdfOffset,
  signatures = [],
  documentId,
  isSelected = false,
  isDragging = false,
  onFieldClick,
  onFieldEdit,
  onFieldDelete,
  onFieldDragStart,
  onFieldResize,
  showControls = true
}) => {
  const screenCoords = useMemo(() => {
    return fieldToScreenCoords(field, pdfOffset, scale);
  }, [field, pdfOffset, scale]);

  const isSigned = useMemo(() => {
    return isFieldSigned(field, signatures, documentId);
  }, [field, signatures, documentId]);

  const config = useMemo(() => {
    return FIELD_TYPE_CONFIG[field.type] || FIELD_TYPE_CONFIG.signature;
  }, [field.type]);

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    onFieldClick?.(field);
  }, [field, onFieldClick]);

  const handleEdit = useCallback((e) => {
    e.stopPropagation();
    onFieldEdit?.(field);
  }, [field, onFieldEdit]);

  const handleDelete = useCallback((e) => {
    e.stopPropagation();
    onFieldDelete?.(field);
  }, [field, onFieldDelete]);

  const handleDragStart = useCallback((e) => {
    e.stopPropagation();
    onFieldDragStart?.(field, e);
  }, [field, onFieldDragStart]);

  const getFieldContent = useCallback(() => {
    if (isSigned) {
      return (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          height: '100%',
          backgroundColor: 'success.light',
          color: 'success.contrastText',
          borderRadius: 1
        }}>
          <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
            ✓ SIGNED
          </Typography>
        </Box>
      );
    }

    switch (field.type) {
      case 'signature':
        return (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            border: '2px dashed',
            borderColor: 'primary.main',
            borderRadius: 1,
            backgroundColor: 'primary.light',
            color: 'primary.contrastText'
          }}>
            <Typography variant="caption">
              {field.label || 'Signature'}
            </Typography>
          </Box>
        );

      case 'date':
        return (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            backgroundColor: 'background.paper'
          }}>
            <Typography variant="caption">
              {field.label || 'Date'}
            </Typography>
          </Box>
        );

      case 'text':
        return (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            backgroundColor: 'background.paper'
          }}>
            <Typography variant="caption">
              {field.label || 'Text Field'}
            </Typography>
          </Box>
        );

      case 'checkbox':
        return (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            width: '100%',
            border: '2px solid',
            borderColor: 'primary.main',
            borderRadius: 1,
            backgroundColor: 'background.paper'
          }}>
            <Box sx={{ 
              width: 12, 
              height: 12, 
              border: '1px solid',
              borderColor: 'text.primary',
              borderRadius: 0.5
            }} />
          </Box>
        );

      default:
        return (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            backgroundColor: 'background.paper'
          }}>
            <Typography variant="caption">
              {field.label || config.label}
            </Typography>
          </Box>
        );
    }
  }, [field, isSigned, config]);

  if (!screenCoords) return null;

  return (
    <Box
      sx={{
        position: 'absolute',
        left: screenCoords.x,
        top: screenCoords.y,
        width: screenCoords.width,
        height: screenCoords.height,
        cursor: 'pointer',
        zIndex: isSelected ? 10 : 5,
        opacity: isDragging ? 0.7 : 1,
        transform: isDragging ? 'rotate(2deg)' : 'none',
        transition: 'all 0.2s ease'
      }}
      onClick={handleClick}
    >
      {/* Field Content */}
      <Box sx={{ 
        position: 'relative',
        width: '100%',
        height: '100%',
        border: isSelected ? '2px solid' : '1px solid',
        borderColor: isSelected ? 'primary.main' : 'divider',
        borderRadius: 1,
        overflow: 'hidden'
      }}>
        {getFieldContent()}

        {/* Field Label */}
        {field.label && (
          <Box sx={{
            position: 'absolute',
            top: -20,
            left: 0,
            backgroundColor: 'primary.main',
            color: 'primary.contrastText',
            px: 1,
            py: 0.5,
            borderRadius: 0.5,
            fontSize: '0.75rem',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            maxWidth: '200px',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {field.label}
            {field.required && <span style={{ color: 'red' }}> *</span>}
          </Box>
        )}

        {/* Field Type Badge */}
        <Chip
          label={config.icon}
          size="small"
          sx={{
            position: 'absolute',
            top: -8,
            right: -8,
            backgroundColor: 'primary.main',
            color: 'primary.contrastText',
            fontSize: '0.75rem',
            height: 16,
            minWidth: 16
          }}
        />
      </Box>

      {/* Control Buttons */}
      {showControls && isSelected && (
        <>
          {/* Drag Handle */}
          <Box
            sx={{
              position: 'absolute',
              top: -8,
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'primary.main',
              color: 'primary.contrastText',
              borderRadius: '50%',
              width: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'grab',
              fontSize: '0.75rem'
            }}
            onMouseDown={handleDragStart}
          >
            <DragIcon sx={{ fontSize: 12 }} />
          </Box>

          {/* Edit Button */}
          <Box
            sx={{
              position: 'absolute',
              top: -8,
              right: 20,
              backgroundColor: 'info.main',
              color: 'info.contrastText',
              borderRadius: '50%',
              width: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '0.75rem'
            }}
            onClick={handleEdit}
          >
            <EditIcon sx={{ fontSize: 12 }} />
          </Box>

          {/* Delete Button */}
          <Box
            sx={{
              position: 'absolute',
              top: -8,
              right: 0,
              backgroundColor: 'error.main',
              color: 'error.contrastText',
              borderRadius: '50%',
              width: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '0.75rem'
            }}
            onClick={handleDelete}
          >
            <DeleteIcon sx={{ fontSize: 12 }} />
          </Box>
        </>
      )}

      {/* Resize Handles */}
      {showControls && isSelected && (
        <>
          {/* Bottom Right Resize Handle */}
          <Box
            sx={{
              position: 'absolute',
              bottom: -4,
              right: -4,
              width: 8,
              height: 8,
              backgroundColor: 'primary.main',
              border: '1px solid',
              borderColor: 'background.paper',
              borderRadius: '50%',
              cursor: 'nw-resize'
            }}
            onMouseDown={(e) => onFieldResize?.(field, 'se', e)}
          />
        </>
      )}
    </Box>
  );
};

export default FieldRenderer;
