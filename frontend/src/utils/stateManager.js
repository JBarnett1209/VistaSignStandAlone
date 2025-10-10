/**
 * Centralized state management utilities for VistaSign
 * Ensures data consistency across components
 */

/**
 * State update patterns for consistent data management
 */
export const STATE_PATTERNS = {
  // Optimistic updates with rollback
  OPTIMISTIC: 'optimistic',
  // Wait for server confirmation
  PESSIMISTIC: 'pessimistic',
  // Update immediately, sync with server in background
  IMMEDIATE: 'immediate'
};

/**
 * Create a state manager for a specific data type
 * @param {string} dataType - Type of data being managed
 * @param {Object} initialState - Initial state
 * @returns {Object} - State manager object
 */
export const createStateManager = (dataType, initialState = {}) => {
  let state = { ...initialState };
  let listeners = new Set();
  let pendingUpdates = new Map();

  const notifyListeners = () => {
    listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error(`State listener error for ${dataType}:`, error);
      }
    });
  };

  const stateManager = {
    // Get current state
    getState: () => ({ ...state }),

    // Subscribe to state changes
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    // Update state with validation
    updateState: (updates, pattern = STATE_PATTERNS.IMMEDIATE) => {
      const previousState = { ...state };
      
      try {
        // Validate updates
        const validatedUpdates = validateUpdates(dataType, updates, state);
        
        // Apply updates based on pattern
        switch (pattern) {
          case STATE_PATTERNS.OPTIMISTIC:
            state = { ...state, ...validatedUpdates };
            notifyListeners();
            return { success: true, rollback: () => {
              state = previousState;
              notifyListeners();
            }};
          
          case STATE_PATTERNS.PESSIMISTIC:
            // Store pending update, don't apply until confirmed
            const updateId = Date.now().toString();
            pendingUpdates.set(updateId, { updates: validatedUpdates, previousState });
            return { success: true, updateId, confirm: (id) => {
              const pending = pendingUpdates.get(id);
              if (pending) {
                state = { ...state, ...pending.updates };
                pendingUpdates.delete(id);
                notifyListeners();
              }
            }};
          
          case STATE_PATTERNS.IMMEDIATE:
          default:
            state = { ...state, ...validatedUpdates };
            notifyListeners();
            return { success: true };
        }
      } catch (error) {
        console.error(`State update error for ${dataType}:`, error);
        return { success: false, error };
      }
    },

    // Reset state to initial
    resetState: () => {
      state = { ...initialState };
      pendingUpdates.clear();
      notifyListeners();
    },

    // Get pending updates
    getPendingUpdates: () => Array.from(pendingUpdates.entries()),

    // Clear pending updates
    clearPendingUpdates: () => {
      pendingUpdates.clear();
    }
  };

  return stateManager;
};

/**
 * Validate updates based on data type
 * @param {string} dataType - Type of data
 * @param {Object} updates - Updates to validate
 * @param {Object} currentState - Current state
 * @returns {Object} - Validated updates
 */
const validateUpdates = (dataType, updates, currentState) => {
  const validators = {
    document: validateDocumentUpdates,
    signature: validateSignatureUpdates,
    workflow: validateWorkflowUpdates,
    user: validateUserUpdates
  };

  const validator = validators[dataType] || validateGenericUpdates;
  return validator(updates, currentState);
};

/**
 * Document-specific validation
 */
const validateDocumentUpdates = (updates, currentState) => {
  const validated = { ...updates };

  // Validate document fields
  if (validated.fields) {
    validated.fields = validated.fields.map(field => ({
      id: field.id || generateId(),
      type: field.type || 'signature',
      x: Math.max(0, field.x || 0),
      y: Math.max(0, field.y || 0),
      width: Math.max(10, field.width || 150),
      height: Math.max(10, field.height || 50),
      page: Math.max(1, field.page || 1),
      required: Boolean(field.required),
      signingOrder: Math.max(1, field.signingOrder || 1),
      ...field
    }));
  }

  // Validate status
  if (validated.status && !['draft', 'pending', 'completed', 'expired'].includes(validated.status)) {
    delete validated.status;
  }

  return validated;
};

/**
 * Signature-specific validation
 */
const validateSignatureUpdates = (updates, currentState) => {
  const validated = { ...updates };

  // Validate signature data
  if (validated.signature_data && typeof validated.signature_data !== 'string') {
    validated.signature_data = JSON.stringify(validated.signature_data);
  }

  // Validate signature image
  if (validated.signature_image && !validated.signature_image.startsWith('data:image/')) {
    delete validated.signature_image;
  }

  // Validate status
  if (validated.status && !['pending', 'signed', 'failed'].includes(validated.status)) {
    delete validated.status;
  }

  return validated;
};

