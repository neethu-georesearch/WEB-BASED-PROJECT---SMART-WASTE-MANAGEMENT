#!/usr/bin/env python3
"""
enhanced_sensor_sim.py
----------------------
An advanced PyQt6 sensor simulator with configurable update intervals,
plus a Flask server at :5000 with CORS enabled.
Features a modern dark UI with improved visualization and controls.
"""

import sys
import time
import random
import threading
import json
from datetime import datetime

from flask import Flask, jsonify, request
from flask_cors import CORS
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QPushButton, QTableWidget, QTableWidgetItem, QLabel, QFrame,
    QHeaderView, QSplitter, QTabWidget, QComboBox, QProgressBar,
    QGroupBox, QGridLayout, QSlider, QCheckBox, QSpacerItem,
    QSizePolicy, QStyleFactory, QStatusBar, QToolBar, QLineEdit,
    QDialog, QDialogButtonBox, QTextEdit, QMenu, QFileDialog
)
from PyQt6.QtCore import QTimer, Qt, QSize, QThread, pyqtSignal
from PyQt6.QtGui import QIcon, QFont, QColor, QPalette, QAction, QPixmap

# Flask app
app = Flask(__name__)
CORS(app)  # Enable cross-origin requests

# Global variables
bins_data = []
update_interval = 60  # Default 60 seconds

BINS_INFO = [
    ("Peroorkada market", "MCF"),
    ("Vazhayila", "MCF"),
    ("Vattiyoorkavu", "MCF"),
    ("Jagathy", "MCF"),
    ("Chenthitta", "MCF"),
    ("Attakulangara", "MCF"),
    ("Sanmathi", "MCF"),
    ("Manacadu near HI office", "RRF"),
    ("Manacadu Kuthukallinmoodu market", "MCF"),
    ("Kalladimukam flat", "RRF"),
    ("sreekandeswaram", "MCF"),
    ("Fort garage", "MCF"),
    ("Karamana(maruthoorkadavu bridge)", "MCF"),
    ("Thiruvallam ,poonkulam", "MCF"),
    ("Vizhinjam", "MCF"),
    ("Poonthura", "MCF"),
    ("Muttathara", "RRF"),
    ("Chakka", "MCF"),
    ("Medical college", "MCF"),
    ("Nalanchira", "MCF"),
    ("Kazhakoottam", "MCF"),
    ("Attipra", "MCF")
]

@app.route("/api/data")
def api_data():
    """
    Returns current bins_data as JSON
    """
    return jsonify(bins_data)

@app.route("/api/config")
def api_config():
    """Returns simulator configuration including update interval"""
    return jsonify({
        "updateInterval": update_interval
    })

def flask_thread():
    app.run(host="127.0.0.1", port=5000, debug=False, use_reloader=False)

