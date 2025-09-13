/**
 * Photo Coloring Converter - Image Processing Engine
 * Advanced client-side image processing for educational purposes
 * Converts photographs into coloring page line art
 */

class ImageProcessingEngine {
    constructor() {
        this.canvas = null;
        this.context = null;
        this.originalImageData = null;
        this.processedImageData = null;
        this.processingSettings = {};
        
        this.initializeProcessor();
    }

    /**
     * Initialize the image processor with default settings
     */
    initializeProcessor() {
        console.log('Image Processing Engine initialized');
        
        // Create off-screen canvas for processing
        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext('2d');
        
        // Default processing settings
        this.processingSettings = {
            edgeThreshold: 50,
            lineWeight: 2,
            gaussianRadius: 1.5,
            morphologyRadius: 2,
            contrastBoost: 1.2,
            brightnessAdjust: 0
        };
    }

    /**
     * Main image processing pipeline
     * @param {File[]} imageFiles - Array of image files to process
     * @returns {Promise} Processing results
     */
    async processImages(imageFiles) {
        const results = [];
        const totalFiles = imageFiles.length;
        
        console.log(`Starting batch processing of ${totalFiles} images`);
        
        try {
            for (let i = 0; i < imageFiles.length; i++) {
                const file = imageFiles[i];
                
                // Update progress
                this.updateProgressUI(i, totalFiles, `Processing ${file.name}...`);
                
                // Process single image
                const processedResult = await this.processSingleImage(file, i);
                results.push(processedResult);
                
                // Small delay to prevent UI blocking
                await this.delay(100);
            }
            
            // Store results globally and update UI
            window.AppState.processedImages = results;
            this.displayResults(results);
            
            console.log('Batch processing completed successfully');
            return results;
            
        } catch (error) {
            console.error('Error during image processing:', error);
            this.handleProcessingError(error);
            throw error;
        }
    }

    /**
     * Process a single image file
     * @param {File} file - Image file to process
     * @param {number} index - File index for naming
     * @returns {Promise<Object>} Processed image data
     */
    async processSingleImage(file, index) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const reader = new FileReader();
            
