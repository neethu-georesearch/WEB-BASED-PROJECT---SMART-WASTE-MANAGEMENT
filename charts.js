/**
 * charts.js
 * Chart.js initialization and chart-related functions
 */

// Chart instance
let statusGaugeChart = null;

/**
 * Initialize the donut chart for status display
 */
function initDonutChart() {
  // Get context for canvas
  const ctx = document.getElementById('statusGauge').getContext('2d');
  
  // Set up Chart.js with a modern style
  Chart.defaults.color = '#ecf0f1';
  Chart.defaults.font.family = "'Segoe UI', Arial, sans-serif";
  
  // Create chart instance
  statusGaugeChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Critical', 'Warning', 'Safe'],
      datasets: [{
        data: [0, 0, 0],
        backgroundColor: [
          CHART_COLORS.CRITICAL,
          CHART_COLORS.WARNING,
          CHART_COLORS.NORMAL
        ],
        borderWidth: 0
      }]
    },
    plugins: [ChartDataLabels],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#ecf0f1',
            padding: 15,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        },
        datalabels: {
          color: '#fff',
          font: {
            weight: 'bold',
            size: 14
          },
          formatter: (val, ctx) => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            if (!total) return '0%';
            return Math.round(val / total * 100) + '%';
          }
        },
        tooltip: {
          backgroundColor: '#1a2533',
          titleFont: {
            size: 14
          },
          bodyFont: {
            size: 13
          },
          displayColors: false,
          callbacks: {
            label: function(context) {
              const value = context.raw || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = total ? Math.round((value / total) * 100) : 0;
              return `${context.label}: ${value} bins (${percentage}%)`;
            }
          }
        }
      },
      animation: {
        animateRotate: true,
        animateScale: true
      }
    }
  });
}

/**
 * Update the status chart with new data
 * @param {number} criticalCount - Number of bins in critical status
 * @param {number} warningCount - Number of bins in warning status
 * @param {number} safeCount - Number of bins in safe status
 */
function updateStatusChart(criticalCount, warningCount, safeCount) {
  if (statusGaugeChart) {
    statusGaugeChart.data.datasets[0].data = [criticalCount, warningCount, safeCount];
    statusGaugeChart.update();
  }
}

/**
 * Create a timeline chart showing fill levels over time
 * Not currently implemented in the UI
 * @param {Array} historyData - Array of historical fill data
 * @param {string} elementId - ID of the canvas element
 */
function createTimelineChart(historyData, elementId) {
  const ctx = document.getElementById(elementId).getContext('2d');
  
  // Format data for Chart.js
  const labels = historyData.map(item => item.timestamp);
  const data = historyData.map(item => item.fillPercent);
  
  // Determine color based on current fill level
  const currentFill = data[data.length - 1] || 0;
  let lineColor = CHART_COLORS.NORMAL;
  
  if (currentFill >= FILL_THRESHOLDS.CRITICAL) {
    lineColor = CHART_COLORS.CRITICAL;
  } else if (currentFill >= FILL_THRESHOLDS.WARNING) {
    lineColor = CHART_COLORS.WARNING;
  }
  
  // Create chart
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Fill %',
        data: data,
        borderColor: lineColor,
        backgroundColor: lineColor + '20', // With transparency
        borderWidth: 2,
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}

/**
 * Create a ward comparison chart
 * Not currently implemented in the UI
 * @param {Array} wardData - Array of ward data
 * @param {string} elementId - ID of the canvas element
 */
function createWardComparisonChart(wardData, elementId) {
  const ctx = document.getElementById(elementId).getContext('2d');
  
  // Format data for Chart.js
  const labels = wardData.map(item => item.ward);
  const data = wardData.map(item => item.avgFill);
  const colors = wardData.map(item => {
    if (item.avgFill >= FILL_THRESHOLDS.CRITICAL) return CHART_COLORS.CRITICAL;
    if (item.avgFill >= FILL_THRESHOLDS.WARNING) return CHART_COLORS.WARNING;
    return CHART_COLORS.NORMAL;
  });
  
  // Create chart
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Average Fill %',
        data: data,
        backgroundColor: colors,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      }
    }
  });
}