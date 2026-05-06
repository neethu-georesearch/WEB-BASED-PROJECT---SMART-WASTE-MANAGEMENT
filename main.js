/**
 * main.js
 * Main entry point that initializes the application
 */

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, initializing application...');
  
  // Initialize custom styles
  initCustomStyles();
  console.log('Custom styles initialized');
  
  // Initialize event listeners
  initEventListeners();
  console.log('Event listeners initialized');
  
  // Initialize the donut chart
  initDonutChart();
  console.log('Donut chart initialized');
  
  // Initialize the map
  initMap();
  console.log('Map initialized');
  
  // Initialize history view
  initHistoryView();
  console.log('History view initialized');
  
  // Initialize vehicle assignment module
  initVehicleAssignment();
  console.log('Vehicle assignment module initialized');
  
  // Set initial UI state
  setInitialUIState();
  console.log('Initial UI state set');
  
  // Initialize bin history storage
  window.binHistory = {};
  console.log('Bin history storage initialized');
  
  // Start real-time data fetching
  startDataFetching();
  console.log('Started real-time data fetching');
  
  // Log initialization complete
  console.log('Smart Waste Management Dashboard initialized');
});