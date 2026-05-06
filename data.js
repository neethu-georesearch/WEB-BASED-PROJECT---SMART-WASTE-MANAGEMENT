/**
 * data.js
 * Data fetching, processing, and filtering functionality
 */

// Polling interval handler
let refreshIntervalId = null;
let lastFetchAttempt = 0;

// Initialize bins data with BIN_LOCATIONS
function initializeBinsFromLocations() {
  if (bins.length > 0) return; // Don't initialize if we already have data
  
  bins = [];
  
  // Create initial bins data from BIN_LOCATIONS
  Object.keys(BIN_LOCATIONS).forEach(key => {
    const { ward, binId } = parseBinKey(key);
    
    bins.push({
      ward: ward,
      binId: binId,
      fillLevel: 0,
      fillPercent: 0,
      fillVolume: 0,
      timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
      status: 'normal'
    });
  });
  
  // Apply filters to update UI
  applyFilters();
}

/**
 * Fetch sensor data from API
 */
function fetchSensorData() {
  if (devModeEnabled) return;
  
  const now = Date.now();
  lastFetchAttempt = now;
  
  fetch(API_ENDPOINTS.DATA)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      bins = data;
      // Store this data point in history before updating UI
      try {
        storeHistoryData();
      } catch (error) {
        console.error("Error storing history data:", error);
      }
      
      // Reset bin markers after fetch
      resetBinMarkers();
      
      applyFilters();
      updateConnectionStatus(true);
    })
    .catch(error => {
      console.error("Fetch error:", error);
      if (Date.now() - lastFetchAttempt > 2000) {
        updateConnectionStatus(false);
      }
    });
}

/**
 * Reset bin markers to their original state
 * This is called when refreshing data after collection
 */
function resetBinMarkers() {
  bins.forEach(bin => {
    const binKey = createBinKey(bin.ward, bin.binId);
    const marker = markersDict[binKey];
    
    if (marker) {
      // Get fill status
      const fill = bin.fillPercent || 0;
      const status = getFillStatus(fill);
      
      // Update marker icon
      marker.setIcon(getMarkerIcon(status));
      
      // Update popup content
      updateMarkerPopup(marker, bin);
    }
  });
}

/**
 * Fetch configuration from API - keeping this for potential future use
 */
function fetchConfig() {
  fetch(API_ENDPOINTS.CONFIG)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then(config => {
      // Just fetch the data after getting config
      fetchSensorData();
      showNotification("Data refreshed from server");
    })
    .catch(error => {
      console.error("Config fetch error:", error);
      showNotification("Failed to sync with server", "error");
    });
}

/**
 * Update connection status indicator
 * @param {boolean} isConnected - Whether the connection is active
 */
function updateConnectionStatus(isConnected) {
  connectionStatus = isConnected;
  const indicator = document.getElementById('connection-indicator');
  const text = document.getElementById('connection-text');
  
  if (isConnected) {
    indicator.className = 'indicator connected';
    text.textContent = 'Connected (Real-time)';
  } else {
    indicator.className = 'indicator disconnected';
    text.textContent = 'Connection lost';
  }
}

/**
 * Apply filters to the bin data
 * Uses search input and fill level dropdown
 */
function applyFilters() {
  const searchValue = document.getElementById('search').value.toLowerCase();
  const fillChoice = document.getElementById('fill-select').value;

  filteredBins = bins.filter(bin => {
    // Apply search filter
    const name = (bin.ward + ' ' + bin.binId).toLowerCase();
    const matchSearch = (!searchValue || name.includes(searchValue));

    // Apply fill level filter
    const fill = bin.fillPercent || 0;
    const status = getFillStatus(fill);
    let matchFill = false;
    
    if (fillChoice === 'ALL') {
      matchFill = true;
    } else if (fillChoice === 'SAFE' && fill < FILL_THRESHOLDS.WARNING) {
      matchFill = true;
    } else if (fillChoice === 'WARNING' && fill >= FILL_THRESHOLDS.WARNING && fill < FILL_THRESHOLDS.CRITICAL) {
      matchFill = true;
    } else if (fillChoice === 'CRITICAL' && fill >= FILL_THRESHOLDS.CRITICAL) {
      matchFill = true;
    }

    return (matchSearch && matchFill);
  });

  // Update UI with filtered data
  updateDashboard();
}

/**
 * Start real-time data fetching
 */
