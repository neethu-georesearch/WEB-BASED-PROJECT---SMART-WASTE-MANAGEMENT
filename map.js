/**
 * map.js
 * Leaflet map setup and marker management
 */

// Leaflet map instance
let map;

// Marker storage
let markersDict = {};
let markersLayer = L.layerGroup();

// Marker icons for different statuses
const MarkerIcons = {
  CRITICAL: L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41]
  }),
  WARNING: L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
    shadowUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41]
  }),
  SAFE: L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
    shadowUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41]
  })
};

/**
 * Initialize the Leaflet map
 */
function initMap() {
  // Create map instance
  map = L.map('map').setView(MAP_CENTER, MAP_ZOOM);
  
  // Add OpenStreetMap tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  
  // Add markers layer
  map.addLayer(markersLayer);
  
  // Create initial markers
  createMarkers(false);
}

/**
 * Get the appropriate marker icon based on status
 * @param {string} status - The status label
 * @returns {L.Icon} Leaflet icon object
 */
function getMarkerIcon(status) {
  return MarkerIcons[status] || MarkerIcons.SAFE;
}

/**
 * Create or update markers on the map
 * @param {boolean} draggable - Whether markers should be draggable
 */
function createMarkers(draggable) {
  // Clear existing markers
  markersLayer.clearLayers();
  markersDict = {};
  
  // Add markers for each bin location
  Object.keys(BIN_LOCATIONS).forEach(key => {
    const coords = BIN_LOCATIONS[key];
    let icon = getMarkerIcon(STATUS.SAFE);
    
    // If data is available, use appropriate status
    const binData = bins.find(bin => createBinKey(bin.ward, bin.binId) === key);
    if (binData) {
      const fill = binData.fillPercent || 0;
      const status = getFillStatus(fill);
      icon = getMarkerIcon(status);
    }
    
    // Create marker
    const marker = L.marker([coords.lat, coords.lng], {
      draggable: (devModeEnabled && draggable),
      icon
    });
    
    // Add drag event handler
    marker.on('dragend', e => {
      const newPos = e.target.getLatLng();
      BIN_LOCATIONS[key] = { lat: newPos.lat, lng: newPos.lng };
      console.log(key, "dragged =>", newPos);
    });
    
    // Add popup content if bin data exists
    if (binData) {
      updateMarkerPopup(marker, binData);
    }
    
    // Add marker to layer and dictionary
    marker.addTo(markersLayer);
    markersDict[key] = marker;
  });
  
  // Add bin selection functionality if not in dev mode
  if (!devModeEnabled) {
    addBinSelectionToMarkers();
  }
}

/**
 * Update marker icons and popups based on current data
 */
function updateMarkers() {
  filteredBins.forEach(bin => {
    const fill = bin.fillPercent || 0;
    const status = getFillStatus(fill);
    const key = createBinKey(bin.ward, bin.binId);
    const marker = markersDict[key];
    
    if (marker) {
      // Update marker icon
      marker.setIcon(getMarkerIcon(status));
      
      // Update popup content
      if (!marker.isPopupOpen()) {
        updateMarkerPopup(marker, bin);
      }
    }
  });
}

/**
 * Update a marker's popup with bin data
 * @param {L.Marker} marker - The Leaflet marker
 * @param {Object} bin - The bin data
 */
function updateMarkerPopup(marker, bin) {
  const fill = bin.fillPercent || 0;
  const status = getFillStatus(fill);
  const statusClass = status.toLowerCase();
  
  const popupContent = `
    <div style="min-width: 200px;">
      <h3 style="margin-bottom: 10px; border-bottom: 1px solid #444; padding-bottom: 5px;">
        ${bin.ward} - ${bin.binId}
      </h3>
      <p><strong>Fill Level:</strong> ${bin.fillLevel.toFixed(1)} cm</p>
      <p><strong>Fill Percentage:</strong> ${fill.toFixed(1)}%</p>
      <p><strong>Volume:</strong> ${bin.fillVolume.toFixed(1)} L</p>
      <p><strong>Status:</strong> <span class="status-badge ${statusClass}">${status}</span></p>
      <p><strong>Last Update:</strong> ${bin.timestamp}</p>
    </div>
  `;
  
  marker.bindPopup(popupContent, {
    className: 'custom-popup',
    maxWidth: 300
  });
}

