/**
 * Photo Coloring Converter - Main Application Controller
 * Coordinates all modules and handles application flow
 * Manages UI interactions and processing pipeline
 */

// Global app state initialization
window.AppState = {
    selectedFiles: [],
    processedImages: [],
    isProcessing: false,
    cancelled: false,
    currentSettings: {}
};

class ApplicationController {
    constructor() {
        this.isInitialized = false;
        this.currentStage = 'ready'; // ready, processing, complete
        this.processingQueue = [];
        
        this.initializeController();
    }

    /**
     * Initialize the application controller
     */
    initializeController() {
        console.log('Application Controller initializing...');
        
        // Verify all required modules are loaded
        this.verifyModules();
        
        // Setup global error handling
        this.setupErrorHandling();
        
        // Initialize UI state
        this.initializeUIState();
        
        // Setup performance monitoring
        this.setupPerformanceMonitoring();
        
        this.isInitialized = true;
        console.log('Application Controller initialized successfully');
        
        // Dispatch ready event
        this.dispatchEvent('app:ready');
    }

    /**
     * Verify all required modules are loaded
     */
    verifyModules() {
        const requiredModules = [
            { name: 'ImageProcessor', object: window.ImageProcessor },
            { name: 'SVGGenerator', object: window.SVGGenerator },
            { name: 'PDFExporter', object: window.PDFExporter }
        ];
        
        const missingModules = requiredModules.filter(module => !module.object);
        
        if (missingModules.length > 0) {
            const moduleNames = missingModules.map(m => m.name).join(', ');
            throw new Error(`Required modules not loaded: ${moduleNames}`);
        }
        
        console.log('All required modules verified and loaded');
    }

    /**
     * Setup global error handling
     */
    setupErrorHandling() {
        window.addEventListener('error', (event) => {
            console.error('Global error caught:', event.error);
            this.handleGlobalError(event.error);
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.handleGlobalError(event.reason);
        });
    }

    /**
     * Initialize UI state
     */
    initializeUIState() {
        // Reset all UI elements to initial state
        this.resetUIState();
        
        // Setup UI event listeners
        this.setupUIEventListeners();
        
        // Load saved settings if any
        this.loadSavedSettings();
        
        console.log('UI state initialized');
    }

    /**
     * Reset UI to initial state
     */
    resetUIState() {
        const elements = {
            processBtn: document.getElementById('processBtn'),
            progressContainer: document.getElementById('progressContainer'),
            resultsSection: document.getElementById('resultsSection'),
            previewSection: document.getElementById('previewSection'),
            fileStatus: document.getElementById('fileStatus')
        };

        // Reset process button
        if (elements.processBtn) {
            elements.processBtn.disabled = false;
            elements.processBtn.innerHTML = `
                <span class="btn-icon">🚀</span>
                <span class="btn-text">Convert to Coloring Pages</span>
            `;
            elements.processBtn.style.display = 'inline-flex';
        }

        // Hide progress and results
        if (elements.progressContainer) {
            elements.progressContainer.style.display = 'none';
        }
        
        if (elements.resultsSection) {
            elements.resultsSection.style.display = 'none';
        }

        if (elements.previewSection) {
            elements.previewSection.style.display = 'none';
        }

        // Clear file status
        if (elements.fileStatus) {
            elements.fileStatus.innerHTML = '';
        }

        // Reset app state
        window.AppState.selectedFiles = [];
        window.AppState.processedImages = [];
        window.AppState.isProcessing = false;
    }