function startDataFetching() {
  // Initialize bins from BIN_LOCATIONS first
  initializeBinsFromLocations();
  
  // Initial fetch
  fetchSensorData();
  
  // Set up interval for regular polling - we check for fresh data every 1 second
  // This keeps the UI responsive while not missing any updates from the simulator
  const REFRESH_RATE = 1000; // Fixed 1-second refresh rate
  
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
  }
  
  refreshIntervalId = setInterval(fetchSensorData, REFRESH_RATE);
  
  console.log("Started data fetching with 1-second interval");
}

/**
 * Show search suggestions based on input
 */
function showSearchSuggestions() {
  const searchValue = document.getElementById('search').value.toLowerCase();
  const suggestionsBox = document.getElementById('search-suggestions');
  suggestionsBox.innerHTML = '';
  
  if (!searchValue) {
    suggestionsBox.style.display = 'none';
    return;
  }
  
  // Find matching wards
  let matchedWards = [];
  bins.forEach(bin => {
    const name = (bin.ward + ' ' + bin.binId).toLowerCase();
    if (name.includes(searchValue) && !matchedWards.includes(bin.ward)) {
      matchedWards.push(bin.ward);
    }
  });
  
  if (matchedWards.length === 0) {
    suggestionsBox.style.display = 'none';
    return;
  }
  
  // Create suggestion items
  matchedWards.forEach(ward => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.textContent = ward;
    item.onclick = () => {
      document.getElementById('search').value = ward;
      suggestionsBox.style.display = 'none';
      applyFilters();
    };
    suggestionsBox.appendChild(item);
  });
  
  suggestionsBox.style.display = 'block';
}

/**
 * Store the current data point in the history for each bin
 * This will be called each time we get new data
 */
function storeHistoryData() {
  // If we don't have bins data yet, return
  if (!bins || bins.length === 0) return;
  
  // Initialize the history object if it doesn't exist
  if (!window.binHistory) {
    window.binHistory = {};
  }
  
  // Get current timestamp
  const now = new Date();
  const timestamp = now.toLocaleTimeString();
  
  // Store data for each bin
  bins.forEach(bin => {
    const binKey = createBinKey(bin.ward, bin.binId);
    
    // Initialize history array for this bin if it doesn't exist
    if (!window.binHistory[binKey]) {
      window.binHistory[binKey] = [];
    }
    
    // Add the current data point to history
    window.binHistory[binKey].push({
      timestamp: timestamp,
      fillPercent: bin.fillPercent,
      fillLevel: bin.fillLevel,
      status: bin.status
    });
    
    // Limit history to last 30 readings to prevent memory issues
    if (window.binHistory[binKey].length > 30) {
      window.binHistory[binKey].shift();
    }
  });
}

/**
 * Update dashboard elements with filtered data
 */
function updateDashboard() {
  // Sort bins by fill percentage (descending)
  filteredBins.sort((a, b) => (b.fillPercent || 0) - (a.fillPercent || 0));
  
  // Get stats for different statuses
  let criticalCount = 0;
  let warningCount = 0;
  let safeCount = 0;
  
  // Count by status first
  filteredBins.forEach(bin => {
    const fill = bin.fillPercent || 0;
    const status = getFillStatus(fill);
    
    if (status === STATUS.CRITICAL) criticalCount++;
    else if (status === STATUS.WARNING) warningCount++;
    else safeCount++;
  });
  
  // Update summary metrics before table to prevent layout shifts
  document.getElementById('critical-count').textContent = criticalCount;
  document.getElementById('warning-count').textContent = warningCount;
  document.getElementById('total-count').textContent = filteredBins.length;
  
  // Update status chart
  updateStatusChart(criticalCount, warningCount, safeCount);
  
  // Update bin list table
  const tableBody = document.getElementById('priority-items');
  
  // Use DocumentFragment for better performance
  const fragment = document.createDocumentFragment();
  
  filteredBins.forEach(bin => {
    const fill = bin.fillPercent || 0;
    const status = getFillStatus(fill);
    
    // Create table row
    const row = document.createElement('tr');
    const statusClass = status.toLowerCase();
    
    row.innerHTML = `
      <td>${bin.ward} - ${bin.binId}</td>
      <td>
        <div class='progress-bar'>
          <div class='progress-fill ${statusClass}' style='width:${fill}%'></div>
        </div>
        <small>${fill.toFixed(1)}%</small>
      </td>
      <td><span class="status-badge ${statusClass}">${status}</span></td>
    `;
    
    fragment.appendChild(row);
  });
  
  // Clear and append in one operation to minimize layout shifts
  tableBody.innerHTML = '';
  tableBody.appendChild(fragment);
  
  // Update map markers
  updateMarkers();
}