/**
 * Save current bin locations to console
 */
function saveLocations() {
  console.log("BIN_LOCATIONS =", JSON.stringify(BIN_LOCATIONS, null, 2));
  showNotification("Locations saved to console");
}

/**
 * Add bin selection functionality to markers
 * This connects the map markers to the vehicle assignment module
 */
function addBinSelectionToMarkers() {
  // For each marker, add a click handler to show collection options
  Object.keys(markersDict).forEach(binKey => {
    const marker = markersDict[binKey];
    
    // Add event handler to existing popup
    marker.on('popupopen', function(e) {
      // Check if vehicle panel is active
      const vehiclePanel = document.getElementById('vehicle-panel');
      if (!vehiclePanel || !vehiclePanel.classList.contains('active')) {
        return;
      }
      
      // Get popup content element
      const popupContent = e.popup.getContent();
      
      // Parse the content to get the DOM element
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = popupContent;
      
      // Check if the collect button already exists
      if (tempDiv.querySelector('.collect-btn')) {
        return;
      }
      
      // Add collection button to popup
      const collectBtn = document.createElement('button');
      collectBtn.className = 'collect-btn';
      collectBtn.style.cssText = `
        background: var(--accent-color);
        color: white;
        border: none;
        padding: 8px 12px;
        border-radius: 4px;
        margin-top: 10px;
        cursor: pointer;
        display: block;
        width: 100%;
      `;
      collectBtn.innerHTML = `🚛 Add to Collection Route`;
      
      // Add button to popup
      tempDiv.querySelector('div').appendChild(collectBtn);
      
      // Update popup content
      e.popup.setContent(tempDiv.innerHTML);
      
      // Add click handler to new button (after popup is updated)
      setTimeout(() => {
        const btn = document.querySelector('.leaflet-popup-content .collect-btn');
        if (btn) {
          btn.addEventListener('click', function() {
            // Find the bin checkbox in the assignment list and check it
            const { ward, binId } = parseBinKey(binKey);
            const bins = document.querySelectorAll('#assignment-bin-list tr');
            
            let found = false;
            bins.forEach(row => {
              if (row.dataset.binKey === binKey) {
                const checkbox = row.querySelector('input[type="checkbox"]');
                if (checkbox && !checkbox.checked) {
                  checkbox.checked = true;
                  updateSelectionStats();
                  showNotification(`Added ${ward} - ${binId} to collection route`, 'info');
                  found = true;
                }
              }
            });
            
            // If bin wasn't found in the current filtered list
            if (!found) {
              // Make sure the appropriate filter is selected to show this bin
              const bin = window.bins.find(bin => createBinKey(bin.ward, bin.binId) === binKey);
              if (bin) {
                const fill = bin.fillPercent || 0;
                
                if (fill >= FILL_THRESHOLDS.CRITICAL) {
                  document.getElementById('critical-filter').checked = true;
                } else if (fill >= FILL_THRESHOLDS.WARNING) {
                  document.getElementById('warning-filter').checked = true;
                } else {
                  document.getElementById('all-filter').checked = true;
                }
                
                // Refresh the bin list with new filter settings
                refreshBinList();
                
                // Now try to find and check the bin again
                setTimeout(() => {
                  const bins = document.querySelectorAll('#assignment-bin-list tr');
                  bins.forEach(row => {
                    if (row.dataset.binKey === binKey) {
                      const checkbox = row.querySelector('input[type="checkbox"]');
                      if (checkbox) {
                        checkbox.checked = true;
                        updateSelectionStats();
                        showNotification(`Added ${ward} - ${binId} to collection route`, 'info');
                      }
                    }
                  });
                }, 100);
              }
            }
          });
        }
      }, 10);
    });
  });
}