    /**
     * Setup UI event listeners
     */
    setupUIEventListeners() {
        // Settings change handlers
        document.querySelectorAll('.setting-input').forEach(input => {
            input.addEventListener('change', () => this.handleSettingChange(input));
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            this.handleKeyboardShortcuts(event);
        });

        // Window resize handler
        window.addEventListener('resize', () => {
            this.handleWindowResize();
        });

        // Visibility change handler (tab switching)
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });

        console.log('UI event listeners setup complete');
    }

    /**
     * Load saved settings from localStorage
     */
    loadSavedSettings() {
        try {
            const savedSettings = localStorage.getItem('photoColoringConverter_settings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                this.applySettings(settings);
                console.log('Saved settings loaded');
            }
        } catch (error) {
            console.log('No saved settings found or invalid settings');
        }
    }

    /**
     * Apply settings to UI and app state
     * @param {Object} settings - Settings object
     */
    applySettings(settings) {
        Object.keys(settings).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                element.value = settings[key];
            }
        });
        
        window.AppState.currentSettings = { ...settings };
    }

    /**
     * Handle setting changes
     * @param {HTMLElement} input - Changed input element
     */
    handleSettingChange(input) {
        // Update app state
        window.AppState.currentSettings[input.id] = input.value;
        
        // Save to localStorage
        this.saveSettings();
        
        // Dispatch setting change event
        this.dispatchEvent('settings:changed', {
            setting: input.id,
            value: input.value
        });
        
        console.log(`Setting changed: ${input.id} = ${input.value}`);
    }

    /**
     * Save current settings to localStorage
     */
    saveSettings() {
        try {
            localStorage.setItem(
                'photoColoringConverter_settings', 
                JSON.stringify(window.AppState.currentSettings)
            );
        } catch (error) {
            console.log('Could not save settings to localStorage');
        }
    }

    /**
     * Handle keyboard shortcuts
     * @param {KeyboardEvent} event - Keyboard event
     */
    handleKeyboardShortcuts(event) {
        // Ctrl/Cmd + O: Open files
        if ((event.ctrlKey || event.metaKey) && event.key === 'o') {
            event.preventDefault();
            document.getElementById('fileInput').click();
        }
        
        // Ctrl/Cmd + Enter: Start processing
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            if (!window.AppState.isProcessing && window.AppState.selectedFiles.length > 0) {
                this.startImageProcessing();
            }
        }
        
        // Escape: Reset/cancel
        if (event.key === 'Escape') {
            if (window.AppState.isProcessing) {
                this.cancelProcessing();
            } else {
                this.resetApplication();
            }
        }
    }

    /**
     * Handle window resize
     */
    handleWindowResize() {
        // Debounce resize events
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            this.adjustLayoutForViewport();
        }, 250);
    }

    /**
     * Handle visibility change (tab switching)
     */
    handleVisibilityChange() {
        if (document.hidden) {
            console.log('Application moved to background');
        } else {
            console.log('Application returned to foreground');
            // Refresh any time-sensitive UI elements
            this.refreshTimestamps();
        }
    }

    /**
     * Adjust layout for current viewport
     */
    adjustLayoutForViewport() {
        // Add responsive layout adjustments here if needed
        const isMobile = window.innerWidth < 768;
        document.body.classList.toggle('mobile-layout', isMobile);
    }

    /**
     * Refresh timestamp displays
     */
    refreshTimestamps() {
        document.querySelectorAll('[data-timestamp]').forEach(element => {
            const timestamp = element.getAttribute('data-timestamp');
            if (timestamp) {
                element.textContent = new Date(timestamp).toLocaleString();
            }
        });
    }

    /**
     * Start the image processing pipeline
     */
    async startImageProcessing() {
        if (window.AppState.isProcessing) {
            console.log('Processing already in progress');
            return;
        }

        if (window.AppState.selectedFiles.length === 0) {
            alert('Please select some photos first!');
            return;
        }

        try {
            // Set processing state
            window.AppState.isProcessing = true;
            this.currentStage = 'processing';
            
            // Update UI for processing state
            this.updateUIForProcessing();
            
            // Dispatch processing start event
            this.dispatchEvent('processing:started');
            
            // Start the processing pipeline
            console.log('Starting image processing pipeline...');
            
            // Process images through the pipeline
            await window.ImageProcessor.processImages(window.AppState.selectedFiles);
            
            // Processing completed successfully
            this.handleProcessingComplete();
            
        } catch (error) {
            console.error('Processing failed:', error);
            this.handleProcessingError(error);
        }
    }

    /**
     * Update UI for processing state
     */
    updateUIForProcessing() {
        const processBtn = document.getElementById('processBtn');
        const progressContainer = document.getElementById('progressContainer');
        
        if (processBtn) {
            processBtn.disabled = true;
            processBtn.innerHTML = `
                <span class="btn-icon">⏳</span>
                <span class="btn-text">Processing Images...</span>
            `;
        }
        
        if (progressContainer) {
            progressContainer.style.display = 'block';
        }
        
        // Add processing class to body for global styling
        document.body.classList.add('processing');
    }

    /**
     * Handle successful processing completion
     */
    handleProcessingComplete() {
        console.log('Image processing completed successfully');
        
        // Update state
        window.AppState.isProcessing = false;
        this.currentStage = 'complete';
        
        // Update UI
        this.updateUIForComplete();
        
        // Dispatch completion event
        this.dispatchEvent('processing:completed', {
            processedCount: window.AppState.processedImages.length,
            completedAt: new Date().toISOString()
        });
        
        // Show completion message
        this.showCompletionMessage();
    }

    /**
     * Update UI for completion state
     */
    updateUIForComplete() {
        const processBtn = document.getElementById('processBtn');
        const progressContainer = document.getElementById('progressContainer');
        
        if (processBtn) {
            processBtn.style.display = 'none';
        }
        
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
        
        // Remove processing class
        document.body.classList.remove('processing');
        document.body.classList.add('completed');
        
        // Add restart button
        this.addRestartButton();
    }

    /**
     * Add restart button to UI
     */
    addRestartButton() {
        const resultsSection = document.getElementById('resultsSection');
        if (!resultsSection) return;
        
        // Check if restart button already exists
        if (resultsSection.querySelector('.restart-btn')) return;
        
        const restartBtn = document.createElement('button');
        restartBtn.className = 'restart-btn process-btn';
        restartBtn.innerHTML = `
            <span class="btn-icon">🔄</span>
            <span class="btn-text">Start New Project</span>
        `;
        restartBtn.onclick = () => this.resetApplication();
        
        // Insert before export section
        const exportSection = resultsSection.querySelector('.export-section');
        if (exportSection) {
            resultsSection.insertBefore(restartBtn, exportSection);
        } else {
            resultsSection.appendChild(restartBtn);
        }
    }

    /**
     * Show processing completion message
     */
    showCompletionMessage() {
        const count = window.AppState.processedImages.length;
        const settings = window.AppState.currentSettings;
        
        const message = `🎉 Processing Complete!

✅ ${count} coloring page${count > 1 ? 's' : ''} generated
🎨 Style: ${settings.outputStyle || 'Clean outlines'}
📏 Complexity: ${settings.complexityLevel || 'Moderate'}
📄 Ready for: ${settings.pageSize || 'A4'} printing

Your coloring pages are ready to download!`;

        // Use setTimeout to ensure UI has updated
        setTimeout(() => {
            console.log(message.replace(/\n/g, ' '));
        }, 500);
    }

    /**
     * Handle processing errors
     * @param {Error} error - Error object
     */
    handleProcessingError(error) {
        console.error('Processing error handled by controller:', error);
        
        // Update state
        window.AppState.isProcessing = false;
        this.currentStage = 'error';
        
        // Reset UI state
        this.resetUIState();
        
        // Dispatch error event
        this.dispatchEvent('processing:error', {
            error: error.message,
            timestamp: new Date().toISOString()
        });
        
        // Show user-friendly error message
        this.showErrorMessage(error);
    }

    /**
     * Show user-friendly error message
     * @param {Error} error - Error object
     */
    showErrorMessage(error) {
        let userMessage = 'Sorry, something went wrong during processing. ';
        
        if (error.message.includes('memory')) {
            userMessage += 'Try selecting fewer or smaller images.';
        } else if (error.message.includes('format')) {
            userMessage += 'Please check that your images are in a supported format (JPG, PNG, WebP).';
        } else if (error.message.includes('size')) {
            userMessage += 'Your images might be too large. Try resizing them first.';
        } else {
            userMessage += 'Please try again with different images.';
        }
        
        userMessage += '\n\nTip: For best results, use clear photos with good contrast.';
        
        alert(userMessage);
    }

    /**
     * Cancel ongoing processing
     */
    cancelProcessing() {
        if (!window.AppState.isProcessing) return;
        
        console.log('Cancelling processing...');
        
        // Set cancellation flag (modules should check this)
        window.AppState.cancelled = true;
        
        // Reset state after a delay to allow cleanup
        setTimeout(() => {
            window.AppState.isProcessing = false;
            window.AppState.cancelled = false;
            this.currentStage = 'ready';
            this.resetUIState();
            
            this.dispatchEvent('processing:cancelled');
        }, 1000);
        
        alert('Processing cancelled. You can start over with new images.');
    }

    /**
     * Reset application to initial state
     */
    resetApplication() {
        console.log('Resetting application...');
        
        // Clear all state
        window.AppState.selectedFiles = [];
        window.AppState.processedImages = [];
        window.AppState.isProcessing = false;
        window.AppState.cancelled = false;
        
        // Reset stage
        this.currentStage = 'ready';
        
        // Reset UI
        this.resetUIState();
        
        // Remove body classes
        document.body.classList.remove('processing', 'completed');
        
        // Clear any cached data
        if (window.ImageProcessor && window.ImageProcessor.pathDataCache) {
            window.ImageProcessor.pathDataCache.clear();
        }
        
        // Dispatch reset event
        this.dispatchEvent('app:reset');
        
        console.log('Application reset complete');
    }

    /**
     * Setup performance monitoring
     */
    setupPerformanceMonitoring() {
        // Monitor performance metrics
        this.performanceMetrics = {
            startTime: null,
            endTime: null,
            memoryUsage: [],
            processingTimes: []
        };
        
        // Start monitoring if Performance API is available
        if (window.performance && window.performance.memory) {
            this.startMemoryMonitoring();
        }
    }

    /**
     * Start memory usage monitoring
     */
    startMemoryMonitoring() {
        setInterval(() => {
            if (window.performance.memory) {
                const memory = {
                    used: window.performance.memory.usedJSHeapSize,
                    total: window.performance.memory.totalJSHeapSize,
                    limit: window.performance.memory.jsHeapSizeLimit,
                    timestamp: Date.now()
                };
                
                this.performanceMetrics.memoryUsage.push(memory);
                
                // Keep only last 50 measurements
                if (this.performanceMetrics.memoryUsage.length > 50) {
                    this.performanceMetrics.memoryUsage.shift();
                }
                
                // Log warning if memory usage is high
                const usagePercent = (memory.used / memory.limit) * 100;
                if (usagePercent > 80) {
                    console.warn(`High memory usage: ${usagePercent.toFixed(1)}%`);
                }
            }
        }, 5000); // Check every 5 seconds
    }

    /**
     * Get current performance metrics
     * @returns {Object} Performance metrics
     */
    getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            currentMemory: window.performance.memory ? {
                used: window.performance.memory.usedJSHeapSize,
                total: window.performance.memory.totalJSHeapSize,
                limit: window.performance.memory.jsHeapSizeLimit
            } : null
        };
    }

    /**
     * Handle global errors
     * @param {Error} error - Error object
     */
    handleGlobalError(error) {
        console.error('Global error handler:', error);
        
        // Don't show alerts for every error, just log them
        // Only show critical errors to user
        if (error.message && error.message.includes('critical')) {
            alert('A critical error occurred. Please refresh the page and try again.');
        }
        
        // Send error to analytics if available
        this.logErrorToAnalytics(error);
    }

    /**
     * Log error to analytics (placeholder)
     * @param {Error} error - Error object
     */
    logErrorToAnalytics(error) {
        // Placeholder for analytics logging
        console.log('Error logged to analytics:', {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
        });
    }

    /**
     * Dispatch custom application events
     * @param {string} eventName - Event name
     * @param {Object} detail - Event detail data
     */
    dispatchEvent(eventName, detail = {}) {
        const event = new CustomEvent(eventName, {
            detail: {
                ...detail,
                timestamp: new Date().toISOString(),
                stage: this.currentStage
            }
        });
        
        document.dispatchEvent(event);
        console.log(`Event dispatched: ${eventName}`, detail);
    }

    /**
     * Get application status
     * @returns {Object} Current application status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            currentStage: this.currentStage,
            isProcessing: window.AppState.isProcessing,
            selectedFiles: window.AppState.selectedFiles.length,
            processedImages: window.AppState.processedImages.length,
            settings: window.AppState.currentSettings,
            performance: this.getPerformanceMetrics()
        };
    }

    /**
     * Enable debug mode for development
     */
    enableDebugMode() {
        window.AppController = this;
        window.AppState.debugMode = true;
        
        console.log('Debug mode enabled. Access controller via window.AppController');
        console.log('Current status:', this.getStatus());
        
        // Add debug panel to UI
        this.addDebugPanel();
    }

    /**
     * Add debug panel to UI (development helper)
     */
    addDebugPanel() {
        if (document.getElementById('debug-panel')) return;
        
        const debugPanel = document.createElement('div');
        debugPanel.id = 'debug-panel';
        debugPanel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-size: 12px;
            z-index: 10000;
            max-width: 300px;
        `;
        
        debugPanel.innerHTML = `
            <strong>Debug Info</strong><br>
            <div id="debug-content">Loading...</div>
            <button onclick="this.parentElement.remove()" style="margin-top: 5px;">Close</button>
        `;
        
        document.body.appendChild(debugPanel);
        
        // Update debug info every 2 seconds
        setInterval(() => {
            const debugContent = document.getElementById('debug-content');
            if (debugContent) {
                const status = this.getStatus();
                debugContent.innerHTML = `
                    Stage: ${status.currentStage}<br>
                    Files: ${status.selectedFiles}<br>
                    Processed: ${status.processedImages}<br>
                    Processing: ${status.isProcessing ? 'Yes' : 'No'}
                `;
            }
        }, 2000);
    }
}

// Initialize the application controller
window.AppController = new ApplicationController();

// Enable debug mode in development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.AppController.enableDebugMode();
}

console.log('Main Application Controller loaded and initialized');

// Export for module systems if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApplicationController;
}
