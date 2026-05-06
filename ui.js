/**
 * ui.js
 * UI interactions, DOM manipulation, and display updates
 */

// UI state tracking
let userScrolling = false;
let lastScrollPosition = 0;

/**
 * Toggle the collapsible bin list
 * Modified to use height instead of max-height
 */
function toggleCollapse() {
  const content = document.getElementById('collapsibleContent');
  const icon = document.getElementById('collapseIcon');
  
  if (!collapsed) {
    content.style.height = '0';
    content.classList.remove('expanded');
    icon.textContent = '▲';
  } else {
    content.classList.add('expanded');
    content.style.height = '250px';
    icon.textContent = '▼';
  }
  
  collapsed = !collapsed;
}

/**
 * Toggle the developer panel
 */
function toggleDevPanel() {
  const panel = document.getElementById('devPanel');
  panel.style.display = (panel.style.display === 'block') ? 'none' : 'block';
  devModeEnabled = (panel.style.display === 'block');
  
  if (!devModeEnabled) {
    // exit dev => resume data fetching
    if (!refreshIntervalId) {
      startDataFetching();
    }
    createMarkers(false);
  } else {
    // enter dev => stop poll
    if (refreshIntervalId) {
      clearInterval(refreshIntervalId);
      refreshIntervalId = null;
    }
    createMarkers(document.getElementById('enableDrag').checked);
  }
}

/**
 * Show a notification message
 * @param {string} message - The message to display
 * @param {string} type - The type of notification ('info' or 'error')
 */
function showNotification(message, type = 'info') {
  // Get notification element
  const notification = document.getElementById('notification');
  
  // Set style based on type
  if (type === 'error') {
    notification.style.backgroundColor = 'var(--critical)';
  } else {
    notification.style.backgroundColor = 'var(--normal)';
  }
  
  notification.style.color = 'white';
  notification.textContent = message;
  notification.style.opacity = '1';
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
  }, 3000);
}

/**
 * Initialize scrollbar fixes to prevent auto-scrolling
 * Simplified to avoid interfering with content
 */
function initScrollbarFixes() {
  const sidebar = document.querySelector('.sidebar');
  
  // Track when user is manually scrolling
  sidebar.addEventListener('mousedown', () => {
    userScrolling = true;
  });
  
  document.addEventListener('mouseup', () => {
    userScrolling = false;
  });
  
  // Disable animations during scrolling only
  sidebar.addEventListener('scroll', () => {
    sidebar.classList.add('scrolling');
    clearTimeout(sidebar.scrollTimer);
    sidebar.scrollTimer = setTimeout(() => {
      sidebar.classList.remove('scrolling');
    }, 200);
  });
  
  // Fix for collapsible content scrolling
  if (document.getElementById('collapsibleContent')) {
    const collapsibleContent = document.getElementById('collapsibleContent');
    collapsibleContent.addEventListener('scroll', (e) => {
      e.stopPropagation();
    });
  }
}

/**
 * Initialize event listeners for UI elements
 */
function initEventListeners() {
  // Filter change handlers
  document.getElementById('fill-select').addEventListener('change', applyFilters);
  document.getElementById('search').addEventListener('input', () => {
    showSearchSuggestions();
    applyFilters();
  });
  
  // Sync button - manually refresh data
  document.getElementById('sync-btn').addEventListener('click', () => {
    fetchSensorData();
    showNotification("Data refreshed manually");
  });
  
  // Dev mode toggle
  document.getElementById('dev-toggle').addEventListener('click', toggleDevPanel);
  
  // Enable drag checkbox
  document.getElementById('enableDrag').addEventListener('change', (e) => {
    if (devModeEnabled) {
      createMarkers(e.target.checked);
    }
  });
  
  // Save locations button
  document.getElementById('save-locations-btn').addEventListener('click', saveLocations);
  
  // Close search suggestions when clicking elsewhere
  document.addEventListener('click', e => {
    const searchWrapper = document.querySelector('.search-wrapper');
    const sugBox = document.getElementById('search-suggestions');
    
    if (searchWrapper && sugBox && !searchWrapper.contains(e.target) && sugBox.style.display === 'block') {
      sugBox.style.display = 'none';
    }
  });
}

/**
 * Initialize custom popup styles
 */
function initCustomStyles() {
  // Add custom CSS class for map popups
  const customPopupStyle = document.createElement('style');
  customPopupStyle.innerHTML = `
    .custom-popup .leaflet-popup-content-wrapper {
      background-color: var(--sidebar-bg);
      color: var(--text-light);
      border-radius: 8px;
    }
    .custom-popup .leaflet-popup-tip {
      background-color: var(--sidebar-bg);
    }
    .custom-popup .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.75rem;
      color: white;
    }
    .custom-popup .status-badge.critical {
      background-color: var(--critical);
    }
    .custom-popup .status-badge.warning {
      background-color: var(--warning);
    }
    .custom-popup .status-badge.safe {
      background-color: var(--normal);
    }
  `;
  document.head.appendChild(customPopupStyle);
}

/**
 * Set initial UI states
 */
function setInitialUIState() {
  // Store initial scroll position
  setTimeout(() => {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      lastScrollPosition = sidebar.scrollTop;
    }
  }, 500);
  
  // Expand the bin list by default
  toggleCollapse();
}