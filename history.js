/**
 * history.js
 * Handles the improved history view and graph rendering for bin fill history
 */

// Chart instance for history view
let historyChart = null;
let selectedBinData = null;

/**
 * Initialize the history view functionality
 */
function initHistoryView() {
  // Toggle button for history view
  const toggleBtn = document.getElementById('history-toggle-btn');
  const closeBtn = document.getElementById('history-close-btn');
  const historyPanel = document.getElementById('history-panel');
  const binSelector = document.getElementById('bin-selector');
  
  // Show history panel when toggle button is clicked
  toggleBtn.addEventListener('click', () => {
    historyPanel.classList.add('active');
    populateBinSelector();
  });
  
  // Close history panel when close button is clicked
  closeBtn.addEventListener('click', () => {
    historyPanel.classList.remove('active');
  });
  
  // Update graph when bin selection changes
  binSelector.addEventListener('change', updateHistoryGraph);

  // Close history panel when Escape key is pressed
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && historyPanel.classList.contains('active')) {
      historyPanel.classList.remove('active');
    }
  });
}

/**
 * Populate the bin selector dropdown with all available bins
 */
function populateBinSelector() {
  const binSelector = document.getElementById('bin-selector');
  const currentSelection = binSelector.value;
  
  // Clear existing options except the first one
  while (binSelector.options.length > 1) {
    binSelector.remove(1);
  }
  
  // Get all unique bin keys and sort them
  const binKeys = Object.keys(window.binHistory || {});
  
  // Group bins by ward
  const wardGroups = {};
  binKeys.forEach(binKey => {
    const { ward, binId } = parseBinKey(binKey);
    if (!wardGroups[ward]) {
      wardGroups[ward] = [];
    }
    wardGroups[ward].push({ binKey, binId });
  });
  
  // Get sorted ward names
  const wards = Object.keys(wardGroups).sort();
  
  // Create option groups for each ward
  wards.forEach(ward => {
    const group = document.createElement('optgroup');
    group.label = ward;
    
    // Sort bins within each ward
    wardGroups[ward].sort((a, b) => a.binId.localeCompare(b.binId, undefined, { numeric: true }));
    
    // Add options for each bin in this ward
    wardGroups[ward].forEach(({ binKey, binId }) => {
      const option = document.createElement('option');
      option.value = binKey;
      option.textContent = binId;
      group.appendChild(option);
    });
    
    binSelector.appendChild(group);
  });
  
  // Restore previous selection if it exists
  if (currentSelection && binSelector.querySelector(`option[value="${currentSelection}"]`)) {
    binSelector.value = currentSelection;
    updateHistoryGraph(); // Update the graph with the current selection
  }
}

/**
 * Update the history graph based on the selected bin
 */
function updateHistoryGraph() {
  const binSelector = document.getElementById('bin-selector');
  const noBinMessage = document.getElementById('no-bin-message');
  const graphTitle = document.getElementById('history-graph-title');
  const selectedBin = binSelector.value;
  
  // Reset stats
  document.getElementById('history-max-fill').textContent = '-';
  document.getElementById('history-avg-fill').textContent = '-';
  document.getElementById('history-min-fill').textContent = '-';
  graphTitle.textContent = '';
  
  // Show message if no bin is selected
  if (!selectedBin) {
    noBinMessage.style.display = 'flex';
    
    // Destroy existing chart if it exists
    if (historyChart) {
      historyChart.destroy();
      historyChart = null;
    }
    return;
  }
  
  // Hide the message
  noBinMessage.style.display = 'none';
  
  // Get history data for the selected bin
  const historyData = window.binHistory[selectedBin] || [];
  selectedBinData = historyData;
  
  // If there's no data, show message
  if (historyData.length === 0) {
    noBinMessage.innerHTML = '<span class="icon">📊</span><p>No history data available for this bin</p>';
    noBinMessage.style.display = 'flex';
    return;
  }
  
  // Parse bin information to show in title
  const { ward, binId } = parseBinKey(selectedBin);
  graphTitle.textContent = `${ward} - ${binId}`;
  
  // Prepare data for the chart
  const labels = historyData.map(item => item.timestamp);
  const fillData = historyData.map(item => item.fillPercent);
  
  // Calculate statistics
  const maxFill = Math.max(...fillData).toFixed(1);
  const minFill = Math.min(...fillData).toFixed(1);
  const avgFill = (fillData.reduce((sum, val) => sum + val, 0) / fillData.length).toFixed(1);
  
  // Update statistics display
  document.getElementById('history-max-fill').textContent = maxFill + '%';
  document.getElementById('history-avg-fill').textContent = avgFill + '%';
  document.getElementById('history-min-fill').textContent = minFill + '%';
  
  // Get fill level status colors based on history data
  const statusColors = historyData.map(item => {
    if (item.fillPercent >= FILL_THRESHOLDS.CRITICAL) return CHART_COLORS.CRITICAL;
    if (item.fillPercent >= FILL_THRESHOLDS.WARNING) return CHART_COLORS.WARNING;
    return CHART_COLORS.NORMAL;
  });
  
  // Create or update the chart
  createOrUpdateHistoryChart(labels, fillData, statusColors);
}

