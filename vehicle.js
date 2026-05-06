/**
 * vehicle.js
 * Core functionality for vehicle assignment and route planning in waste collection
 */

// Vehicle depot/starting location
const VEHICLE_DEPOT = {
  lat: 8.5240,
  lng: 76.9320,
  name: "Waste Management Depot"
};

// Vehicle types and capacities
const VEHICLES = {
  "truck1": { name: "Truck 1", type: "Medium", capacity: 5, speed: 35, icon: "🚚" },
  "truck2": { name: "Truck 2", type: "Large", capacity: 8, speed: 30, icon: "🚛" },
  "truck3": { name: "Truck 3", type: "Small", capacity: 3, speed: 40, icon: "🚗" },
  "truck4": { name: "Truck 4", type: "Electric", capacity: 4, speed: 35, icon: "🔋" }
};

// Store for active routes and assignments
let activeRoutes = [];
let selectedBins = [];
let routePolyline = null;
let depotMarker = null;
let assignedVehicles = [];

/**
 * Initialize the vehicle assignment functionality
 * This will be called from main.js
 */
function initVehicleAssignment() {
  // Add depot marker to the map
  addDepotMarker();
  
  // Initialize UI elements
  initVehicleUI();
  
  console.log("Vehicle assignment module initialized");
}

/**
 * Add the vehicle depot marker to the map
 */
