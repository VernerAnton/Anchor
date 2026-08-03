import { AppState, DailyLog, CravingEntry, MorningCommitment, EndOfDayReport, InfoCardData, DEFAULT_INFO_CARD, LoggedFood, NutritionGoals, FoodLibraryItem, MealTemplate, IFSettings, TrackingPause } from '../types';
import { format, subDays } from 'date-fns';
import { isDatePaused } from './nutritionUtils';
import { db } from './firebase';
import { doc, setDoc, deleteDoc, deleteField, onSnapshot, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import {
  cravingEntrySchema,
  morningCommitmentSchema,
  endOfDayReportSchema,
  loggedFoodSchema,
  foodLibraryItemSchema,
  mealTemplateSchema,
  nutritionGoalsSchema,
  ifSettingsSchema,
  trackingPauseSchema,
  infoCardDataSchema,
  dailyLogSchema,
  isValid,
  filterValid,
} from './validation';
import { z } from 'zod';

const STORAGE_KEY = 'recovery_app_data_v1';
const SYNC_KEY_STORAGE = 'recovery_app_sync_key';

// Tracker localStorage keys (hoisted so the realtime sync listener can reference them)
const FOOD_LIBRARY_KEY = 'food_library_v1';
const MEAL_TEMPLATES_KEY = 'meal_templates_v1';
const NUTRITION_GOALS_KEY = 'nutrition_goals_v1';
const IF_SETTINGS_KEY = 'if_settings_v1';
const TRACKING_PAUSES_KEY = 'tracking_pauses_v1';
const RECOVERY_ENABLED_KEY = 'recovery_enabled_v1';

let unsubscribeSnapshot: (() => void) | null = null;
let unsubscribeDocSnapshot: (() => void) | null = null; // NEW: Listener for general data

export const getTodayStr = (): string => format(new Date(), 'yyyy-MM-dd');

// --- SYNC KEY FUNCTIONS ---

export const getSyncKey = (): string => {
  return localStorage.getItem(SYNC_KEY_STORAGE) || '';
};

export const setSyncKey = async (key: string) => {
  const oldKey = getSyncKey();
  localStorage.setItem(SYNC_KEY_STORAGE, key);

  // Unsubscribe from old listener
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }
  // Unsubscribe from doc listener
  if (unsubscribeDocSnapshot) {
    unsubscribeDocSnapshot();
    unsubscribeDocSnapshot = null;
  }

  if (key) {
    // If switching to cloud sync, migrate local data to Firestore
    if (!oldKey) {
      await migrateLocalToCloud(key);
    }

    // Set up real-time listener for the dailyLogs collection
    setupRealtimeSync(key);
  }
};

// Migrate existing localStorage data to new Firestore structure
const migrateLocalToCloud = async (syncKey: string) => {
  try {
    const localState = loadStateFromLocal();

    for (const [date, log] of Object.entries(localState.logs)) {
      const dayDocRef = doc(db, 'user_data', syncKey, 'dailyLogs', date);

      // Convert cravings array to map
      const cravingsMap: Record<string, CravingEntry> = {};
      for (const craving of log.cravings || []) {
        cravingsMap[craving.id] = craving;
      }

      // Convert nutrition array to map (mirror cravings pattern) so pre-existing
      // food logs migrate to the cloud on first connect
      const nutritionMap: Record<string, LoggedFood> = {};
      for (const food of log.nutrition || []) {
        nutritionMap[food.id] = food;
      }

      // Use existing version or default to 1 for migration
      const version = log.version || 1;

      await setDoc(dayDocRef, {
        date,
        version,
        morning: log.morning || null,
        endOfDay: log.endOfDay || null,
        cravings: cravingsMap,
        nutrition: nutritionMap,
        lastUpdated: serverTimestamp(),
      }, { merge: true });

      // Update local version tracking
      setLocalVersion(date, version);
    }

    // Migrate global tracker data (Food Library, Meal Templates, Goals) and the
    // info card to the root user doc. Guard each field so an empty device can
    // never wipe existing cloud data via the merge write.
    const library = getFoodLibrary();
    const templates = getMealTemplates();
    const goals = getNutritionGoals();

    const userPayload: Record<string, any> = { lastUpdated: serverTimestamp() };
    if (library.length) userPayload.foodLibrary = library;
    if (templates.length) userPayload.mealTemplates = templates;
    if (goals) userPayload.nutritionGoals = goals;
    if (localState.infoCardData) userPayload.infoCardData = localState.infoCardData;

    // Only write if there's something beyond the timestamp
    if (Object.keys(userPayload).length > 1) {
      await setDoc(doc(db, 'user_data', syncKey), userPayload, { merge: true });
    }
  } catch (e) {
    console.warn("Migration to cloud failed:", e);
  }
};

// --- VERSION MANAGEMENT ---
// These will be set by App.tsx to bypass React's stale closure problem
let getLocalVersionFn: ((date: string) => number) | null = null;
let setLocalVersionFn: ((date: string, version: number) => void) | null = null;
let clearLocalVersionFn: ((date: string) => void) | null = null;

