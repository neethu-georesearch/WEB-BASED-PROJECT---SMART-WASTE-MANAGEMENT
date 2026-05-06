/**
 * config.js
 * Constants, configuration, and initial data
 */

// API Endpoints
const API_ENDPOINTS = {
  DATA: 'http://127.0.0.1:5000/api/data',
  CONFIG: 'http://127.0.0.1:5000/api/config'
};

// Status threshold definitions
const FILL_THRESHOLDS = {
  CRITICAL: 80,  // >= 80% fill is critical
  WARNING: 50    // >= 50% fill is warning
};

// Status labels
const STATUS = {
  CRITICAL: 'CRITICAL',
  WARNING: 'WARNING',
  SAFE: 'SAFE'
};

// Map center coordinates (Trivandrum)
const MAP_CENTER = [8.5241, 76.9366];
const MAP_ZOOM = 14;

// Bin locations data
const BIN_LOCATIONS = {
  "Peroorkada market|Bin 1": { lat: 8.5360849, lng: 76.9639254 },
  "Vazhayila|Bin 1": { lat: 8.5439273, lng: 76.9692332 },
  "Vattiyoorkavu|Bin 1": { lat: 8.5239711, lng: 76.9698018 },
  "Jagathy|Bin 1": { lat: 8.4949164, lng: 76.9643831 },
  "Chenthitta|Bin 1": { lat: 8.4855753, lng: 76.9505522 },
  "Attakulangara|Bin 1": { lat: 8.4793369, lng: 76.950903 },
  "Sanmathi|Bin 1": { lat: 8.4793369, lng: 76.950903 },
  "Manacadu near HI office|RRF": { lat: 8.4761367, lng: 76.9499494 },
  "Manacadu Kuthukallinmoodu market|Bin 1": { lat: 8.4645832, lng: 76.9514595 },
  "Kalladimukam flat|RRF": { lat: 8.455669, lng: 76.95853 },
  "Sreekandeswaram|Bin 1": { lat: 8.5222, lng: 76.9345 },
  "Fort garage|Bin 1": { lat: 8.4795405, lng: 76.9365799 },
  "Karamana(maruthoorkadavu bridge)|Bin 1": { lat: 8.4667675, lng: 76.9628983 },
  "Thiruvallam ,poonkulam|Bin 1": { lat: 8.4284444, lng: 76.9712222 },
  "Vizhinjam|Bin 1": { lat: 8.3783913, lng: 76.9971657 },
  "Poonthura|Bin 1": { lat: 8.4420984, lng: 76.9448175 },
  "Muttathara|RRF": { lat: 8.4596977, lng: 76.9344794 },
  "Chakka|Bin 1": { lat: 8.4903676, lng: 76.9206262 },
  "Medical college|Bin 1": { lat: 8.5281944, lng: 76.9287778 },
  "Nalanchira|Bin 1": { lat: 8.5449722, lng: 76.9438611 },
  "Kazhakoottam|Bin 1": { lat: 8.5686499, lng: 76.8569785 },
  "Attipra|Bin 1": { lat: 8.5411982, lng: 76.8802523 }
};
// Chart colors (from CSS variables)
const CHART_COLORS = {
  CRITICAL: getComputedStyle(document.documentElement).getPropertyValue('--critical').trim(),
  WARNING: getComputedStyle(document.documentElement).getPropertyValue('--warning').trim(),
  NORMAL: getComputedStyle(document.documentElement).getPropertyValue('--normal').trim()
};

// Global state variables
let bins = [];          // from the simulator 
let filteredBins = [];  // after fill-level + search
let connectionStatus = false;
let devModeEnabled = false;
let collapsed = false;

/**
 * Helper function to determine fill status based on percentage
 * @param {number} fillPercent - The fill percentage value
 * @returns {string} Status label (CRITICAL, WARNING, or SAFE)
 */
function getFillStatus(fillPercent) {
  if (fillPercent >= FILL_THRESHOLDS.CRITICAL) return STATUS.CRITICAL;
  if (fillPercent >= FILL_THRESHOLDS.WARNING) return STATUS.WARNING;
  return STATUS.SAFE;
}

/**
 * Creates a bin key from ward and binId
 * @param {string} ward - The ward name
 * @param {string} binId - The bin identifier
 * @returns {string} Combined key in format "ward|binId"
 */
function createBinKey(ward, binId) {
  return `${ward}|${binId}`;
}

/**
 * Parses a bin key into ward and binId components
 * @param {string} key - The combined key in format "ward|binId"
 * @returns {Object} Object with ward and binId properties
 */
function parseBinKey(key) {
  const parts = key.split('|');
  return {
    ward: parts[0],
    binId: parts[1]
  };
}
