import React from 'react';
import UniversalDocumentViewer from './UniversalDocumentViewer';

const DocumentViewer = ({ document, signatures = [], onClose, onFieldClick = null }) => {
  if (!document) {
    return null;
  }

  return (
    <UniversalDocumentViewer
      document={document}
      signatures={signatures}
      showSignatureStatus={true}
      onFieldClick={onFieldClick}
      onLoadSuccess={() => {}}
      onLoadError={(error) => {
        console.error('Document load error:', error);
      }}
    />
  );
};

export default DocumentViewer;