export const setVersionCallbacks = (
  getVersion: (date: string) => number,
  setVersion: (date: string, version: number) => void,
  clearVersion: (date: string) => void
) => {
  getLocalVersionFn = getVersion;
  setLocalVersionFn = setVersion;
  clearLocalVersionFn = clearVersion;
};

const getLocalVersion = (date: string): number => {
  if (getLocalVersionFn) return getLocalVersionFn(date);
  // Fallback: read from localStorage
  const state = loadStateFromLocal();
  return state.logs[date]?.version || 0;
};

const setLocalVersion = (date: string, version: number): void => {
  if (setLocalVersionFn) setLocalVersionFn(date, version);
};

const clearLocalVersion = (date: string): void => {
  if (clearLocalVersionFn) clearLocalVersionFn(date);
};

// --- REAL-TIME SYNC ---

const setupRealtimeSync = (key: string) => {
  if (!key) return;

  try {
    // 1. Daily Logs Listener
    const logsCollectionRef = collection(db, 'user_data', key, 'dailyLogs');

    unsubscribeSnapshot = onSnapshot(
      logsCollectionRef,
      { includeMetadataChanges: true },  // CRITICAL: See metadata changes
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          // 1. SKIP local echoes - these are our own pending writes
          if (change.doc.metadata.hasPendingWrites) {
            console.log(`Skipping local echo for ${change.doc.id}`);
            return;
          }

          const date = change.doc.id;
          
          // HANDLE REMOVALS FIRST (Bypass version check)
          if (change.type === 'removed') {
            console.log(`Synced deletion for ${date}`);
            removeFromLocalCache(date);
            return;
          }

          const data = change.doc.data();
          const serverVersion = data?.version || 0;
          const localVersion = getLocalVersion(date);

          // 2. REJECT stale server echoes (Only for updates)
          if (serverVersion < localVersion) {
            console.warn(
              `Rejected stale echo for ${date}. Local: ${localVersion}, Server: ${serverVersion}`
            );
            return;
          }

          // 3. ACCEPT: Server version is equal or newer
          if (change.type === 'added' || change.type === 'modified') {
            setLocalVersion(date, serverVersion);  // Sync version to ref
            updateLocalCache(date, data);
          }
        });

        // Notify React components to refresh
        window.dispatchEvent(new Event('storage-update-remote'));
      },
      (error) => {
        console.warn("Cloud sync error:", error);
      }
    );

    // 2. Main Document Listener (InfoCard Data + global tracker data)
    const userDocRef = doc(db, 'user_data', key);
    unsubscribeDocSnapshot = onSnapshot(
      userDocRef,
      { includeMetadataChanges: true },
      (docSnap) => {
        // Skip local writes to avoid jitter
        if (docSnap.metadata.hasPendingWrites) return;

        const data = docSnap.data();
        if (!data) return;

        let dispatchNeeded = false;

        // Sync info card (validated: cloud data is untrusted input)
        if (data.infoCardData && isValid(infoCardDataSchema, data.infoCardData, 'infoCardData')) {
          const state = loadStateFromLocal();
          if (JSON.stringify(state.infoCardData) !== JSON.stringify(data.infoCardData)) {
            state.infoCardData = data.infoCardData;
            saveStateToLocal(state);
            dispatchNeeded = true;
          }
        }

        // Sync global tracker data (Food Library, Meal Templates, Goals)
        if (data.foodLibrary && isValid(z.array(foodLibraryItemSchema), data.foodLibrary, 'foodLibrary')
            && localStorage.getItem(FOOD_LIBRARY_KEY) !== JSON.stringify(data.foodLibrary)) {
          localStorage.setItem(FOOD_LIBRARY_KEY, JSON.stringify(data.foodLibrary));
          dispatchNeeded = true;
        }
        if (data.mealTemplates && isValid(z.array(mealTemplateSchema), data.mealTemplates, 'mealTemplates')
            && localStorage.getItem(MEAL_TEMPLATES_KEY) !== JSON.stringify(data.mealTemplates)) {
          localStorage.setItem(MEAL_TEMPLATES_KEY, JSON.stringify(data.mealTemplates));
          dispatchNeeded = true;
        }
        if (data.nutritionGoals && isValid(nutritionGoalsSchema, data.nutritionGoals, 'nutritionGoals')
            && localStorage.getItem(NUTRITION_GOALS_KEY) !== JSON.stringify(data.nutritionGoals)) {
          localStorage.setItem(NUTRITION_GOALS_KEY, JSON.stringify(data.nutritionGoals));
          dispatchNeeded = true;
        }
        if (data.ifSettings && isValid(ifSettingsSchema, data.ifSettings, 'ifSettings')
            && localStorage.getItem(IF_SETTINGS_KEY) !== JSON.stringify(data.ifSettings)) {
          localStorage.setItem(IF_SETTINGS_KEY, JSON.stringify(data.ifSettings));
          dispatchNeeded = true;
        }
        if (data.trackingPauses && isValid(z.array(trackingPauseSchema), data.trackingPauses, 'trackingPauses')
            && localStorage.getItem(TRACKING_PAUSES_KEY) !== JSON.stringify(data.trackingPauses)) {
          localStorage.setItem(TRACKING_PAUSES_KEY, JSON.stringify(data.trackingPauses));
          dispatchNeeded = true;
        }
        if (typeof data.recoveryEnabled === 'boolean'
            && localStorage.getItem(RECOVERY_ENABLED_KEY) !== JSON.stringify(data.recoveryEnabled)) {
          localStorage.setItem(RECOVERY_ENABLED_KEY, JSON.stringify(data.recoveryEnabled));
          dispatchNeeded = true;
        }

        // Notify React components to refresh (FlipCard, TrackerToday, etc.)
        if (dispatchNeeded) window.dispatchEvent(new Event('storage-update-remote'));
      },
      (error) => console.warn("Cloud sync doc error:", error)
    );

  } catch (e) {
    console.error("Failed to setup sync:", e);
  }
};

