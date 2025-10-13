/**
 * Simple Document Store (temporarily replacing Zustand)
 * Centralized state management for document editing
 */

// Simple store object (temporarily replacing zustand)
const useDocumentStore = () => ({
  // Document state
  document: null,
  documentUrl: null,
  numPages: null,
  pageNumber: 1,
  scale: 1.0,
  pdfOffset: { x: 0, y: 0 },
  
  // Fields state
  fields: [],
  selectedField: null,
  editingField: null,
  
  // UI state
  loading: false,
  error: null,
  isViewMode: false,
  isWhiteoutMode: false,
  selectedFieldType: 'signature',
  
  // History state
  history: [],
  historyIndex: -1,
  
  // Actions (simple implementations)
  setDocument: () => {},
  setDocumentUrl: () => {},
  setNumPages: () => {},
  setPageNumber: () => {},
  setScale: () => {},
  setPdfOffset: () => {},
  setLoading: () => {},
  setError: () => {},
  setViewMode: () => {},
  setWhiteoutMode: () => {},
  setSelectedFieldType: () => {},
  addField: () => {},
  updateField: () => {},
  deleteField: () => {},
  setSelectedField: () => {},
  setEditingField: () => {},
  clearSelection: () => {},
  undo: () => {},
  redo: () => {},
  canUndo: false,
  canRedo: false,
  resetDocument: () => {}
});

export default useDocumentStore;