/**
 * Workflow-specific validation
 */
const validateWorkflowUpdates = (updates, currentState) => {
  const validated = { ...updates };

  // Validate participants
  if (validated.participants) {
    validated.participants = validated.participants.map(participant => ({
      id: participant.id || generateId(),
      email: participant.email || '',
      signingOrder: Math.max(1, participant.signingOrder || 1),
      status: participant.status || 'pending',
      ...participant
    }));
  }

  // Validate status
  if (validated.status && !['draft', 'active', 'completed', 'failed', 'expired'].includes(validated.status)) {
    delete validated.status;
  }

  return validated;
};

/**
 * User-specific validation
 */
const validateUserUpdates = (updates, currentState) => {
  const validated = { ...updates };

  // Validate email
  if (validated.email && !isValidEmail(validated.email)) {
    delete validated.email;
  }

  // Validate role
  if (validated.role && !['user', 'admin', 'super_admin'].includes(validated.role)) {
    delete validated.role;
  }

  return validated;
};

/**
 * Generic validation for unknown data types
 */
const validateGenericUpdates = (updates, currentState) => {
  // Basic validation - remove any undefined or null values
  const validated = {};
  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      validated[key] = value;
    }
  });
  return validated;
};

/**
 * Generate unique ID
 */
const generateId = () => {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Validate email format
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Create a data synchronizer for server state
 * @param {string} dataType - Type of data
 * @param {Function} fetchFunction - Function to fetch data from server
 * @param {Function} updateFunction - Function to update data on server
 * @returns {Object} - Data synchronizer
 */
export const createDataSynchronizer = (dataType, fetchFunction, updateFunction) => {
  let lastSyncTime = 0;
  let syncInProgress = false;
  let syncQueue = [];

  const synchronizer = {
    // Fetch latest data from server
    fetchLatest: async (force = false) => {
      if (syncInProgress && !force) {
        return null;
      }

      try {
        syncInProgress = true;
        const data = await fetchFunction();
        lastSyncTime = Date.now();
        return data;
      } catch (error) {
        console.error(`Failed to fetch latest ${dataType}:`, error);
        throw error;
      } finally {
        syncInProgress = false;
      }
    },

    // Update data on server
    updateServer: async (updates, options = {}) => {
      const { optimistic = true, retry = 3 } = options;

      if (optimistic) {
        // Add to sync queue for background sync
        syncQueue.push({ updates, timestamp: Date.now() });
      }

      try {
        const result = await updateFunction(updates);
        lastSyncTime = Date.now();
        return result;
      } catch (error) {
        if (optimistic) {
          // Remove from sync queue on failure
          syncQueue = syncQueue.filter(item => item.updates !== updates);
        }
        throw error;
      }
    },

    // Sync pending updates
    syncPending: async () => {
      if (syncQueue.length === 0) return;

      const pending = [...syncQueue];
      syncQueue = [];

      for (const item of pending) {
        try {
          await updateFunction(item.updates);
        } catch (error) {
          console.error(`Failed to sync ${dataType} update:`, error);
          // Re-add to queue for retry
          syncQueue.push(item);
        }
      }
    },

    // Get sync status
    getSyncStatus: () => ({
      lastSyncTime,
      syncInProgress,
      pendingUpdates: syncQueue.length
    })
  };

  return synchronizer;
};

/**
 * Create a cache manager for API responses
 * @param {number} ttl - Time to live in milliseconds
 * @returns {Object} - Cache manager
 */
export const createCacheManager = (ttl = 300000) => { // 5 minutes default
  const cache = new Map();

  const cacheManager = {
    // Get cached data
    get: (key) => {
      const item = cache.get(key);
      if (!item) return null;

      if (Date.now() - item.timestamp > ttl) {
        cache.delete(key);
        return null;
      }

      return item.data;
    },

    // Set cached data
    set: (key, data) => {
      cache.set(key, {
        data,
        timestamp: Date.now()
      });
    },

    // Clear cache
    clear: () => {
      cache.clear();
    },

    // Clear expired entries
    clearExpired: () => {
      const now = Date.now();
      for (const [key, item] of cache.entries()) {
        if (now - item.timestamp > ttl) {
          cache.delete(key);
        }
      }
    },

    // Get cache stats
    getStats: () => ({
      size: cache.size,
      keys: Array.from(cache.keys())
    })
  };

  return cacheManager;
};