// Update local cache from Firestore data
const updateLocalCache = (date: string, data: any) => {
  const state = loadStateFromLocal();
  const existingLog = state.logs[date] || { date, cravings: [], version: 0 };

  // Convert cravings map to array, dropping any entries that don't match
  // the expected shape (data from the cloud is untrusted input)
  let cravingsArray: CravingEntry[] = existingLog.cravings;
  if (data.cravings && typeof data.cravings === 'object') {
    cravingsArray = filterValid(
      cravingEntrySchema,
      Object.values(data.cravings) as CravingEntry[],
      `craving for ${date}`
    );
    cravingsArray.sort((a: CravingEntry, b: CravingEntry) => a.timestamp - b.timestamp);
  }

  // Convert nutrition map to array (mirror cravings pattern)
  let nutritionArray: LoggedFood[] = existingLog.nutrition || [];
  if (data.nutrition && typeof data.nutrition === 'object' && !Array.isArray(data.nutrition)) {
    nutritionArray = filterValid(
      loggedFoodSchema,
      Object.values(data.nutrition) as LoggedFood[],
      `food log for ${date}`
    );
    nutritionArray.sort((a: LoggedFood, b: LoggedFood) => a.timestamp - b.timestamp);
  }

  // morning/endOfDay: null is a legitimate value (written during migration);
  // anything else must match the schema or the existing value is kept
  const morningOk = data.morning == null || isValid(morningCommitmentSchema, data.morning, `morning for ${date}`);
  const endOfDayOk = data.endOfDay == null || isValid(endOfDayReportSchema, data.endOfDay, `endOfDay for ${date}`);

  // Merge - only update fields that exist in the Firestore data
  state.logs[date] = {
    ...existingLog,
    date,
    version: data.version || existingLog.version || 0,  // Sync version
    ...(data.morning !== undefined && morningOk && { morning: data.morning }),
    ...(data.endOfDay !== undefined && endOfDayOk && { endOfDay: data.endOfDay }),
    ...(data.cravings && { cravings: cravingsArray }),
    ...(data.nutrition && { nutrition: nutritionArray }),
    // ifEatingEnd / ifIgnoreDay live on the day doc and are cleared via
    // deleteField() on another device (e.g. un-ignoring a day, resetting the
    // fast). A deleted field is simply absent from the snapshot, so reconcile
    // these from the full doc unconditionally — absence means "cleared".
    // Skipping when undefined (as a conditional spread would) leaves a stale
    // value behind, so the clear never syncs across devices.
    ifEatingEnd: typeof data.ifEatingEnd === 'number' ? data.ifEatingEnd : undefined,
    ifIgnoreDay: data.ifIgnoreDay === true ? true : undefined,
  };

  saveStateToLocal(state);
};

const removeFromLocalCache = (date: string) => {
  const state = loadStateFromLocal();
  delete state.logs[date];
  saveStateToLocal(state);
  // CRITICAL: Clear version tracking to prevent conflicts
  clearLocalVersion(date);
};

// Initialize listener on load if key exists
if (typeof window !== 'undefined') {
  const existingKey = getSyncKey();
  if (existingKey) setupRealtimeSync(existingKey);
}

// --- LOCAL STORAGE (fallback when no sync key) ---

const loadStateFromLocal = (): AppState => {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (!serialized) {
      return { logs: {} };
    }
    return JSON.parse(serialized);
  } catch (e) {
    console.error("Failed to load state", e);
    return { logs: {} };
  }
};

const saveStateToLocal = (state: AppState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save state", e);
  }
};

// Public function to load state (used by components)
export const loadState = (): AppState => {
  return loadStateFromLocal();
};

export const getRawState = (): string => {
  const bundle = {
    appState:      JSON.parse(localStorage.getItem(STORAGE_KEY)       || '{"logs":{}}'),
    foodLibrary:   JSON.parse(localStorage.getItem(FOOD_LIBRARY_KEY)   || '[]'),
    mealTemplates: JSON.parse(localStorage.getItem(MEAL_TEMPLATES_KEY) || '[]'),
    nutritionGoals: JSON.parse(localStorage.getItem(NUTRITION_GOALS_KEY) || 'null'),
    trackingPauses: JSON.parse(localStorage.getItem(TRACKING_PAUSES_KEY) || '[]'),
  };
  return JSON.stringify(bundle, null, 2);
};