function addDepotMarker() {
  // Create a custom depot icon
  const depotIcon = L.divIcon({
    className: 'depot-marker',
    html: `<div class="depot-marker-icon"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
  
  // Add marker to map
  depotMarker = L.marker([VEHICLE_DEPOT.lat, VEHICLE_DEPOT.lng], {
    icon: depotIcon,
    zIndexOffset: 1000
  }).addTo(map);
  
  // Add tooltip
  depotMarker.bindTooltip("Vehicle Depot - Starting Point", {
    permanent: false,
    direction: 'top',
    offset: [0, -10]
  });
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in km
  
  return distance;
}

/**
 * Calculate an optimized route using nearest neighbor algorithm
 * @param {Array} bins - Array of bin objects with coordinates
 * @returns {Array} - Bins in optimized order
 */
function calculateOptimizedRoute(bins) {
  if (bins.length <= 1) return bins;
  
  const optimizedRoute = [];
  const unvisited = [...bins];
  
  // Start from depot
  let currentPoint = {
    lat: VEHICLE_DEPOT.lat,
    lng: VEHICLE_DEPOT.lng
  };
  
  // Greedy algorithm - nearest neighbor
  while (unvisited.length > 0) {
    // Find nearest unvisited bin
    let nearestIndex = 0;
    let minDistance = Infinity;
    
    for (let i = 0; i < unvisited.length; i++) {
      const dist = calculateHaversineDistance(
        currentPoint.lat, currentPoint.lng,
        unvisited[i].lat, unvisited[i].lng
      );
      
      if (dist < minDistance) {
        minDistance = dist;
        nearestIndex = i;
      }
    }
    
    // Add the nearest bin to the route
    const nearest = unvisited[nearestIndex];
    optimizedRoute.push(nearest);
    
    // Update current point and remove from unvisited
    currentPoint = {
      lat: nearest.lat,
      lng: nearest.lng
    };
    unvisited.splice(nearestIndex, 1);
  }
  
  return optimizedRoute;
}

/**
 * Enhanced route optimization using a weighted approach
 * Considers both distance and bin fill levels
 * @param {Array} bins - Array of bin objects
 * @returns {Array} - Optimized bin sequence
 */
function calculateWeightedRoute(bins) {
  if (bins.length <= 1) return bins;
  
  const optimizedRoute = [];
  const unvisited = [...bins];
  
  // Start from depot
  let currentPoint = {
    lat: VEHICLE_DEPOT.lat,
    lng: VEHICLE_DEPOT.lng
  };
  
  // Weighted algorithm that considers both distance and fill level
  while (unvisited.length > 0) {
    // Find best next bin using weighted scoring
    let bestIndex = 0;
    let bestScore = -Infinity;
    
    for (let i = 0; i < unvisited.length; i++) {
      const bin = unvisited[i];
      
      // Calculate distance (lower is better)
      const distance = calculateHaversineDistance(
        currentPoint.lat, currentPoint.lng,
        bin.lat, bin.lng
      );
      
      // Normalize distance score (1 = close, 0 = far)
      // Using 5km as a reasonable maximum distance
      const distanceScore = Math.max(0, 1 - (distance / 5));
      
      // Fill level score (higher is better)
      const fillScore = bin.fillPercent / 100;
      
      // Calculate weighted score (distance + fill level)
      // We prioritize critical bins slightly more than distance
      const score = (distanceScore * 0.4) + (fillScore * 0.6);
      
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    
    // Add the best bin to the route
    const bestBin = unvisited[bestIndex];
    optimizedRoute.push(bestBin);
    
    // Update current point and remove from unvisited
    currentPoint = {
      lat: bestBin.lat,
      lng: bestBin.lng
    };
    unvisited.splice(bestIndex, 1);
  }
  
  return optimizedRoute;
}

/**
 * Calculate estimated collection volume based on bin fill levels
 * @param {Array} bins - Selected bins for collection
 * @returns {number} - Total estimated volume in liters
 */
function calculateTotalCollectionVolume(bins) {
  return bins.reduce((total, bin) => {
    return total + (bin.fillVolume || 0);
  }, 0);
}

/**
 * Check if selected bins can fit in the vehicle
 * @param {string} vehicleId - Selected vehicle ID
 * @param {Array} bins - Selected bins for collection
 * @returns {boolean} - Whether the vehicle has sufficient capacity
 */
function checkVehicleCapacity(vehicleId, bins) {
  const vehicle = VEHICLES[vehicleId];
  const totalVolume = calculateTotalCollectionVolume(bins);
  
  // Convert vehicle capacity from tons to liters (approximate conversion)
  // Assuming 1 ton = 1000 liters for simplicity
  const vehicleCapacityLiters = vehicle.capacity * 1000;
  
  return totalVolume <= vehicleCapacityLiters;
}




/**
 * Draw route on the map with animated line
 * @param {Array} routePoints - Array of coordinate objects (lat, lng)
 */
function drawRouteOnMap(routePoints) {
  // Remove existing route if present
  if (routePolyline) {
    map.removeLayer(routePolyline);
  }
  
  // Extract coordinates from route points
  const latlngs = routePoints.map(point => [point.lat, point.lng]);
  
  // Create polyline with dashed animation style
  routePolyline = L.polyline(latlngs, {
    color: getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim(),
    weight: 4,
    opacity: 0.7,
    lineCap: 'round',
    lineJoin: 'round',
    dashArray: '10, 7',
    className: 'collection-route'
  }).addTo(map);
  
  // Fit map to show the entire route
  map.fitBounds(routePolyline.getBounds(), {
    padding: [50, 50]
  });
}

/**
 * Create directional arrow markers along the route
 * @param {Array} routePoints - Array of route coordinates
 * @returns {Array} - Array of arrow markers
 */
function createRouteArrows(routePoints) {
  const arrowMarkers = [];
  
  // Create arrows between each point
  for (let i = 0; i < routePoints.length - 1; i++) {
    const p1 = routePoints[i];
    const p2 = routePoints[i + 1];
    
    // Only add arrows to certain segments to avoid clutter
    if (i % 2 === 0) {
      // Calculate middle point for arrow placement
      const midLat = (p1.lat + p2.lat) / 2;
      const midLng = (p1.lng + p2.lng) / 2;
      
      // Calculate angle for arrow rotation
      const angle = Math.atan2(p2.lng - p1.lng, p2.lat - p1.lat) * 180 / Math.PI;
      
      // Create arrow marker
      const arrowIcon = L.divIcon({
        className: 'route-arrow',
        html: `<div style="transform: rotate(${angle}deg)">→</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      
      const marker = L.marker([midLat, midLng], {
        icon: arrowIcon,
        zIndexOffset: 800
      }).addTo(map);
      
      arrowMarkers.push(marker);
    }
  }
  
  return arrowMarkers;
}

/**
 * Create a vehicle marker for an active assignment
 * @param {Object} vehicle - Vehicle object
 * @param {Array} routePoints - Array of route coordinates
 * @returns {L.Marker} - Marker object
 */