class DataGenerator(QThread):
    data_updated = pyqtSignal()
    
    def __init__(self, interval=5):
        super().__init__()
        self.interval = interval
        self.stop_flag = False
        self.mode = "random"  # "random", "filling", "emptying", "stable"
        self.variance = 5.0  # Default random variance

    def set_mode(self, mode):
        self.mode = mode
        
    def set_variance(self, variance):
        self.variance = variance
        
    def set_interval(self, interval):
        self.interval = interval
        global update_interval
        update_interval = interval

    def run(self):
        global bins_data
        # Initialize data if empty
        if not bins_data:
            bins_data = []
            for (ward, binId) in BINS_INFO:
                lvl = random.uniform(20, 180)
                bins_data.append({
                    "ward": ward,
                    "binId": binId,
                    "fillLevel": round(lvl, 2),
                    "fillPercent": round(lvl/2.0, 2),
                    "fillVolume": round((lvl/450.0)*400.0, 2),
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "status": "normal"
                })
        
        # Update loop
        while not self.stop_flag:
            for b in bins_data:
                old_lvl = b["fillLevel"]
                
                # Different update modes
                if self.mode == "random":
                    delta = random.uniform(-self.variance, self.variance)
                elif self.mode == "filling":
                    delta = random.uniform(0, self.variance)
                elif self.mode == "emptying":
                    delta = random.uniform(-self.variance, 0)
                elif self.mode == "stable":
                    delta = random.uniform(-0.5, 0.5)
                
                new_lvl = max(0, min(200, old_lvl + delta))
                b["fillLevel"] = round(new_lvl, 2)
                b["fillPercent"] = round(new_lvl/2.0, 2)
                b["fillVolume"] = round((new_lvl/450.0)*400.0, 2)
                b["timestamp"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                
                # Set status based on fill level
                if new_lvl > 300:
                    b["status"] = "critical"
                elif new_lvl > 150:
                    b["status"] = "warning"
                else:
                    b["status"] = "normal"
                    
            self.data_updated.emit()
            time.sleep(self.interval)









class AboutDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("About Waste Bin Simulator")
        self.setFixedSize(450, 300)
        
        layout = QVBoxLayout()
        
        title = QLabel("Smart Waste Management Simulator")
        title.setStyleSheet("font-size: 18px; font-weight: bold; color: #2980b9;")
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        version = QLabel("Version 3.0")
        version.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        description = QTextEdit()
        description.setReadOnly(True)
        description.setHtml("""
        <p>This application simulates IoT waste bin sensors across multiple locations.</p>
        
        <p><b>Features:</b></p>
        <ul>
            <li>Real-time data generation with configurable intervals</li>
            <li>REST API with CORS support for frontend integrations</li>
            <li>Multiple simulation modes: random, filling, emptying, stable</li>
            <li>Advanced visualization of bin status and trends</li>
            <li>Dark mode UI with modern controls</li>
        </ul>
        
        <p><b>API Endpoint:</b> http://127.0.0.1:5000/api/data</p>
        <p><b>Configuration:</b> http://127.0.0.1:5000/api/config</p>
        """)
        
        buttons = QDialogButtonBox(QDialogButtonBox.StandardButton.Ok)
        buttons.accepted.connect(self.accept)
        
        layout.addWidget(title)
        layout.addWidget(version)
        layout.addWidget(description)
        layout.addWidget(buttons)
        
        self.setLayout(layout)
        
class InfoWidget(QWidget):
    def __init__(self):
        super().__init__()
        layout = QVBoxLayout(self)
        
        # API Info Group
        api_group = QGroupBox("API Information")
        api_layout = QGridLayout()
        api_group.setLayout(api_layout)
        
        api_layout.addWidget(QLabel("<b>Data Endpoint:</b>"), 0, 0)
        api_layout.addWidget(QLabel("http://127.0.0.1:5000/api/data"), 0, 1)
        
        api_layout.addWidget(QLabel("<b>Config Endpoint:</b>"), 1, 0)
        api_layout.addWidget(QLabel("http://127.0.0.1:5000/api/config"), 1, 1)
        
        api_layout.addWidget(QLabel("<b>Format:</b>"), 2, 0)
        api_layout.addWidget(QLabel("JSON"), 2, 1)
        
        api_layout.addWidget(QLabel("<b>CORS:</b>"), 3, 0)
        api_layout.addWidget(QLabel("Enabled"), 3, 1)
        
        example_label = QLabel("<b>Example Call:</b>")
        example_code = QLabel("""fetch('http://127.0.0.1:5000/api/data')
  .then(response => response.json())
  .then(data => console.log(data));

// Get config including update interval
fetch('http://127.0.0.1:5000/api/config')
  .then(response => response.json())
  .then(config => console.log(config.updateInterval));""")
        example_code.setStyleSheet("background-color: #2c3e50; color: #ecf0f1; padding: 10px; border-radius: 4px; font-family: monospace;")
        
        api_layout.addWidget(example_label, 4, 0)
        api_layout.addWidget(example_code, 4, 1)
        
        layout.addWidget(api_group)
        
        # Documentation Group
        doc_group = QGroupBox("Documentation")
        doc_layout = QVBoxLayout()
        doc_group.setLayout(doc_layout)
        
        doc_text = QLabel("""<h3>Sensor Simulator Documentation</h3>
<p>This application simulates waste bin sensors across various wards.</p>

<h4>Features:</h4>
<ul>
<li>Simulates real-time sensor updates with configurable intervals</li>
<li>Data available via REST API with CORS support</li>
<li>Configuration endpoint for syncing update intervals</li>
<li>Visualization of bin fill levels and status</li>
<li>Multiple simulation modes (random, filling, emptying, stable)</li>
</ul>

<h4>Data Fields:</h4>
<ul>
<li><b>ward:</b> Location area name</li>
<li><b>binId:</b> Unique identifier for each bin</li>
<li><b>fillLevel:</b> Raw sensor reading (0-200)</li>
<li><b>fillPercent:</b> Fill percentage (0-100%)</li>
<li><b>fillVolume:</b> Estimated volume in cubic units</li>
<li><b>timestamp:</b> Time of last update</li>
<li><b>status:</b> Current bin status (normal, warning, critical)</li>
</ul>""")
        doc_text.setWordWrap(True)
        doc_layout.addWidget(doc_text)
        
        layout.addWidget(doc_group)
        layout.addStretch()         





class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Smart Waste Bin Simulator")
        self.setGeometry(100, 100, 1200, 700)
        
        # Setup central widget
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        main_layout = QVBoxLayout(central_widget)
        
        # Create toolbar
        self.create_toolbar()
        
        # Create status bar
        self.statusBar = QStatusBar()
        self.setStatusBar(self.statusBar)
        self.status_label = QLabel("Server: Not Running | Simulation: Stopped")
        self.status_api = QLabel("API: http://127.0.0.1:5000/api/data")
        self.statusBar.addWidget(self.status_label)
        self.statusBar.addPermanentWidget(self.status_api)
        
        # Create tabs
        self.tabs = QTabWidget()
        main_layout.addWidget(self.tabs)
        
        # Data view tab
        data_tab = QWidget()
        data_layout = QVBoxLayout(data_tab)
        
        # Control panel
        control_panel = QGroupBox("Simulation Controls")
        control_layout = QHBoxLayout()
        control_panel.setLayout(control_layout)
        
        # Mode selection
        mode_group = QGroupBox("Mode")
        mode_layout = QVBoxLayout()
        mode_group.setLayout(mode_layout)
        
        self.mode_selector = QComboBox()
        self.mode_selector.addItems(["Random", "Filling", "Emptying", "Stable"])
        self.mode_selector.currentTextChanged.connect(self.change_mode)
        
        mode_layout.addWidget(QLabel("Update Mode:"))
        mode_layout.addWidget(self.mode_selector)
        control_layout.addWidget(mode_group)
        
        # Variance control
        variance_group = QGroupBox("Variance")
        variance_layout = QVBoxLayout()
        variance_group.setLayout(variance_layout)
        
        self.variance_slider = QSlider(Qt.Orientation.Horizontal)
        self.variance_slider.setMinimum(1)
        self.variance_slider.setMaximum(20)
        self.variance_slider.setValue(5)
        self.variance_slider.setTickPosition(QSlider.TickPosition.TicksBelow)
        self.variance_slider.setTickInterval(1)
        self.variance_slider.valueChanged.connect(self.change_variance)
        
        self.variance_label = QLabel("5.0")
        
        variance_layout.addWidget(QLabel("Data Variance:"))
        variance_layout.addWidget(self.variance_slider)
        variance_layout.addWidget(self.variance_label)
        control_layout.addWidget(variance_group)
        
        # Start/Stop controls
        button_group = QGroupBox("Controls")
        button_layout = QVBoxLayout()
        button_group.setLayout(button_layout)
        
        self.start_btn = QPushButton("Start Simulation")
        self.start_btn.setIcon(QIcon.fromTheme("media-playback-start"))
        self.start_btn.clicked.connect(self.start_sim)
        
        self.stop_btn = QPushButton("Stop Simulation")
        self.stop_btn.setIcon(QIcon.fromTheme("media-playback-stop"))
        self.stop_btn.clicked.connect(self.stop_sim)
        self.stop_btn.setEnabled(False)
        
        button_layout.addWidget(self.start_btn)
        button_layout.addWidget(self.stop_btn)
        control_layout.addWidget(button_group)
        
        # Interval control
        interval_group = QGroupBox("Update Interval")
        interval_layout = QVBoxLayout()
        interval_group.setLayout(interval_layout)
        
        self.interval_selector = QComboBox()
        self.interval_selector.addItems(["10 second", "60 seconds", "120 seconds", "180 seconds"])
        self.interval_selector.setCurrentIndex(2)  # Default 60 seconds
        
        interval_layout.addWidget(QLabel("Update Every:"))
        interval_layout.addWidget(self.interval_selector)
        control_layout.addWidget(interval_group)
        
        data_layout.addWidget(control_panel)
        
        # Search filter
        filter_layout = QHBoxLayout()
        filter_layout.addWidget(QLabel("Filter:"))
        self.filter_edit = QLineEdit()
        self.filter_edit.setPlaceholderText("Filter by ward or bin ID...")
        self.filter_edit.textChanged.connect(self.apply_filter)
        filter_layout.addWidget(self.filter_edit)
        data_layout.addLayout(filter_layout)
        
        # Table
        self.table = QTableWidget(0, 7)
        self.table.setHorizontalHeaderLabels([
            "Ward", "Bin ID", "Fill Level", "Fill %", 
            "Volume", "Status", "Last Update"
        ])
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        data_layout.addWidget(self.table)
        
        # Stats panel
        stats_panel = QGroupBox("Statistics")
        stats_layout = QGridLayout()
        stats_panel.setLayout(stats_layout)
        
        self.total_bins_label = QLabel("Total Bins: 0")
        self.critical_bins_label = QLabel("Critical Bins: 0")
        self.warning_bins_label = QLabel("Warning Bins: 0")
        self.normal_bins_label = QLabel("Normal Bins: 0")
        self.avg_fill_label = QLabel("Average Fill: 0%")
        
        stats_layout.addWidget(self.total_bins_label, 0, 0)
        stats_layout.addWidget(self.critical_bins_label, 0, 1)
        stats_layout.addWidget(self.warning_bins_label, 0, 2)
        stats_layout.addWidget(self.normal_bins_label, 0, 3)
        stats_layout.addWidget(self.avg_fill_label, 0, 4)
        
        data_layout.addWidget(stats_panel)


# Visual tab
        visual_tab = QWidget()
        visual_layout = QVBoxLayout(visual_tab)
        
        wards_group = QGroupBox("Wards Overview")
        wards_layout = QGridLayout()
        wards_group.setLayout(wards_layout)
        
        # Create a progress bar for each unique ward
        self.ward_bars = {}
        unique_wards = sorted(set(ward for ward, _ in BINS_INFO))
        
        for i, ward in enumerate(unique_wards):
            label = QLabel(f"{ward}:")
            progress = QProgressBar()
            progress.setRange(0, 100)
            progress.setValue(0)
            progress.setTextVisible(True)
            status = QLabel("Normal")
            
            wards_layout.addWidget(label, i, 0)
            wards_layout.addWidget(progress, i, 1)
            wards_layout.addWidget(status, i, 2)
            
            self.ward_bars[ward] = (progress, status)
        
        visual_layout.addWidget(wards_group)
        
        bins_group = QGroupBox("Critical Bins Monitor")
        bins_layout = QVBoxLayout()
        bins_group.setLayout(bins_layout)
        
        self.critical_list = QTableWidget(0, 4)
        self.critical_list.setHorizontalHeaderLabels([
            "Ward", "Bin ID", "Fill %", "Status"
        ])
        self.critical_list.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        bins_layout.addWidget(self.critical_list)
        
        visual_layout.addWidget(bins_group)
        
        # Export section
        export_group = QGroupBox("Data Export")
        export_layout = QHBoxLayout()
        
        export_json_btn = QPushButton("Export JSON")
        export_json_btn.clicked.connect(self.export_json)
        export_csv_btn = QPushButton("Export CSV")
        export_csv_btn.clicked.connect(self.export_csv)
        
        export_layout.addWidget(export_json_btn)
        export_layout.addWidget(export_csv_btn)
        export_group.setLayout(export_layout)
        
        visual_layout.addWidget(export_group)
        
        # Info tab
        info_tab = InfoWidget()
        
        # Add tabs
        self.tabs.addTab(data_tab, "Data View")
        self.tabs.addTab(visual_tab, "Visual Monitor")
        self.tabs.addTab(info_tab, "API & Documentation")
        
        # Set up generator and timers
        self.generator = None
        
        # Timer for table refresh
        self.refresh_timer = QTimer()
        self.refresh_timer.timeout.connect(self.update_all_views)
        self.refresh_timer.start(1000)  # every 1s
        
        # Initialize Flask thread
        self.flask_thread = threading.Thread(target=flask_thread, daemon=True)
        self.flask_thread.start()
        self.statusBar.showMessage("Flask server started at http://127.0.0.1:5000", 5000)
        self.status_label.setText("Server: Running | Simulation: Stopped")
    
    def create_toolbar(self):
        toolbar = QToolBar("Main Toolbar")
        toolbar.setIconSize(QSize(24, 24))
        
        # Start action
        start_action = QAction("Start", self)
        start_action.triggered.connect(self.start_sim)
        start_action.setStatusTip("Start simulation")
        toolbar.addAction(start_action)
        
        # Stop action
        stop_action = QAction("Stop", self)
        stop_action.triggered.connect(self.stop_sim)
        stop_action.setStatusTip("Stop simulation")
        toolbar.addAction(stop_action)
        
        toolbar.addSeparator()
        
        # Reset action
        reset_action = QAction("Reset Data", self)
        reset_action.triggered.connect(self.reset_data)
        reset_action.setStatusTip("Reset all bin data")
        toolbar.addAction(reset_action)
        
        toolbar.addSeparator()
        
        # Export menu
        export_menu = QMenu(self)
        export_json_action = QAction("Export JSON", self)
        export_json_action.triggered.connect(self.export_json)
        export_csv_action = QAction("Export CSV", self)
        export_csv_action.triggered.connect(self.export_csv)
        export_menu.addAction(export_json_action)
        export_menu.addAction(export_csv_action)
        
        # Export action
        export_action = QAction("Export", self)
        export_action.setMenu(export_menu)
        toolbar.addAction(export_action)
        
        toolbar.addSeparator()
        
        # About action
        about_action = QAction("About", self)
        about_action.triggered.connect(self.show_about)
        about_action.setStatusTip("About this application")
        toolbar.addAction(about_action)
        
        self.addToolBar(toolbar)
    
    def export_json(self):
        global bins_data
        if not bins_data:
            self.statusBar.showMessage("No data to export", 3000)
            return
            
        filename, _ = QFileDialog.getSaveFileName(
            self, "Export JSON", "", "JSON Files (*.json)"
        )
        if filename:
            with open(filename, 'w') as f:
                json.dump(bins_data, f, indent=2)
            self.statusBar.showMessage(f"Data exported to {filename}", 3000)
    
    def export_csv(self):
        global bins_data
        if not bins_data:
            self.statusBar.showMessage("No data to export", 3000)
            return
            
        filename, _ = QFileDialog.getSaveFileName(
            self, "Export CSV", "", "CSV Files (*.csv)"
        )
        if filename:
            with open(filename, 'w') as f:
                f.write("Ward,BinID,FillLevel,FillPercent,FillVolume,Status,Timestamp\n")
                for bin in bins_data:
                    f.write(f"{bin['ward']},{bin['binId']},{bin['fillLevel']},{bin['fillPercent']},{bin['fillVolume']},{bin['status']},{bin['timestamp']}\n")
            self.statusBar.showMessage(f"Data exported to {filename}", 3000)
    
    def show_about(self):
        about_dialog = AboutDialog(self)
        about_dialog.exec()
    
    def reset_data(self):
        global bins_data
        bins_data = []
        self.update_all_views()
        self.statusBar.showMessage("Data has been reset", 3000)
    
    def start_sim(self):
        if not self.generator:
            # Get the interval from the dropdown (default: 60s)
            intervals = {"10 second": 1, "60 seconds": 2, "120 seconds": 5, "180 seconds": 10}
            interval = intervals[self.interval_selector.currentText()]
            
            self.generator = DataGenerator(interval=interval)
            self.generator.data_updated.connect(self.update_all_views)
            
            # Set the initial mode
            self.change_mode(self.mode_selector.currentText())
            
            # Set the initial variance
            self.change_variance(self.variance_slider.value())
            
            self.generator.start()
            self.start_btn.setEnabled(False)
            self.stop_btn.setEnabled(True)
            self.status_label.setText(f"Server: Running | Simulation: Running ({interval}s)")
            self.statusBar.showMessage(f"Simulation started with {interval}s interval", 3000)
    
    def stop_sim(self):
        if self.generator:
            self.generator.stop_flag = True
            self.generator.wait()
            self.generator = None
            self.start_btn.setEnabled(True)
            self.stop_btn.setEnabled(False)
            self.status_label.setText("Server: Running | Simulation: Stopped")
            self.statusBar.showMessage("Simulation stopped", 3000)
    
    def change_mode(self, mode_text):
        if self.generator:
            self.generator.set_mode(mode_text.lower())
            self.statusBar.showMessage(f"Switched to {mode_text} mode", 3000)
    
    def change_variance(self, value):
        self.variance_label.setText(f"{value}.0")
        if self.generator:
            self.generator.set_variance(float(value))
    
    def apply_filter(self):
        self.update_table()
    
    def update_all_views(self):
        self.update_table()
        self.update_stats()
        self.update_visual()
    
    def update_table(self):
        global bins_data
        if not bins_data:
            return
        
        filter_text = self.filter_edit.text().lower()
        
        filtered_data = [
            b for b in bins_data 
            if (filter_text == "" or 
                filter_text in b["ward"].lower() or 
                filter_text in b["binId"].lower())
        ]
        
        self.table.setRowCount(len(filtered_data))
        
        for i, b in enumerate(filtered_data):
            self.table.setItem(i, 0, QTableWidgetItem(b["ward"]))
            self.table.setItem(i, 1, QTableWidgetItem(b["binId"]))
            self.table.setItem(i, 2, QTableWidgetItem(f"{b['fillLevel']:.2f}"))
            self.table.setItem(i, 3, QTableWidgetItem(f"{b['fillPercent']:.2f}%"))
            self.table.setItem(i, 4, QTableWidgetItem(f"{b['fillVolume']:.2f}"))
            
            status_item = QTableWidgetItem(b["status"].capitalize())
            if b["status"] == "critical":
                status_item.setBackground(QColor(200, 50, 50))
                status_item.setForeground(QColor(255, 255, 255))
            elif b["status"] == "warning":
                status_item.setBackground(QColor(230, 150, 10))
                status_item.setForeground(QColor(255, 255, 255))
            else:
                status_item.setBackground(QColor(40, 180, 40))
                status_item.setForeground(QColor(255, 255, 255))
                
            self.table.setItem(i, 5, status_item)
            
            self.table.setItem(i, 6, QTableWidgetItem(b["timestamp"]))
    
    def update_stats(self):
        global bins_data
        if not bins_data:
            return
        
        total = len(bins_data)
        critical = sum(1 for b in bins_data if b["status"] == "critical")
        warning = sum(1 for b in bins_data if b["status"] == "warning")
        normal = total - critical - warning
        
        avg_fill = sum(b["fillPercent"] for b in bins_data) / total if total > 0 else 0
        
        self.total_bins_label.setText(f"Total Bins: {total}")
        self.critical_bins_label.setText(f"Critical Bins: {critical}")
        self.warning_bins_label.setText(f"Warning Bins: {warning}")
        self.normal_bins_label.setText(f"Normal Bins: {normal}")
        self.avg_fill_label.setText(f"Average Fill: {avg_fill:.2f}%")
    
    def update_visual(self):
        global bins_data
        if not bins_data:
            return
        
        # Update ward progress bars
        ward_data = {}
        for b in bins_data:
            ward = b["ward"]
            if ward not in ward_data:
                ward_data[ward] = {"bins": 0, "total_percent": 0, "critical": 0, "warning": 0}
            
            ward_data[ward]["bins"] += 1
            ward_data[ward]["total_percent"] += b["fillPercent"]
            if b["status"] == "critical":
                ward_data[ward]["critical"] += 1
            elif b["status"] == "warning":
                ward_data[ward]["warning"] += 1
        
        for ward, (progress_bar, status_label) in self.ward_bars.items():
            if ward in ward_data:
                data = ward_data[ward]
                avg_percent = data["total_percent"] / data["bins"]
                progress_bar.setValue(int(avg_percent))
                
                if data["critical"] > 0:
                    status = f"Critical ({data['critical']} bins)"
                    status_label.setText(status)
                    status_label.setStyleSheet("color: #ff5252; font-weight: bold;")
                    progress_bar.setStyleSheet("QProgressBar::chunk { background-color: #ff5252; }")
                elif data["warning"] > 0:
                    status = f"Warning ({data['warning']} bins)"
                    status_label.setText(status)
                    status_label.setStyleSheet("color: #ff9f00; font-weight: bold;")
                    progress_bar.setStyleSheet("QProgressBar::chunk { background-color: #ff9f00; }")
                else:
                    status = "Normal"
                    status_label.setText(status)
                    status_label.setStyleSheet("color: #2ecc71; font-weight: bold;")
                    progress_bar.setStyleSheet("QProgressBar::chunk { background-color: #2ecc71; }")
        
        # Update critical bins list
        critical_bins = [b for b in bins_data if b["status"] == "critical" or b["status"] == "warning"]
        critical_bins.sort(key=lambda x: x["fillPercent"], reverse=True)
        self.critical_list.setRowCount(len(critical_bins))
        
        for i, b in enumerate(critical_bins):
            self.critical_list.setItem(i, 0, QTableWidgetItem(b["ward"]))
            self.critical_list.setItem(i, 1, QTableWidgetItem(b["binId"]))
            self.critical_list.setItem(i, 2, QTableWidgetItem(f"{b['fillPercent']:.2f}%"))
            
            status_item = QTableWidgetItem(b["status"].capitalize())
            if b["status"] == "critical":
                status_item.setBackground(QColor(255, 82, 82))
                status_item.setForeground(QColor(255, 255, 255))
            elif b["status"] == "warning":
                status_item.setBackground(QColor(255, 159, 0))
                status_item.setForeground(QColor(255, 255, 255))
            self.critical_list.setItem(i, 3, status_item)

def main():
    # Create QApplication
    app_qt = QApplication(sys.argv)
    app_qt.setStyle(QStyleFactory.create("Fusion"))
    
    # Apply a modern dark palette
    dark_palette = QPalette()
    dark_palette.setColor(QPalette.ColorRole.Window, QColor(45, 45, 45))
    dark_palette.setColor(QPalette.ColorRole.WindowText, Qt.GlobalColor.white)
    dark_palette.setColor(QPalette.ColorRole.Base, QColor(25, 25, 25))
    dark_palette.setColor(QPalette.ColorRole.AlternateBase, QColor(45, 45, 45))
    dark_palette.setColor(QPalette.ColorRole.ToolTipBase, QColor(25, 25, 25))
    dark_palette.setColor(QPalette.ColorRole.ToolTipText, Qt.GlobalColor.white)
    dark_palette.setColor(QPalette.ColorRole.Text, Qt.GlobalColor.white)
    dark_palette.setColor(QPalette.ColorRole.Button, QColor(60, 60, 60))
    dark_palette.setColor(QPalette.ColorRole.ButtonText, Qt.GlobalColor.white)
    dark_palette.setColor(QPalette.ColorRole.Link, QColor(42, 130, 218))
    dark_palette.setColor(QPalette.ColorRole.Highlight, QColor(42, 130, 218))
    dark_palette.setColor(QPalette.ColorRole.HighlightedText, Qt.GlobalColor.white)
    
    # Fix for the problematic line - different approach for setting colors for specific roles
    dark_palette.setColor(QPalette.ColorGroup.Active, QPalette.ColorRole.Button, QColor(60, 60, 60))
    dark_palette.setColor(QPalette.ColorGroup.Disabled, QPalette.ColorRole.ButtonText, Qt.GlobalColor.darkGray)
    dark_palette.setColor(QPalette.ColorGroup.Disabled, QPalette.ColorRole.WindowText, Qt.GlobalColor.darkGray)
    dark_palette.setColor(QPalette.ColorGroup.Disabled, QPalette.ColorRole.Text, Qt.GlobalColor.darkGray)
    
    # Enable dark mode
    app_qt.setPalette(dark_palette)
    
    # Additional styling
    app_qt.setStyleSheet("""
        QGroupBox {
            border: 1px solid #3a3a3a;
            border-radius: 5px;
            margin-top: 10px;
            font-weight: bold;
        }
        QGroupBox::title {
            subcontrol-origin: margin;
            left: 10px;
            padding: 0 5px 0 5px;
        }
        QPushButton {
            background-color: #2c3e50;
            color: white;
            border: none;
            padding: 5px;
            border-radius: 3px;
        }
        QPushButton:hover {
            background-color: #34495e;
        }
        QPushButton:pressed {
            background-color: #1abc9c;
        }
        QPushButton:disabled {
            background-color: #555;
            color: #888;
        }
    """)
    
    # Create and show main window
    window = MainWindow()
    window.show()
    
    # Start application event loop
    sys.exit(app_qt.exec())

if __name__ == "__main__":
    main()