// Validate a restored AppState: keep only logs that match the expected
// shape (skipped ones are warned about), preserve the info card if valid.
const sanitizeRestoredState = (raw: any): AppState | null => {
  if (!raw || typeof raw !== 'object' || !raw.logs || typeof raw.logs !== 'object') return null;

  const state: AppState = { logs: {} };
  for (const [date, log] of Object.entries(raw.logs)) {
    if (isValid(dailyLogSchema, log, `backup log for ${date}`)) {
      state.logs[date] = log as DailyLog;
    }
  }
  if (raw.infoCardData && isValid(infoCardDataSchema, raw.infoCardData, 'backup infoCardData')) {
    state.infoCardData = raw.infoCardData;
  }
  return state;
};

export const restoreRawState = async (jsonString: string): Promise<boolean> => {
  try {
    const parsed = JSON.parse(jsonString);

    // New bundled format: { appState, foodLibrary, mealTemplates, nutritionGoals }
    if (parsed && typeof parsed === 'object' && 'appState' in parsed) {
      const restored = sanitizeRestoredState(parsed.appState);
      if (restored) saveStateToLocal(restored);
      if (isValid(z.array(foodLibraryItemSchema), parsed.foodLibrary ?? [], 'backup foodLibrary') && Array.isArray(parsed.foodLibrary)) {
        localStorage.setItem(FOOD_LIBRARY_KEY, JSON.stringify(parsed.foodLibrary));
      }
      if (isValid(z.array(mealTemplateSchema), parsed.mealTemplates ?? [], 'backup mealTemplates') && Array.isArray(parsed.mealTemplates)) {
        localStorage.setItem(MEAL_TEMPLATES_KEY, JSON.stringify(parsed.mealTemplates));
      }
      if (parsed.nutritionGoals && isValid(nutritionGoalsSchema, parsed.nutritionGoals, 'backup nutritionGoals')) {
        localStorage.setItem(NUTRITION_GOALS_KEY, JSON.stringify(parsed.nutritionGoals));
      }
      if (isValid(z.array(trackingPauseSchema), parsed.trackingPauses ?? [], 'backup trackingPauses') && Array.isArray(parsed.trackingPauses)) {
        localStorage.setItem(TRACKING_PAUSES_KEY, JSON.stringify(parsed.trackingPauses));
      }

      const syncKey = getSyncKey();
      if (syncKey) await migrateLocalToCloud(syncKey);
      return true;
    }

    // Legacy format: bare { logs: {} } object — still supported
    if (parsed && typeof parsed === 'object' && 'logs' in parsed) {
      const restored = sanitizeRestoredState(parsed);
      if (!restored) return false;
      saveStateToLocal(restored);
      const syncKey = getSyncKey();
      if (syncKey) await migrateLocalToCloud(syncKey);
      return true;
    }

    return false;
  } catch (e) {
    console.error("Invalid backup file", e);
    return false;
  }
};

// --- DAY LOG FUNCTIONS ---

export const getDayLog = (date: string): DailyLog => {
  const state = loadStateFromLocal();
  return state.logs[date] || { date, cravings: [] };
};

export const getAllLogs = (): DailyLog[] => {
  const state = loadStateFromLocal();
  return Object.values(state.logs).sort((a, b) => b.date.localeCompare(a.date));
};

export const deleteDayLog = async (date: string): Promise<boolean> => {
  const state = loadStateFromLocal();
  if (!state.logs[date]) {
    return false;
  }

  const syncKey = getSyncKey();
  if (syncKey) {
    try {
      const dayDocRef = doc(db, 'user_data', syncKey, 'dailyLogs', date);
      await deleteDoc(dayDocRef);
    } catch (e) {
      console.error('Failed to delete day log from cloud sync:', e);
      return false;
    }
  }

  delete state.logs[date];
  saveStateToLocal(state);

  // CRITICAL: Clear version tracking for deleted log
  clearLocalVersion(date);

  return true;
};

export const deleteDayLogLocal = (date: string): boolean => {
  // Safety guard: local-only deletion should never run while cloud sync is connected.
  if (getSyncKey()) return false;

  const state = loadStateFromLocal();
  if (!state.logs[date]) {
    return false;
  }

  delete state.logs[date];
  saveStateToLocal(state);

  // CRITICAL: Clear version tracking for deleted log
  clearLocalVersion(date);

  return true;
};

// --- MORNING COMMITMENT ---