function createVehicleMarker(vehicle, routePoints) {
  // Start vehicle at depot
  const startPoint = routePoints[0];
  
  // Create custom vehicle icon
  const vehicleIcon = L.divIcon({
    className: 'vehicle-marker',
    html: `
      <div class="vehicle-icon-container">
        ${vehicle.icon}
        <div class="vehicle-info">${vehicle.name}</div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
  
  // Create marker
  const marker = L.marker([startPoint.lat, startPoint.lng], {
    icon: vehicleIcon,
    zIndexOffset: 900
  }).addTo(map);
  
  // Add popup with vehicle info
  const popupContent = `
    <div style="min-width: 180px;">
      <h3 style="margin-bottom: 10px; border-bottom: 1px solid #444; padding-bottom: 5px;">
        ${vehicle.name} (${vehicle.type})
      </h3>
      <p><strong>Capacity:</strong> ${vehicle.capacity} tons</p>
      <p><strong>Avg. Speed:</strong> ${vehicle.speed} km/h</p>
      <p><strong>Status:</strong> <span class="status-badge safe">Active</span></p>
      <p><strong>Assigned:</strong> ${new Date().toLocaleTimeString()}</p>
    </div>
  `;
  
  marker.bindPopup(popupContent, {
    className: 'custom-popup',
    maxWidth: 300
  });
  
  return marker;
}

/**
 * Get estimated arrival time at each bin
 * @param {Object} vehicle - Vehicle data
 * @param {Array} routePoints - Route points array
 * @returns {Array} - Route points with estimated arrival times
 */
function calculateArrivalTimes(vehicle, routePoints) {
  const result = [];
  let currentTime = new Date();
  let cumulativeDistance = 0;
  
  result.push({
    ...routePoints[0],
    arrivalTime: new Date(currentTime), 
    distance: 0
  });
  
  for (let i = 1; i < routePoints.length; i++) {
    const prevPoint = routePoints[i-1];
    const currentPoint = routePoints[i];
    
    // Calculate distance between points
    const segmentDistance = calculateHaversineDistance(
      prevPoint.lat, prevPoint.lng,
      currentPoint.lat, currentPoint.lng
    );
    
    cumulativeDistance += segmentDistance;
    
    // Calculate time to travel this segment (in minutes)
    const segmentTime = (segmentDistance / vehicle.speed) * 60;
    
    // Add service time for each bin (except depot)
    let serviceTime = 0;
    if (i !== routePoints.length - 1) { // Not the return to depot
      serviceTime = 2; // 2 minutes per bin
    }
    
    // Update current time
    currentTime = new Date(currentTime.getTime() + (segmentTime + serviceTime) * 60000);
    
    result.push({
      ...currentPoint,
      arrivalTime: new Date(currentTime),
      distance: cumulativeDistance
    });
  }
  
  return result;
}

/**
 * Format time string (HH:MM) from date
 * @param {Date} date - Date object
 * @returns {string} - Formatted time
 */
function formatTimeString(date) {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Add a message to the activity log
 * @param {string} message - Message text
 * @param {string} type - Message type (info, warning, success)
 */
function addVehicleActivityLog(message, type = 'info') {
  const activityLog = document.getElementById('activity-log');
  if (!activityLog) return;
  
  const now = new Date();
  const timeString = formatTimeString(now);
  
  const logItem = document.createElement('div');
  logItem.className = `log-message ${type}`;
  
  logItem.innerHTML = `
    <span class="log-time">${timeString}</span>
    <span class="log-text">${message}</span>
  `;
  
  activityLog.appendChild(logItem);
  activityLog.scrollTop = activityLog.scrollHeight;
}

/**
 * Create a detailed assignment report
 * @param {Object} assignment - The vehicle assignment data
 * @returns {string} - HTML content for the report
 */
function createAssignmentReport(assignment) {
  const {
    vehicle, 
    bins, 
    distance: totalDistance, 
    totalTime, 
    assignedAt, 
    estimatedCompletion
  } = assignment;
  
  const assignTimeStr = formatTimeString(assignedAt);
  const completeTimeStr = formatTimeString(estimatedCompletion);
  
  // Calculate total waste volume
  const totalVolume = bins.reduce((sum, bin) => sum + (bin.fillVolume || 0), 0);
  
  // Create bin list HTML
  let binListHtml = '';
  bins.forEach((bin, index) => {
    const arrivalTime = assignment.route[index + 1]?.arrivalTime || new Date();
    binListHtml += `
      <tr>
        <td>${index + 1}</td>
        <td>${bin.ward} - ${bin.binId}</td>
        <td>${bin.fillPercent.toFixed(1)}%</td>
        <td>${formatTimeString(arrivalTime)}</td>
      </tr>
    `;
  });
  
  return `
    <div class="assignment-report">
      <h2>${vehicle.name} Collection Assignment</h2>
      
      <div class="report-section">
        <h3>Route Summary</h3>
        <table class="report-table">
          <tr>
            <td><strong>Vehicle:</strong></td>
            <td>${vehicle.name} (${vehicle.type})</td>
          </tr>
          <tr>
            <td><strong>Capacity:</strong></td>
            <td>${vehicle.capacity} tons</td>
          </tr>
          <tr>
            <td><strong>Total Bins:</strong></td>
            <td>${bins.length} locations</td>
          </tr>
          <tr>
            <td><strong>Total Distance:</strong></td>
            <td>${totalDistance.toFixed(1)} km</td>
          </tr>
          <tr>
            <td><strong>Estimated Duration:</strong></td>
            <td>${totalTime} minutes</td>
          </tr>
          <tr>
            <td><strong>Assigned At:</strong></td>
            <td>${assignTimeStr}</td>
          </tr>
          <tr>
            <td><strong>Est. Completion:</strong></td>
            <td>${completeTimeStr}</td>
          </tr>
          <tr>
            <td><strong>Total Waste Volume:</strong></td>
            <td>${totalVolume.toFixed(1)} liters</td>
          </tr>
        </table>
      </div>
      
      <div class="report-section">
        <h3>Collection Sequence</h3>
        <table class="report-table">
          <thead>
            <tr>
              <th>Stop</th>
              <th>Location</th>
              <th>Fill Level</th>
              <th>Est. Arrival</th>
            </tr>
          </thead>
          <tbody>
            ${binListHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;
}





/**
 * Show a detailed assignment report in a modal
 * @param {Object} assignment - The vehicle assignment
 */
function showAssignmentReport(assignment) {
  // Create modal container if it doesn't exist
  let modal = document.getElementById('assignment-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'assignment-modal';
    modal.className = 'modal';
    document.body.appendChild(modal);
    
    // Add modal styles if not already in CSS
    const style = document.createElement('style');
    style.textContent = `
      .modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.7);
        z-index: 10000;
        overflow: auto;
        padding: 20px;
      }
      
      .modal-content {
        background-color: var(--sidebar-bg);
        margin: 5% auto;
        padding: 20px;
        border-radius: 8px;
        max-width: 800px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
      }
      
      .close-modal {
        float: right;
        font-size: 28px;
        font-weight: bold;
        cursor: pointer;
      }
      
      .assignment-report h2 {
        color: var(--accent-color);
        margin-bottom: 15px;
      }
      
      .report-section {
        margin-bottom: 20px;
      }
      
      .report-section h3 {
        color: var(--text-light);
        border-bottom: 1px solid var(--border-color);
        padding-bottom: 5px;
        margin-bottom: 10px;
      }
      
      .report-table {
        width: 100%;
        border-collapse: collapse;
      }
      
      .report-table th, 
      .report-table td {
        padding: 8px;
        text-align: left;
        border-bottom: 1px solid var(--border-color);
      }
      
      .report-table th {
        background-color: var(--input-bg);
      }
      
      .report-table tr:hover {
        background-color: var(--hover-bg);
      }
    `;
    document.head.appendChild(style);
  }
  
  // Create modal content
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close-modal">&times;</span>
      ${createAssignmentReport(assignment)}
    </div>
  `;
  
  // Show modal
  modal.style.display = 'block';
  
  // Close button handler
  const closeBtn = modal.querySelector('.close-modal');
  closeBtn.onclick = function() {
    modal.style.display = 'none';
  };
  
  // Close when clicking outside the modal
  window.onclick = function(event) {
    if (event.target === modal) {
      modal.style.display = 'none';
    }
  };
}

/**
 * Initialize the vehicle UI elements and event handlers
 */
function initVehicleUI() {
  // Toggle button for vehicle assignment panel
  const toggleBtn = document.getElementById('vehicle-toggle-btn');
  const closeBtn = document.getElementById('vehicle-close-btn');
  const vehiclePanel = document.getElementById('vehicle-panel');
  
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      vehiclePanel.classList.add('active');
      refreshBinList();
      addVehicleActivityLog('Vehicle assignment panel opened');
    });
  }
  
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      vehiclePanel.classList.remove('active');
    });
  }
  
  // Close vehicle panel when Escape key is pressed
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && vehiclePanel.classList.contains('active')) {
      vehiclePanel.classList.remove('active');
    }
  });
  
  // Checkbox filters for bin types
  document.getElementById('critical-filter').addEventListener('change', refreshBinList);
  document.getElementById('warning-filter').addEventListener('change', refreshBinList);
  document.getElementById('all-filter').addEventListener('change', (e) => {
    const allChecked = e.target.checked;
    document.getElementById('critical-filter').checked = allChecked;
    document.getElementById('warning-filter').checked = allChecked;
    refreshBinList();
  });
  
  // Select all bins checkbox
  document.getElementById('select-all-bins').addEventListener('change', (e) => {
    const checkboxes = document.querySelectorAll('#assignment-bin-list input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.checked = e.target.checked;
    });
    updateSelectionStats();
  });
  
  // Refresh bins button
  document.getElementById('refresh-bins-btn').addEventListener('click', refreshBinList);
  
  // Route calculation and assignment buttons
  document.getElementById('calculate-route-btn').addEventListener('click', calculateRoute);
  document.getElementById('assign-vehicle-btn').addEventListener('click', assignVehicle);
  
  // Clear log button
  document.getElementById('clear-log-btn').addEventListener('click', () => {
    document.getElementById('activity-log').innerHTML = '';
    addVehicleActivityLog('Log cleared');
  });
}

/**
 * Refresh the bin list based on current filter criteria
 */
function refreshBinList() {
  const criticalFilter = document.getElementById('critical-filter').checked;
  const warningFilter = document.getElementById('warning-filter').checked;
  const allFilter = document.getElementById('all-filter').checked;
  
  // Determine which bins to show
  let binsToShow = [];
  
  if (criticalFilter) {
    binsToShow = binsToShow.concat(bins.filter(bin => {
      const fill = bin.fillPercent || 0;
      return fill >= FILL_THRESHOLDS.CRITICAL;
    }));
  }
  
  if (warningFilter) {
    binsToShow = binsToShow.concat(bins.filter(bin => {
      const fill = bin.fillPercent || 0;
      return fill >= FILL_THRESHOLDS.WARNING && fill < FILL_THRESHOLDS.CRITICAL;
    }));
  }
  
  if (allFilter) {
    // Show all bins regardless of status
    binsToShow = bins;
  } else if (!criticalFilter && !warningFilter) {
    // If no filter is selected, show nothing
    binsToShow = [];
  }
  
  // Sort bins by fill percentage (highest first)
  binsToShow.sort((a, b) => (b.fillPercent || 0) - (a.fillPercent || 0));
  
  // Update the bin list UI
  updateBinList(binsToShow);
  addVehicleActivityLog(`Bin list refreshed - ${binsToShow.length} bins available for collection`);
}

/**
 * Update the bin list UI with the provided bins
 * @param {Array} binsToShow - The filtered list of bins to display
 */
function updateBinList(binsToShow) {
  const binListElement = document.getElementById('assignment-bin-list');
  binListElement.innerHTML = '';
  
  binsToShow.forEach(bin => {
    const fill = bin.fillPercent || 0;
    const status = getFillStatus(fill);
    const statusClass = status.toLowerCase() + '-row';
    const binKey = createBinKey(bin.ward, bin.binId);
    
    const row = document.createElement('tr');
    row.className = statusClass;
    row.dataset.binKey = binKey;
    
    row.innerHTML = `
      <td><input type="checkbox" class="bin-checkbox" data-bin-key="${binKey}"></td>
      <td>${bin.ward} - ${bin.binId}</td>
      <td>${fill.toFixed(1)}%</td>
      <td><span class="status-badge ${status.toLowerCase()}">${status}</span></td>
    `;
    
    binListElement.appendChild(row);
  });
  
  // Add change listeners to the new checkboxes
  document.querySelectorAll('.bin-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', updateSelectionStats);
  });
}

/**
 * Update the selection statistics based on checked bins
 */
function updateSelectionStats() {
  const checkedBins = document.querySelectorAll('.bin-checkbox:checked');
  const count = checkedBins.length;
  
  // Clear the previously selected bins
  selectedBins = [];
  
  // Calculate total load
  let totalLoad = 0;
  checkedBins.forEach(checkbox => {
    const binKey = checkbox.dataset.binKey;
    const { ward, binId } = parseBinKey(binKey);
    
    // Find this bin in the bins array
    const bin = bins.find(b => b.ward === ward && b.binId === binId);
    if (bin) {
      totalLoad += bin.fillPercent || 0;
      selectedBins.push({
        key: binKey,
        ward: ward,
        binId: binId,
        fillPercent: bin.fillPercent || 0,
        fillVolume: bin.fillVolume || 0,
        lat: BIN_LOCATIONS[binKey].lat,
        lng: BIN_LOCATIONS[binKey].lng
      });
    }
  });
  
  // Average fill per bin (as a percentage of vehicle capacity)
  const avgLoad = count > 0 ? (totalLoad / count).toFixed(1) : 0;
  
  // Update UI
  document.getElementById('selected-bin-count').textContent = count;
  document.getElementById('total-load').textContent = `${avgLoad}% per bin`;
  
  // Clear route calculations when selection changes
  document.getElementById('route-distance').textContent = '0 km';
  document.getElementById('completion-time').textContent = '0 min';
  
  // Clear any existing route from the map
  if (routePolyline) {
    map.removeLayer(routePolyline);
    routePolyline = null;
  }
}



/**
 * Enhanced calculate route function with detailed route planning
 */
function calculateRoute() {
  if (selectedBins.length === 0) {
    addVehicleActivityLog('No bins selected for route calculation', 'warning');
    showNotification('Please select at least one bin for collection', 'error');
    return;
  }
  
  // Get selected vehicle
  const vehicleId = document.getElementById('vehicle-selector').value;
  const vehicle = VEHICLES[vehicleId];
  
  // Check if vehicle capacity is sufficient
  if (!checkVehicleCapacity(vehicleId, selectedBins)) {
    addVehicleActivityLog(`Warning: Selected bins may exceed ${vehicle.name}'s capacity`, 'warning');
    showNotification('Vehicle capacity may be exceeded', 'warning');
  }
  
  // Get the selected assignment method
  const assignmentMethod = document.querySelector('input[name="assignMethod"]:checked').value;
  
  // Arrange bins in the appropriate order based on assignment method
  let routePoints = [];
  
  // Always start from the depot
  routePoints.push({
    lat: VEHICLE_DEPOT.lat,
    lng: VEHICLE_DEPOT.lng,
    name: "Depot"
  });
  
  // Make a copy of selected bins for ordering
  let orderedBins = [...selectedBins];
  
  switch(assignmentMethod) {
    case 'critical':
      // Sort by fill percentage (descending)
      orderedBins.sort((a, b) => b.fillPercent - a.fillPercent);
      addVehicleActivityLog('Route optimized for critical bins first');
      break;
    case 'proximity':
      // Sort by proximity to depot (nearest first)
      orderedBins.sort((a, b) => {
        const distA = calculateHaversineDistance(
          VEHICLE_DEPOT.lat, VEHICLE_DEPOT.lng,
          a.lat, a.lng
        );
        const distB = calculateHaversineDistance(
          VEHICLE_DEPOT.lat, VEHICLE_DEPOT.lng,
          b.lat, b.lng
        );
        return distA - distB;
      });
      addVehicleActivityLog('Route optimized for proximity to depot');
      break;
    case 'optimized':
      // Use enhanced weighted optimization that considers both distance and fill level
      orderedBins = calculateWeightedRoute(orderedBins);
      addVehicleActivityLog('Route optimized for efficiency (distance + fill level)');
      break;
  }
  
  // Add selected bins to route points
  orderedBins.forEach(bin => {
    routePoints.push({
      lat: bin.lat,
      lng: bin.lng,
      name: `${bin.ward} - ${bin.binId}`,
      fillPercent: bin.fillPercent
    });
  });
  
  // Return to depot
  routePoints.push({
    lat: VEHICLE_DEPOT.lat,
    lng: VEHICLE_DEPOT.lng,
    name: "Return to Depot"
  });
  
  // Calculate arrival times
  const routeWithTimes = calculateArrivalTimes(vehicle, routePoints);
  
  // Calculate total distance (last point contains cumulative distance)
  const totalDistance = routeWithTimes[routeWithTimes.length - 1].distance;
  
  // Calculate time based on distance and vehicle speed
  const timeInMinutes = Math.ceil((totalDistance / vehicle.speed) * 60);
  
  // Include service time (2 minutes per bin)
  const serviceTime = selectedBins.length * 2;
  const totalTime = timeInMinutes + serviceTime;
  
  // Calculate the estimated completion time
  const startTime = new Date();
  const estimatedCompletion = new Date(startTime.getTime() + totalTime * 60000);
  
  // Update UI with calculated values
  document.getElementById('route-distance').textContent = `${totalDistance.toFixed(1)} km`;
  document.getElementById('completion-time').textContent = `${totalTime} min`;
  
  // Draw the route on the map
  drawRouteOnMap(routePoints);
  
  // Store the calculated route info for later use
  window.currentRouteInfo = {
    vehicleId: vehicleId,
    vehicle: vehicle,
    routePoints: routeWithTimes,
    totalDistance: totalDistance,
    totalTime: totalTime,
    bins: orderedBins,
    estimatedCompletion: estimatedCompletion
  };
  
  // Add detailed completion time to log
  const completionTimeStr = formatTimeString(estimatedCompletion);
  addVehicleActivityLog(`Route calculated: ${totalDistance.toFixed(1)} km, estimated completion at ${completionTimeStr}`);
  
  // Show popup with first bin details
  if (orderedBins.length > 0) {
    const firstBin = orderedBins[0];
    const firstBinTime = routeWithTimes[1].arrivalTime;
    const arrivalTimeStr = formatTimeString(firstBinTime);
    
    const popupContent = `
      <div style="min-width: 200px;">
        <h3 style="margin-bottom: 10px; border-bottom: 1px solid #444; padding-bottom: 5px;">
          First Collection
        </h3>
        <p><strong>Location:</strong> ${firstBin.ward} - ${firstBin.binId}</p>
        <p><strong>Fill Level:</strong> ${firstBin.fillPercent.toFixed(1)}%</p>
        <p><strong>Est. Arrival:</strong> ${arrivalTimeStr}</p>
        <p><strong>Distance:</strong> ${routeWithTimes[1].distance.toFixed(2)} km</p>
      </div>
    `;
    
    // Find marker for this bin
    const binKey = createBinKey(firstBin.ward, firstBin.binId);
    const marker = markersDict[binKey];
    
    if (marker) {
      marker.bindPopup(popupContent, {
        className: 'custom-popup',
        maxWidth: 300
      }).openPopup();
    }
  }
  
  showNotification('Route calculated successfully');
}

/**
 * Assign a vehicle to the calculated route with detailed reporting and visualization
 */
function assignVehicle() {
  if (selectedBins.length === 0) {
    addVehicleActivityLog('No bins selected for assignment', 'warning');
    showNotification('Please select bins for collection', 'error');
    return;
  }
  
  if (!window.currentRouteInfo) {
    addVehicleActivityLog('Please calculate route before assigning vehicle', 'warning');
    showNotification('Please calculate route first', 'error');
    return;
  }
  
  const routeInfo = window.currentRouteInfo;
  const { vehicle, routePoints, totalDistance, totalTime, bins } = routeInfo;
  
  // Create a vehicle marker
  const vehicleMarker = createVehicleMarker(vehicle, routePoints);
  
  // Get current time for assignment
  const assignmentTime = new Date();
  
  // Create assignment record
  const assignment = {
    id: 'assignment-' + Date.now(),
    vehicle: vehicle,
    vehicleId: routeInfo.vehicleId,
    bins: bins,
    route: routePoints,
    marker: vehicleMarker,
    assignedAt: assignmentTime,
    distance: totalDistance,
    totalTime: totalTime,
    estimatedCompletion: routeInfo.estimatedCompletion,
    status: 'active'
  };
  
  // Add to active assignments
  assignedVehicles.push(assignment);
  
  // Create route arrows for better visualization
  const routeArrows = createRouteArrows(routePoints);
  assignment.routeArrows = routeArrows;
  
  // Log activity
  addVehicleActivityLog(`${vehicle.name} assigned to collect ${bins.length} bins`, 'success');
  addVehicleActivityLog(`Starting collection route: ${formatTimeString(assignmentTime)}`);
  addVehicleActivityLog(`Estimated completion: ${formatTimeString(assignment.estimatedCompletion)}`);
  
  // Show assignment report
  showAssignmentReport(assignment);
  
  // Show notification
  showNotification(`${vehicle.name} assigned to collection route`, 'info');
  
  // Simulate vehicle movement and updates
  simulateVehicleUpdates(assignment);
  
  // Reset selected bins to prevent duplicate assignments
  selectedBins = [];
  document.querySelectorAll('.bin-checkbox').forEach(checkbox => {
    checkbox.checked = false;
  });
  updateSelectionStats();
  
  // Clear current route info
  window.currentRouteInfo = null;
}

/**
 * Enhanced simulation with more detailed updates and visualization
 * @param {Object} assignment - The vehicle assignment
 */
function simulateVehicleUpdates(assignment) {
  // First status update after 15 seconds
  setTimeout(() => {
    addVehicleActivityLog(`${assignment.vehicle.name} started collection route`);
    
    // Send a simulated driver message
    setTimeout(() => {
      addVehicleActivityLog(`Message from ${assignment.vehicle.name}: Route received, proceeding to first location`);
    }, 15000);
    
    // Update vehicle location to first bin after 30 seconds
    if (assignment.bins.length > 0) {
      const firstBin = assignment.bins[0];
      setTimeout(() => {
        // Update marker position
        assignment.marker.setLatLng([firstBin.lat, firstBin.lng]);
        addVehicleActivityLog(`${assignment.vehicle.name} arrived at ${firstBin.ward} - ${firstBin.binId}`);
      }, 30000);
      
      // Collection completion message
      setTimeout(() => {
        addVehicleActivityLog(`${firstBin.ward} - ${firstBin.binId} collected (${firstBin.fillPercent.toFixed(1)}%)`);
        
        // Update bin marker to show it's collected
        const binKey = createBinKey(firstBin.ward, firstBin.binId);
        const marker = markersDict[binKey];
        if (marker) {
          // Create a collected icon to replace the original
          const collectedIcon = L.divIcon({
            className: 'collected-bin-marker',
            html: `<div style="background-color:#3498db; color:white; padding:3px; border-radius:50%; border:2px solid white; font-size:10px;">✓</div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          });
          
          marker.setIcon(collectedIcon);
        }
      }, 45000);
    }
    
    // Progress update halfway through
    if (assignment.bins.length > 1) {
      const midBin = assignment.bins[Math.floor(assignment.bins.length / 2)];
      const midTime = Math.floor(assignment.totalTime * 0.4 * 1000);
      const midIndex = Math.floor(assignment.bins.length / 2);
      
      setTimeout(() => {
        // Update marker position to mid-point bin
        assignment.marker.setLatLng([midBin.lat, midBin.lng]);
        addVehicleActivityLog(`${assignment.vehicle.name} completed ${midIndex} out of ${assignment.bins.length} collections`);
        
        // Update bin markers to show they're collected
        for (let i = 0; i < midIndex; i++) {
          const bin = assignment.bins[i];
          const binKey = createBinKey(bin.ward, bin.binId);
          const marker = markersDict[binKey];
          
          if (marker && i > 0) { // Skip first bin as it's already marked
            const collectedIcon = L.divIcon({
              className: 'collected-bin-marker',
              html: `<div style="background-color:#3498db; color:white; padding:3px; border-radius:50%; border:2px solid white; font-size:10px;">✓</div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            });
            
            marker.setIcon(collectedIcon);
          }
        }
      }, midTime);
    }
    
    // Completion message
    const completionTime = Math.min(assignment.totalTime * 1000, 180000); // Cap at 3 minutes for demo
    
    setTimeout(() => {
      // Move vehicle back to depot
      assignment.marker.setLatLng([VEHICLE_DEPOT.lat, VEHICLE_DEPOT.lng]);
      
      addVehicleActivityLog(`${assignment.vehicle.name} has completed the assigned route and returned to depot`, 'success');
      addVehicleActivityLog(`All ${assignment.bins.length} bins collected successfully`);
      
      // Remove the route line and arrows but keep the vehicle marker
      if (routePolyline) {
        map.removeLayer(routePolyline);
        routePolyline = null;
      }
      
      // Clear route arrows
      if (assignment.routeArrows) {
        assignment.routeArrows.forEach(arrow => map.removeLayer(arrow));
      }
      
      // Mark all bins as collected
      assignment.bins.forEach(bin => {
        const binKey = createBinKey(bin.ward, bin.binId);
        const marker = markersDict[binKey];
        
        if (marker) {
          const collectedIcon = L.divIcon({
            className: 'collected-bin-marker',
            html: `<div style="background-color:#3498db; color:white; padding:3px; border-radius:50%; border:2px solid white; font-size:10px;">✓</div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          });
          
          marker.setIcon(collectedIcon);
        }
      });
      
      // Update the vehicle marker popup to show completed status
      const newPopupContent = `
        <div style="min-width: 180px;">
          <h3 style="margin-bottom: 10px; border-bottom: 1px solid #444; padding-bottom: 5px;">
            ${assignment.vehicle.name} (${assignment.vehicle.type})
          </h3>
          <p><strong>Capacity:</strong> ${assignment.vehicle.capacity} tons</p>
          <p><strong>Status:</strong> <span class="status-badge safe">Completed</span></p>
          <p><strong>Bins Collected:</strong> ${assignment.bins.length}</p>
          <p><strong>Distance:</strong> ${assignment.distance.toFixed(1)} km</p>
          <p><strong>Completed At:</strong> ${formatTimeString(new Date())}</p>
          <p style="margin-top: 10px;">
            <button onclick="showAssignmentReport(assignedVehicles.find(a => a.id === '${assignment.id}'))" style="background: var(--accent-color); border: none; color: white; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
              View Report
            </button>
          </p>
        </div>
      `;
      
      assignment.marker.getPopup().setContent(newPopupContent);
      if (assignment.marker.getPopup().isOpen()) {
        assignment.marker.getPopup().update();
      }
      
      // Mark assignment as completed
      assignment.status = 'completed';
      
      // After 10 seconds, add a message about waste processing
      setTimeout(() => {
        addVehicleActivityLog(`Waste collection from ${assignment.id} has been processed at transfer station`);
      }, 10000);
      
    }, completionTime);
  }, 15000);
}