            reader.onload = (e) => {
                img.onload = async () => {
                    try {
                        // Setup canvas with image dimensions
                        this.setupCanvas(img);
                        
                        // Draw original image
                        this.context.drawImage(img, 0, 0);
                        this.originalImageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
                        
                        // Apply processing pipeline
                        const processed = await this.applyProcessingPipeline();
                        
                        // Generate result object
                        const result = {
                            index: index,
                            originalFile: file,
                            originalImageData: this.originalImageData,
                            processedImageData: processed,
                            canvas: this.canvas.cloneNode(),
                            metadata: {
                                filename: file.name,
                                width: this.canvas.width,
                                height: this.canvas.height,
                                fileSize: file.size,
                                processedAt: new Date().toISOString()
                            }
                        };
                        
                        resolve(result);
                        
                    } catch (error) {
                        reject(error);
                    }
                };
                
                img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`));
                img.src = e.target.result;
            };
            
            reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
            reader.readAsDataURL(file);
        });
    }

    /**
     * Setup canvas with optimal dimensions
     * @param {HTMLImageElement} img - Source image
     */
    setupCanvas(img) {
        // Calculate optimal canvas size (max 1200px width for performance)
        const maxWidth = 1200;
        const maxHeight = 1200;
        
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
            const aspectRatio = width / height;
            
            if (width > height) {
                width = maxWidth;
                height = width / aspectRatio;
            } else {
                height = maxHeight;
                width = height * aspectRatio;
            }
        }
        
        this.canvas.width = Math.round(width);
        this.canvas.height = Math.round(height);
        
        // Enable image smoothing for better quality
        this.context.imageSmoothingEnabled = true;
        this.context.imageSmoothingQuality = 'high';
    }

    /**
     * Apply the complete image processing pipeline
     * @returns {ImageData} Processed image data
     */
    async applyProcessingPipeline() {
        console.log('Applying processing pipeline...');
        
        // Step 1: Color space conversion
        let currentData = this.convertToGrayscale(this.originalImageData);
        await this.delay(50);
        
        // Step 2: Contrast and brightness adjustment
        currentData = this.adjustContrastBrightness(currentData);
        await this.delay(50);
        
        // Step 3: Noise reduction
        currentData = this.applyGaussianBlur(currentData, this.processingSettings.gaussianRadius);
        await this.delay(50);
        
        // Step 4: Edge detection
        currentData = this.detectEdges(currentData);
        await this.delay(50);
        
        // Step 5: Morphological operations
        currentData = this.applyMorphologicalOperations(currentData);
        await this.delay(50);
        
        // Step 6: Line weight adjustment
        currentData = this.adjustLineWeight(currentData);
        await this.delay(50);
        
        // Step 7: Final cleanup
        currentData = this.finalCleanup(currentData);
        
        this.processedImageData = currentData;
        return currentData;
    }

    /**
     * Convert image to grayscale
     * @param {ImageData} imageData - Source image data
     * @returns {ImageData} Grayscale image data
     */
    convertToGrayscale(imageData) {
        const data = new Uint8ClampedArray(imageData.data);
        const result = new ImageData(data, imageData.width, imageData.height);
        
        for (let i = 0; i < data.length; i += 4) {
            // Luminance formula for better perceptual accuracy
            const gray = Math.round(
                0.299 * data[i] +     // Red
                0.587 * data[i + 1] + // Green
                0.114 * data[i + 2]   // Blue
            );
            
            result.data[i] = gray;     // Red
            result.data[i + 1] = gray; // Green
            result.data[i + 2] = gray; // Blue
            // Alpha channel remains unchanged
        }
        
        return result;
    }

    /**
     * Adjust contrast and brightness
     * @param {ImageData} imageData - Source image data
     * @returns {ImageData} Adjusted image data
     */
    adjustContrastBrightness(imageData) {
        const data = new Uint8ClampedArray(imageData.data);
        const result = new ImageData(data, imageData.width, imageData.height);
        
        const contrast = this.processingSettings.contrastBoost;
        const brightness = this.processingSettings.brightnessAdjust;
        
        for (let i = 0; i < data.length; i += 4) {
            // Apply contrast and brightness to RGB channels
            for (let c = 0; c < 3; c++) {
                let value = data[i + c];
                
                // Apply contrast (multiply by factor, centered around 128)
                value = ((value - 128) * contrast) + 128;
                
                // Apply brightness (simple addition)
                value += brightness;
                
                // Clamp to valid range
                result.data[i + c] = Math.max(0, Math.min(255, value));
            }
        }
        
        return result;
    }

    /**
     * Apply Gaussian blur for noise reduction
     * @param {ImageData} imageData - Source image data
     * @param {number} radius - Blur radius
     * @returns {ImageData} Blurred image data
     */
    applyGaussianBlur(imageData, radius) {
        // Create temporary canvas for blur operation
        const tempCanvas = document.createElement('canvas');
        const tempContext = tempCanvas.getContext('2d');
        
        tempCanvas.width = imageData.width;
        tempCanvas.height = imageData.height;
        
        // Put image data on temp canvas
        tempContext.putImageData(imageData, 0, 0);
        
        // Apply CSS filter blur (hardware accelerated when available)
        tempContext.filter = `blur(${radius}px)`;
        tempContext.drawImage(tempCanvas, 0, 0);
        
        // Get blurred result
        return tempContext.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    }

    /**
     * Detect edges using Sobel operator
     * @param {ImageData} imageData - Source image data
     * @returns {ImageData} Edge-detected image data
     */
    detectEdges(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const result = new ImageData(width, height);
        
        // Sobel kernels
        const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
        const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let pixelX = 0, pixelY = 0;
                
                // Apply Sobel operators
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const idx = ((y + ky) * width + (x + kx)) * 4;
                        const intensity = data[idx]; // Use red channel (grayscale)
                        
                        const kernelIdx = (ky + 1) * 3 + (kx + 1);
                        pixelX += intensity * sobelX[kernelIdx];
                        pixelY += intensity * sobelY[kernelIdx];
                    }
                }
                
                // Calculate gradient magnitude
                const magnitude = Math.sqrt(pixelX * pixelX + pixelY * pixelY);
                
                // Apply threshold
                const edge = magnitude > this.processingSettings.edgeThreshold ? 0 : 255;
                
                const resultIdx = (y * width + x) * 4;
                result.data[resultIdx] = edge;     // Red
                result.data[resultIdx + 1] = edge; // Green
                result.data[resultIdx + 2] = edge; // Blue
                result.data[resultIdx + 3] = 255;  // Alpha
            }
        }
        
        return result;
    }

    /**
     * Apply morphological operations to clean up the image
     * @param {ImageData} imageData - Source image data
     * @returns {ImageData} Cleaned image data
     */
    applyMorphologicalOperations(imageData) {
        const settings = window.AppState.currentSettings;
        
        // Adjust operations based on complexity level
        let iterations = 1;
        switch (settings.complexityLevel) {
            case 'simple':
                iterations = 2; // More aggressive cleanup
                break;
            case 'moderate':
                iterations = 1;
                break;
            case 'complex':
                iterations = 0; // Preserve detail
                break;
        }
        
        let result = imageData;
        
        for (let i = 0; i < iterations; i++) {
            // Opening operation (erosion followed by dilation)
            result = this.morphologicalErosion(result);
            result = this.morphologicalDilation(result);
        }
        
        return result;
    }

    /**
     * Morphological erosion operation
     * @param {ImageData} imageData - Source image data
     * @returns {ImageData} Eroded image data
     */
    morphologicalErosion(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const result = new ImageData(width, height);
        const radius = this.processingSettings.morphologyRadius;
        
        for (let y = radius; y < height - radius; y++) {
            for (let x = radius; x < width - radius; x++) {
                let minValue = 255;
                
                // Check neighborhood
                for (let ky = -radius; ky <= radius; ky++) {
                    for (let kx = -radius; kx <= radius; kx++) {
                        const idx = ((y + ky) * width + (x + kx)) * 4;
                        minValue = Math.min(minValue, data[idx]);
                    }
                }
                
                const idx = (y * width + x) * 4;
                result.data[idx] = result.data[idx + 1] = result.data[idx + 2] = minValue;
                result.data[idx + 3] = 255;
            }
        }
        
        return result;
    }

    /**
     * Morphological dilation operation
     * @param {ImageData} imageData - Source image data
     * @returns {ImageData} Dilated image data
     */
    morphologicalDilation(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const result = new ImageData(width, height);
        const radius = this.processingSettings.morphologyRadius;
        
        for (let y = radius; y < height - radius; y++) {
            for (let x = radius; x < width - radius; x++) {
                let maxValue = 0;
                
                // Check neighborhood
                for (let ky = -radius; ky <= radius; ky++) {
                    for (let kx = -radius; kx <= radius; kx++) {
                        const idx = ((y + ky) * width + (x + kx)) * 4;
                        maxValue = Math.max(maxValue, data[idx]);
                    }
                }
                
                const idx = (y * width + x) * 4;
                result.data[idx] = result.data[idx + 1] = result.data[idx + 2] = maxValue;
                result.data[idx + 3] = 255;
            }
        }
        
        return result;
    }

    /**
     * Adjust line weight based on settings
     * @param {ImageData} imageData - Source image data
     * @returns {ImageData} Adjusted image data
     */
    adjustLineWeight(imageData) {
        const settings = window.AppState.currentSettings;
        
        let lineWeight = this.processingSettings.lineWeight;
        
        // Adjust based on user preference
        switch (settings.lineWeight) {
            case 'thin':
                lineWeight = 1;
                break;
            case 'medium':
                lineWeight = 2;
                break;
            case 'thick':
                lineWeight = 3;
                break;
        }
        
        if (lineWeight <= 1) {
            return imageData; // No adjustment needed
        }
        
        // Apply dilation to thicken lines
        let result = imageData;
        for (let i = 0; i < lineWeight - 1; i++) {
            result = this.morphologicalDilation(result);
        }
        
        return result;
    }

    /**
     * Final cleanup and optimization
     * @param {ImageData} imageData - Source image data
     * @returns {ImageData} Final cleaned image data
     */
    finalCleanup(imageData) {
        const data = new Uint8ClampedArray(imageData.data);
        const result = new ImageData(data, imageData.width, imageData.height);
        
        // Ensure pure black and white output
        for (let i = 0; i < data.length; i += 4) {
            const value = data[i] > 127 ? 255 : 0;
            result.data[i] = result.data[i + 1] = result.data[i + 2] = value;
            result.data[i + 3] = 255; // Full opacity
        }
        
        return result;
    }

    /**
     * Update progress UI during processing
     * @param {number} current - Current progress
     * @param {number} total - Total items
     * @param {string} message - Progress message
     */
    updateProgressUI(current, total, message) {
        const progress = (current / total) * 100;
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const progressDetails = document.getElementById('progressDetails');
        
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }
        
        if (progressText) {
            progressText.textContent = message;
        }
        
        if (progressDetails) {
            progressDetails.textContent = `Processing ${current + 1} of ${total} images`;
        }
    }

    /**
     * Display processing results
     * @param {Array} results - Processing results
     */
    displayResults(results) {
        const resultsSection = document.getElementById('resultsSection');
        const resultsGrid = document.getElementById('resultsGrid');
        
        if (!resultsSection || !resultsGrid) {
            console.error('Results UI elements not found');
            return;
        }
        
        // Clear previous results
        resultsGrid.innerHTML = '';
        
        // Create result cards
        results.forEach((result, index) => {
            const card = this.createResultCard(result, index);
            resultsGrid.appendChild(card);
        });
        
        // Show results section
        resultsSection.style.display = 'block';
        
        // Hide progress and process button
        const progressContainer = document.getElementById('progressContainer');
        const processBtn = document.getElementById('processBtn');
        
        if (progressContainer) progressContainer.style.display = 'none';
        if (processBtn) processBtn.style.display = 'none';
        
        // Smooth scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * Create a result card for display
     * @param {Object} result - Processing result
     * @param {number} index - Result index
     * @returns {HTMLElement} Result card element
     */
    createResultCard(result, index) {
        const card = document.createElement('div');
        card.className = 'result-card fade-in';
        
        // Create canvas for preview
        const previewCanvas = document.createElement('canvas');
        const previewContext = previewCanvas.getContext('2d');
        
        previewCanvas.width = result.processedImageData.width;
        previewCanvas.height = result.processedImageData.height;
        previewContext.putImageData(result.processedImageData, 0, 0);
        
        // Scale canvas for preview
        previewCanvas.style.maxWidth = '100%';
        previewCanvas.style.height = 'auto';
        previewCanvas.style.border = '1px solid #e9ecef';
        previewCanvas.style.borderRadius = '5px';
        
        card.innerHTML = `
            <h4>Page ${index + 1}: ${result.metadata.filename}</h4>
            <div class="result-preview"></div>
            <div class="result-info">
                <p><strong>Dimensions:</strong> ${result.metadata.width} × ${result.metadata.height}px</p>
                <p><strong>File size:</strong> ${this.formatFileSize(result.metadata.fileSize)}</p>
                <p><strong>Processed:</strong> ${new Date(result.metadata.processedAt).toLocaleTimeString()}</p>
            </div>
        `;
        
        // Add canvas to preview area
        const previewArea = card.querySelector('.result-preview');
        previewArea.appendChild(previewCanvas);
        
        return card;
    }

    /**
     * Format file size for display
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Handle processing errors
     * @param {Error} error - Error object
     */
    handleProcessingError(error) {
        console.error('Processing error:', error);
        
        // Reset UI state
        const processBtn = document.getElementById('processBtn');
        const progressContainer = document.getElementById('progressContainer');
        
        if (processBtn) {
            processBtn.disabled = false;
            processBtn.innerHTML = `
                <span class="btn-icon">🚀</span>
                <span class="btn-text">Convert to Coloring Pages</span>
            `;
            processBtn.style.display = 'inline-flex';
        }
        
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
        
        // Show error message
        alert(`Processing failed: ${error.message}\nPlease try with different images or check the browser console for details.`);
    }

    /**
     * Utility function for async delays
     * @param {number} ms - Delay in milliseconds
     * @returns {Promise} Delay promise
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize global image processor
window.ImageProcessor = new ImageProcessingEngine();

console.log('Image Processing Engine loaded successfully');