export const saveMorningCommitment = async (date: string, commitment: MorningCommitment) => {
  // Increment version IMMEDIATELY (synchronous guard against stale echoes)
  const currentVersion = getLocalVersion(date);
  const newVersion = currentVersion + 1;
  setLocalVersion(date, newVersion);

  // Update local state
  const state = loadStateFromLocal();
  const log = state.logs[date] || { date, cravings: [], version: 0 };
  log.morning = commitment;
  log.version = newVersion;
  state.logs[date] = log;
  saveStateToLocal(state);

  // Push to Firestore if connected
  const syncKey = getSyncKey();
  if (syncKey) {
    try {
      const dayDocRef = doc(db, 'user_data', syncKey, 'dailyLogs', date);
      await setDoc(dayDocRef, {
        date,
        version: newVersion,
        morning: commitment,
        lastUpdated: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.error('Failed to sync morning commitment:', e);
    }
  }
};

export const deleteMorningCommitment = async (date: string) => {
  // Increment version IMMEDIATELY
  const currentVersion = getLocalVersion(date);
  const newVersion = currentVersion + 1;
  setLocalVersion(date, newVersion);

  // Update local state
  const state = loadStateFromLocal();
  const log = state.logs[date];
  if (log) {
    delete log.morning;
    log.version = newVersion;
    state.logs[date] = log;
    saveStateToLocal(state);
  }

  // Update Firestore if connected
  const syncKey = getSyncKey();
  if (syncKey) {
    try {
      const dayDocRef = doc(db, 'user_data', syncKey, 'dailyLogs', date);
      await setDoc(dayDocRef, {
        version: newVersion,
        morning: deleteField(),
        lastUpdated: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.error('Failed to sync morning deletion:', e);
    }
  }
};

// --- CRAVINGS ---

export const addCraving = async (date: string, craving: CravingEntry) => {
  // Increment version IMMEDIATELY
  const currentVersion = getLocalVersion(date);
  const newVersion = currentVersion + 1;
  setLocalVersion(date, newVersion);

  // Update local state
  const state = loadStateFromLocal();
  const log = state.logs[date] || { date, cravings: [], version: 0 };
  log.cravings = [...log.cravings, craving];
  log.version = newVersion;
  state.logs[date] = log;
  saveStateToLocal(state);

  // Push to Firestore if connected - add craving to map
  const syncKey = getSyncKey();
  if (syncKey) {
    try {
      const dayDocRef = doc(db, 'user_data', syncKey, 'dailyLogs', date);
      // FIXED: Use nested object instead of dot notation key for setDoc
      await setDoc(dayDocRef, {
        date,
        version: newVersion,
        cravings: {
          [craving.id]: craving
        },
        lastUpdated: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.error('Failed to sync craving:', e);
    }
  }
};

export const deleteCraving = async (date: string, cravingId: string) => {
  // Increment version IMMEDIATELY
  const currentVersion = getLocalVersion(date);
  const newVersion = currentVersion + 1;
  setLocalVersion(date, newVersion);

  // Update local state
  const state = loadStateFromLocal();
  const log = state.logs[date];
  if (log) {
    log.cravings = log.cravings.filter(c => c.id !== cravingId);
    log.version = newVersion;
    state.logs[date] = log;
    saveStateToLocal(state);
  }

  // Remove from Firestore if connected
  const syncKey = getSyncKey();
  if (syncKey) {
    try {
      const dayDocRef = doc(db, 'user_data', syncKey, 'dailyLogs', date);
      // FIXED: Use nested object for deletion
      await setDoc(dayDocRef, {
        version: newVersion,
        cravings: {
          [cravingId]: deleteField()
        },
        lastUpdated: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.error('Failed to sync craving deletion:', e);
    }
  }
};

export const updateCraving = async (date: string, cravingId: string, updates: Partial<CravingEntry>) => {
  // Increment version IMMEDIATELY
  const currentVersion = getLocalVersion(date);
  const newVersion = currentVersion + 1;
  setLocalVersion(date, newVersion);

  // Update local state
  const state = loadStateFromLocal();
  const log = state.logs[date];
  if (log) {
    // FIX: Cast the result of map to CravingEntry[] to satisfy TypeScript's strict union checks
    log.cravings = log.cravings.map(c =>
      c.id === cravingId ? { ...c, ...updates } : c
    ) as CravingEntry[];
    
    log.version = newVersion;
    state.logs[date] = log;
    saveStateToLocal(state);
  }

  // Update in Firestore if connected
  const syncKey = getSyncKey();
  if (syncKey) {
    try {
      const dayDocRef = doc(db, 'user_data', syncKey, 'dailyLogs', date);
      // Get the full craving with updates
      const updatedCraving = log?.cravings.find(c => c.id === cravingId);
      if (updatedCraving) {
        // FIXED: Use nested object for update
        await setDoc(dayDocRef, {
          version: newVersion,
          cravings: {
            [cravingId]: updatedCraving
          },
          lastUpdated: serverTimestamp(),
        }, { merge: true });
      }
    } catch (e) {
      console.error('Failed to sync craving update:', e);
    }
  }
};

// --- END OF DAY ---

export const saveEndOfDay = async (date: string, report: EndOfDayReport) => {
  // Increment version IMMEDIATELY
  const currentVersion = getLocalVersion(date);
  const newVersion = currentVersion + 1;
  setLocalVersion(date, newVersion);

  // Update local state
  const state = loadStateFromLocal();
  const log = state.logs[date] || { date, cravings: [], version: 0 };
  log.endOfDay = report;
  log.version = newVersion;
  state.logs[date] = log;
  saveStateToLocal(state);

  // Push to Firestore if connected
  const syncKey = getSyncKey();
  if (syncKey) {
    try {
      const dayDocRef = doc(db, 'user_data', syncKey, 'dailyLogs', date);
      await setDoc(dayDocRef, {
        date,
        version: newVersion,
        endOfDay: report,
        lastUpdated: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.error('Failed to sync end of day:', e);
    }
  }
};

// --- ANALYTICS HELPERS ---

export const getSlipEscalations = (log: DailyLog): ('contained' | 'escalated')[] => [
  ...log.cravings
    .filter((c): c is Extract<CravingEntry, { ate: true }> => c.ate === true)
    .map(c => c.escalationLevel),
  ...(log.endOfDay?.eodEscalationLevel ? [log.endOfDay.eodEscalationLevel] : [])
];

// --- INFO CARD DATA FUNCTIONS ---

/**
 * Load flip card data (global, not date-specific)
 * Returns default content if not previously set
 */
export const loadInfoCardData = (): InfoCardData => {
  const state = loadStateFromLocal();
  return state.infoCardData || DEFAULT_INFO_CARD;
};

/**
 * Save flip card data to localStorage and cloud sync
 */
export const saveInfoCardData = async (data: InfoCardData): Promise<void> => {
  const state = loadStateFromLocal();
  state.infoCardData = data;
  saveStateToLocal(state);

  // If cloud sync is enabled, push to Firestore
  const syncKey = getSyncKey();
  if (syncKey) {
    try {
      const docRef = doc(db, 'user_data', syncKey);
      await setDoc(docRef, {
        infoCardData: data,
        lastUpdated: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.error('Failed to sync info card data:', e);
    }
  }
};

/**
 * Reset flip card to default content
 */
export const resetInfoCardToDefault = async (): Promise<void> => {
  await saveInfoCardData(DEFAULT_INFO_CARD);
};

// --- FOOD LIBRARY (synced to user doc when a sync key is set) ---

// Push a global tracker field to the root user doc (fire-and-forget; mirrors
// saveInfoCardData). localStorage is always written by the caller first.
const syncUserField = async (field: string, value: any): Promise<void> => {
  const syncKey = getSyncKey();
  if (!syncKey) return;
  try {
    await setDoc(doc(db, 'user_data', syncKey), {
      [field]: value,
      lastUpdated: serverTimestamp(),
    }, { merge: true });
  } catch (e) {
    console.error(`Failed to sync ${field}:`, e);
  }
};

export const getFoodLibrary = (): FoodLibraryItem[] => {
  try {
    const raw = localStorage.getItem(FOOD_LIBRARY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as FoodLibraryItem[];
  } catch {
    return [];
  }
};

export const saveFoodToLibrary = async (item: FoodLibraryItem): Promise<void> => {
  const library = getFoodLibrary();
  const existing = library.findIndex(f => f.id === item.id);
  if (existing >= 0) {
    library[existing] = item;
  } else {
    library.push(item);
  }
  localStorage.setItem(FOOD_LIBRARY_KEY, JSON.stringify(library));
  await syncUserField('foodLibrary', library);
};

export const deleteFoodFromLibrary = async (id: string): Promise<void> => {
  const library = getFoodLibrary().filter(f => f.id !== id);
  localStorage.setItem(FOOD_LIBRARY_KEY, JSON.stringify(library));
  await syncUserField('foodLibrary', library);
};

// --- MEAL TEMPLATES (synced to user doc when a sync key is set) ---

export const getMealTemplates = (): MealTemplate[] => {
  try {
    const raw = localStorage.getItem(MEAL_TEMPLATES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MealTemplate[];
  } catch {
    return [];
  }
};

export const saveMealTemplate = async (template: MealTemplate): Promise<void> => {
  const templates = getMealTemplates();
  const idx = templates.findIndex(t => t.id === template.id);
  if (idx >= 0) templates[idx] = template; else templates.push(template);
  localStorage.setItem(MEAL_TEMPLATES_KEY, JSON.stringify(templates));
  await syncUserField('mealTemplates', templates);
};

export const deleteMealTemplate = async (id: string): Promise<void> => {
  const templates = getMealTemplates().filter(t => t.id !== id);
  localStorage.setItem(MEAL_TEMPLATES_KEY, JSON.stringify(templates));
  await syncUserField('mealTemplates', templates);
};

const MEAL_USAGE_KEY = 'meal_usage_v1';

type MealUsageMap = Record<string, { count: number; lastUsed: number }>;

export const getMealUsage = (): MealUsageMap => {
  try {
    const raw = localStorage.getItem(MEAL_USAGE_KEY);
    return raw ? (JSON.parse(raw) as MealUsageMap) : {};
  } catch {
    return {};
  }
};

export const recordMealUsage = (templateId: string): void => {
  const usage = getMealUsage();
  const prev = usage[templateId] ?? { count: 0, lastUsed: 0 };
  usage[templateId] = { count: prev.count + 1, lastUsed: Date.now() };
  localStorage.setItem(MEAL_USAGE_KEY, JSON.stringify(usage));
};

// --- NUTRITION GOALS (synced to user doc when a sync key is set) ---

export const getNutritionGoals = (): NutritionGoals | null => {
  try {
    const raw = localStorage.getItem(NUTRITION_GOALS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as NutritionGoals;
  } catch {
    return null;
  }
};

export const saveNutritionGoals = async (goals: NutritionGoals): Promise<void> => {
  localStorage.setItem(NUTRITION_GOALS_KEY, JSON.stringify(goals));
  await syncUserField('nutritionGoals', goals);
};

export const getIFSettings = (): IFSettings | null => {
  try {
    const raw = localStorage.getItem(IF_SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as IFSettings;
  } catch {
    return null;
  }
};

export const saveIFSettings = async (settings: IFSettings): Promise<void> => {
  localStorage.setItem(IF_SETTINGS_KEY, JSON.stringify(settings));
  await syncUserField('ifSettings', settings);
};

// --- TRACKING PAUSES (synced to user doc when a sync key is set) ---

export const getTrackingPauses = (): TrackingPause[] => {
  try {
    const raw = localStorage.getItem(TRACKING_PAUSES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TrackingPause[];
  } catch {
    return [];
  }
};

export const saveTrackingPauses = async (pauses: TrackingPause[]): Promise<void> => {
  localStorage.setItem(TRACKING_PAUSES_KEY, JSON.stringify(pauses));
  await syncUserField('trackingPauses', pauses);
};

// Start an open-ended pause from today. No-op if today is already paused
// (whether by an ongoing pause or an existing fixed-range one).
export const pauseTrackingFromToday = async (): Promise<void> => {
  const pauses = getTrackingPauses();
  if (isDatePaused(getTodayStr(), pauses)) return;
  pauses.push({ id: crypto.randomUUID(), start: getTodayStr(), end: null });
  await saveTrackingPauses(pauses);
};

// Resume tracking as of today: every pause covering today is ended *yesterday*
// (the last genuinely paused day) so today becomes trackable again. `end` is
// inclusive, so ending at today would leave today paused. A pause that covered
// nothing before today (yesterday < start) is dropped entirely.
export const resumeTrackingToday = async (): Promise<void> => {
  const today = getTodayStr();
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const pauses = getTrackingPauses();
  let changed = false;
  const next: TrackingPause[] = [];
  for (const p of pauses) {
    const coversToday = today >= p.start && (p.end === null || today <= p.end);
    if (!coversToday) { next.push(p); continue; }
    changed = true;
    if (yesterday < p.start) continue; // pause only ever covered today (or later) → remove
    next.push({ ...p, end: yesterday });
  }
  if (changed) await saveTrackingPauses(next);
};

// Add or update a pause period by id (used by the management UI).
export const upsertTrackingPause = async (pause: TrackingPause): Promise<void> => {
  const pauses = getTrackingPauses();
  const idx = pauses.findIndex(p => p.id === pause.id);
  if (idx >= 0) pauses[idx] = pause; else pauses.push(pause);
  await saveTrackingPauses(pauses);
};

export const deleteTrackingPause = async (id: string): Promise<void> => {
  await saveTrackingPauses(getTrackingPauses().filter(p => p.id !== id));
};

// --- RECOVERY MODE TOGGLE (synced to user doc when a sync key is set) ---
// When off, the app stops defaulting into the recovery side and its daily
// nudges are suppressed. The recovery side stays reachable and its data is kept.

export const getRecoveryEnabled = (): boolean => {
  try {
    const raw = localStorage.getItem(RECOVERY_ENABLED_KEY);
    return raw === null ? true : JSON.parse(raw) === true;
  } catch {
    return true;
  }
};

export const setRecoveryEnabled = async (value: boolean): Promise<void> => {
  localStorage.setItem(RECOVERY_ENABLED_KEY, JSON.stringify(value));
  await syncUserField('recoveryEnabled', value);
};

// Manually set (or clear, with null) the IF eating-end timestamp for a day
export const setIFEatingEnd = async (date: string, ts: number | null): Promise<void> => {
  const currentVersion = getLocalVersion(date);
  const newVersion = currentVersion + 1;
  setLocalVersion(date, newVersion);

  const state = loadStateFromLocal();
  const log = state.logs[date] || { date, cravings: [], version: 0 };
  if (ts === null) {
    delete log.ifEatingEnd;
  } else {
    log.ifEatingEnd = ts;
  }
  log.version = newVersion;
  state.logs[date] = log;
  saveStateToLocal(state);

  const syncKey = getSyncKey();
  if (syncKey) {
    try {
      const dayDocRef = doc(db, 'user_data', syncKey, 'dailyLogs', date);
      await setDoc(dayDocRef, {
        date,
        version: newVersion,
        ifEatingEnd: ts === null ? deleteField() : ts,
        lastUpdated: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.error('Failed to sync IF eating-end:', e);
    }
  }
};

// Manually mark (or unmark) a day as ignored for IF averages
export const setIFIgnoreDay = async (date: string, value: boolean): Promise<void> => {
  const currentVersion = getLocalVersion(date);
  const newVersion = currentVersion + 1;
  setLocalVersion(date, newVersion);

  const state = loadStateFromLocal();
  const log = state.logs[date] || { date, cravings: [], version: 0 };
  if (value) {
    log.ifIgnoreDay = true;
  } else {
    delete log.ifIgnoreDay;
  }
  log.version = newVersion;
  state.logs[date] = log;
  saveStateToLocal(state);

  const syncKey = getSyncKey();
  if (syncKey) {
    try {
      const dayDocRef = doc(db, 'user_data', syncKey, 'dailyLogs', date);
      await setDoc(dayDocRef, {
        date,
        version: newVersion,
        ifIgnoreDay: value ? true : deleteField(),
        lastUpdated: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.error('Failed to sync IF ignore-day:', e);
    }
  }
};

// --- FOOD LOG ---

export const addLoggedFood = async (date: string, food: LoggedFood): Promise<void> => {
  const currentVersion = getLocalVersion(date);
  const newVersion = currentVersion + 1;
  setLocalVersion(date, newVersion);

  const state = loadStateFromLocal();
  const log = state.logs[date] || { date, cravings: [], version: 0 };
  log.nutrition = [...(log.nutrition || []), food];
  log.version = newVersion;
  state.logs[date] = log;
  saveStateToLocal(state);

  const syncKey = getSyncKey();
  if (syncKey) {
    try {
      const dayDocRef = doc(db, 'user_data', syncKey, 'dailyLogs', date);
      await setDoc(dayDocRef, {
        date,
        version: newVersion,
        nutrition: { [food.id]: food },
        lastUpdated: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.error('Failed to sync food log:', e);
    }
  }
};

export const updateLoggedFood = async (date: string, id: string, grams: number): Promise<void> => {
  const currentVersion = getLocalVersion(date);
  const newVersion = currentVersion + 1;
  setLocalVersion(date, newVersion);

  const state = loadStateFromLocal();
  const log = state.logs[date];
  if (!log) return;

  const updatedFood = log.nutrition?.find(f => f.id === id);
  if (!updatedFood) return;

  const newFood = { ...updatedFood, grams };
  log.nutrition = (log.nutrition || []).map(f => f.id === id ? newFood : f);
  log.version = newVersion;
  state.logs[date] = log;
  saveStateToLocal(state);

  const syncKey = getSyncKey();
  if (syncKey) {
    try {
      const dayDocRef = doc(db, 'user_data', syncKey, 'dailyLogs', date);
      await setDoc(dayDocRef, {
        version: newVersion,
        nutrition: { [id]: newFood },
        lastUpdated: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.error('Failed to sync food update:', e);
    }
  }
};

export const updateLoggedFoodFields = async (
  date: string,
  id: string,
  updates: Partial<Pick<LoggedFood, 'grams' | 'timestamp' | 'ifIgnore'>>
): Promise<void> => {
  const currentVersion = getLocalVersion(date);
  const newVersion = currentVersion + 1;
  setLocalVersion(date, newVersion);

  const state = loadStateFromLocal();
  const log = state.logs[date];
  if (!log) return;

  const existing = log.nutrition?.find(f => f.id === id);
  if (!existing) return;

  const newFood: LoggedFood = { ...existing, ...updates };
  log.nutrition = (log.nutrition || []).map(f => f.id === id ? newFood : f);
  log.version = newVersion;
  state.logs[date] = log;
  saveStateToLocal(state);

  const syncKey = getSyncKey();
  if (syncKey) {
    try {
      const dayDocRef = doc(db, 'user_data', syncKey, 'dailyLogs', date);
      await setDoc(dayDocRef, {
        version: newVersion,
        nutrition: { [id]: newFood },
        lastUpdated: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.error('Failed to sync food update:', e);
    }
  }
};

export const deleteLoggedFood = async (date: string, id: string): Promise<void> => {
  const currentVersion = getLocalVersion(date);
  const newVersion = currentVersion + 1;
  setLocalVersion(date, newVersion);

  const state = loadStateFromLocal();
  const log = state.logs[date];
  if (!log) return;

  log.nutrition = (log.nutrition || []).filter(f => f.id !== id);
  log.version = newVersion;
  state.logs[date] = log;
  saveStateToLocal(state);

  const syncKey = getSyncKey();
  if (syncKey) {
    try {
      const dayDocRef = doc(db, 'user_data', syncKey, 'dailyLogs', date);
      await setDoc(dayDocRef, {
        version: newVersion,
        nutrition: { [id]: deleteField() },
        lastUpdated: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.error('Failed to sync food deletion:', e);
    }
  }
};

// --- LEGACY EXPORTS (for compatibility) ---

export const saveState = (state: AppState) => {
  saveStateToLocal(state);
};

// --- CLEAR ALL DATA ---

export const clearAllCloudData = async (): Promise<void> => {
  const syncKey = getSyncKey();
  if (!syncKey) return;
  try {
    // Delete all daily log documents under the user's sync key
    const logsRef = collection(db, 'user_data', syncKey, 'dailyLogs');
    const snapshot = await getDocs(logsRef);
    await Promise.all(snapshot.docs.map(d => deleteDoc(d.ref)));
    // Delete the root user document (stores shared state like nutrition goals)
    await deleteDoc(doc(db, 'user_data', syncKey));
  } catch (e) {
    console.error('Failed to clear cloud data:', e);
  }
};