/**
 * Create a new chart or update the existing one
 * @param {Array} labels - Timestamps for the x-axis
 * @param {Array} data - Fill percentage values for the y-axis
 * @param {Array} colors - Status colors for each data point
 */
function createOrUpdateHistoryChart(labels, data, colors) {
  const ctx = document.getElementById('historyChart').getContext('2d');
  
  // If chart already exists, destroy it to prevent memory leaks
  if (historyChart) {
    historyChart.destroy();
  }
  
  // Create gradient for the fill area
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(52, 152, 219, 0.8)');
  gradient.addColorStop(1, 'rgba(52, 152, 219, 0.1)');
  
  // Create a new chart
  historyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Fill %',
        data: data,
        borderColor: 'rgba(52, 152, 219, 1)',
        backgroundColor: gradient,
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: colors,
        pointBorderColor: 'white',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointHoverBorderWidth: 2,
        pointHoverBackgroundColor: colors.map(color => color + 'CF')
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: {
            display: true,
            text: 'Fill Percentage (%)',
            color: '#ecf0f1',
            font: {
              weight: 'bold'
            }
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          },
          ticks: {
            color: '#ecf0f1',
            callback: function(value) {
              return value + '%';
            }
          }
        },
        x: {
          title: {
            display: true,
            text: 'Time',
            color: '#ecf0f1',
            font: {
              weight: 'bold'
            }
          },
          grid: {
            display: false
          },
          ticks: {
            color: '#ecf0f1',
            maxRotation: 45,
            minRotation: 45,
            font: {
              size: 10
            },
            autoSkip: true,
            maxTicksLimit: 10
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(26, 37, 51, 0.9)',
          titleFont: {
            size: 14,
            weight: 'bold'
          },
          bodyFont: {
            size: 13
          },
          padding: 12,
          cornerRadius: 6,
          caretSize: 6,
          displayColors: false,
          callbacks: {
            title: function(tooltipItems) {
              return 'Time: ' + tooltipItems[0].label;
            },
            label: function(context) {
              return `Fill Level: ${context.parsed.y.toFixed(1)}%`;
            },
            afterLabel: function(context) {
              const index = context.dataIndex;
              const historyItem = selectedBinData[index];
              const statusText = historyItem.status.toUpperCase();
              const volume = historyItem.fillVolume ? 
                `Volume: ${historyItem.fillVolume.toFixed(1)} L` : '';
              
              return [
                `Status: ${statusText}`,
                volume
              ].filter(Boolean); // Remove empty items
            }
          }
        }
      },
      animation: {
        duration: 1000,
        easing: 'easeOutQuart'
      },
      interaction: {
        mode: 'index',
        intersect: false
      },
      elements: {
        line: {
          tension: 0.4
        }
      }
    }
  });
}