import { configureStore } from '@reduxjs/toolkit';
import documentEditor from './slices/documentEditorSlice';

export const store = configureStore({
  reducer: {
    documentEditor,
  },
});

export default store;


