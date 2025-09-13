/**
 * Photo Coloring Converter - SVG Vector Generator
 * Converts processed bitmap images to scalable vector graphics
 * Generates clean, printable SVG paths for coloring pages
 */

class SVGVectorGenerator {
    constructor() {
        this.pathDataCache = new Map();
        this.optimizationSettings = {
            simplifyTolerance: 2.0,
            minPathLength: 10,
            maxPoints: 1000,
            smoothingFactor: 1.5
        };
        
        this.initializeGenerator();
    }

    /**
     * Initialize the SVG generator
     */
    initializeGenerator() {
        console.log('SVG Vector Generator initialized');
        
        // Setup SVG namespace and default attributes
        this.svgNamespace = 'http://www.w3.org/2000/svg';
        this.defaultViewBox = { width: 210, height: 297 }; // A4 proportions in mm
    }

    /**
     * Convert processed images to SVG format
     * @param {Array} processedImages - Array of processed image data
     * @returns {Array} SVG conversion results
     */
    async convertToSVG(processedImages) {
        console.log(`Converting ${processedImages.length} images to SVG format`);
        
        const svgResults = [];
        
        try {
            for (let i = 0; i < processedImages.length; i++) {
                const imageData = processedImages[i];
                
                console.log(`Converting image ${i + 1}/${processedImages.length} to SVG`);
                
                // Extract vector paths from bitmap
                const vectorPaths = await this.extractVectorPaths(imageData.processedImageData);
                
                // Generate SVG document
                const svgDocument = this.createSVGDocument(vectorPaths, imageData.metadata);
                
                // Optimize and clean paths
                const optimizedSVG = this.optimizeSVGPaths(svgDocument);
                
                // Add theme elements based on settings
                const themedSVG = this.addThemeElements(optimizedSVG, imageData.metadata);
                
                const result = {
                    index: i,
                    originalImage: imageData,
                    svgDocument: themedSVG,
                    svgString: this.serializeSVG(themedSVG),
                    vectorPaths: vectorPaths,
                    metadata: {
                        ...imageData.metadata,
                        pathCount: vectorPaths.length,
                        svgSize: this.calculateSVGSize(themedSVG),
                        generatedAt: new Date().toISOString()
                    }
                };
                
                svgResults.push(result);
                
                // Small delay to prevent blocking
                await this.delay(50);
            }
            
            console.log('SVG conversion completed successfully');
            return svgResults;
            
        } catch (error) {
            console.error('Error during SVG conversion:', error);
            throw error;
        }
    }

    /**
     * Extract vector paths from processed bitmap data
     * @param {ImageData} imageData - Processed bitmap image data
     * @returns {Array} Array of vector path objects
     */
    async extractVectorPaths(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        
        // Create binary map for contour detection
        const binaryMap = this.createBinaryMap(data, width, height);
        
        // Find contours using border following algorithm
        const contours = this.findContours(binaryMap, width, height);
        
        // Convert contours to smooth vector paths
        const vectorPaths = contours.map(contour => {
            const smoothedContour = this.smoothContour(contour);
            const simplifiedPath = this.simplifyPath(smoothedContour);
            return this.createSVGPath(simplifiedPath);
        });
        
        // Filter out very small or invalid paths
        return vectorPaths.filter(path => 
            path && path.points && path.points.length >= 3
        );
    }

    /**
     * Create binary map from image data
     * @param {Uint8ClampedArray} data - Image pixel data
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @returns {Array} 2D binary array
     */
    createBinaryMap(data, width, height) {
        const binaryMap = [];
        
        for (let y = 0; y < height; y++) {
            binaryMap[y] = [];
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                // Consider pixel as edge if it's dark (close to black)
                binaryMap[y][x] = data[idx] < 128 ? 1 : 0;
            }
        }
        
        return binaryMap;
    }

    /**
     * Find contours using border following algorithm
     * @param {Array} binaryMap - 2D binary array
     * @param {number} width - Map width
     * @param {number} height - Map height
     * @returns {Array} Array of contour point arrays
     */
    findContours(binaryMap, width, height) {
        const contours = [];
        const visited = Array(height).fill().map(() => Array(width).fill(false));
        
        // Directions for 8-connectivity (Moore neighborhood)
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                if (binaryMap[y][x] === 1 && !visited[y][x]) {
                    const contour = this.traceContour(
                        binaryMap, visited, x, y, width, height, directions
                    );
                    
                    if (contour.length >= this.optimizationSettings.minPathLength) {
                        contours.push(contour);
                    }
                }
            }
        }
        
        return contours;
    }

    /**
     * Trace a single contour starting from given point
     * @param {Array} binaryMap - 2D binary array
     * @param {Array} visited - Visited pixels tracker
     * @param {number} startX - Starting X coordinate
     * @param {number} startY - Starting Y coordinate
     * @param {number} width - Map width
     * @param {number} height - Map height
     * @param {Array} directions - Direction vectors
     * @returns {Array} Contour points
     */
    traceContour(binaryMap, visited, startX, startY, width, height, directions) {
        const contour = [];
        const stack = [[startX, startY]];
        
        while (stack.length > 0 && contour.length < this.optimizationSettings.maxPoints) {
            const [x, y] = stack.pop();
            
            if (x < 0 || x >= width || y < 0 || y >= height || 
                visited[y][x] || binaryMap[y][x] === 0) {
                continue;
            }
            
            visited[y][x] = true;
            contour.push({ x, y });
            
            // Check neighbors
            for (const [dx, dy] of directions) {
                const nx = x + dx;
                const ny = y + dy;
                
                if (nx >= 0 && nx < width && ny >= 0 && ny < height &&
                    !visited[ny][nx] && binaryMap[ny][nx] === 1) {
                    stack.push([nx, ny]);
                }
            }
        }
        
        return contour;
    }

    /**
     * Smooth contour using moving average
     * @param {Array} contour - Array of contour points
     * @returns {Array} Smoothed contour points
     */
    smoothContour(contour) {
        if (contour.length < 5) return contour;
        
        const smoothed = [];
        const windowSize = Math.min(5, Math.floor(contour.length / 10));
        
        for (let i = 0; i < contour.length; i++) {
            let sumX = 0, sumY = 0, count = 0;
            
            for (let j = -windowSize; j <= windowSize; j++) {
                const idx = (i + j + contour.length) % contour.length;
                sumX += contour[idx].x;
                sumY += contour[idx].y;
                count++;
            }
            
            smoothed.push({
                x: sumX / count,
                y: sumY / count
            });
        }
        
        return smoothed;
    }

    /**
     * Simplify path using Douglas-Peucker algorithm
     * @param {Array} points - Array of path points
     * @returns {Array} Simplified path points
     */
    simplifyPath(points) {
        if (points.length <= 2) return points;
        
        return this.douglasPeucker(points, this.optimizationSettings.simplifyTolerance);
    }

    /**
     * Douglas-Peucker path simplification algorithm
     * @param {Array} points - Input points
     * @param {number} tolerance - Simplification tolerance
     * @returns {Array} Simplified points
     */
    douglasPeucker(points, tolerance) {
        if (points.length <= 2) return points;
        
        // Find the point with maximum distance from line segment
        let maxDistance = 0;
        let maxIndex = 0;
        const end = points.length - 1;
        
        for (let i = 1; i < end; i++) {
            const distance = this.perpendicularDistance(
                points[i], points[0], points[end]
            );
            
            if (distance > maxDistance) {
                maxDistance = distance;
                maxIndex = i;
            }
        }
        
        // If max distance is greater than tolerance, recursively simplify
        if (maxDistance > tolerance) {
            const left = this.douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
            const right = this.douglasPeucker(points.slice(maxIndex), tolerance);
            
            // Combine results (remove duplicate point at junction)
            return left.slice(0, -1).concat(right);
        } else {
            // Return simplified line segment
            return [points[0], points[end]];
        }
    }

    /**
     * Calculate perpendicular distance from point to line segment
     * @param {Object} point - Point to measure
     * @param {Object} lineStart - Line segment start
     * @param {Object} lineEnd - Line segment end
     * @returns {number} Perpendicular distance
     */
    perpendicularDistance(point, lineStart, lineEnd) {
        const A = point.x - lineStart.x;
        const B = point.y - lineStart.y;
        const C = lineEnd.x - lineStart.x;
        const D = lineEnd.y - lineStart.y;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) {
            // Line segment is actually a point
            return Math.sqrt(A * A + B * B);
        }
        
        const param = dot / lenSq;
        
        let xx, yy;
        
        if (param < 0) {
            xx = lineStart.x;
            yy = lineStart.y;
        } else if (param > 1) {
            xx = lineEnd.x;
            yy = lineEnd.y;
        } else {
            xx = lineStart.x + param * C;
            yy = lineStart.y + param * D;
        }
        
        const dx = point.x - xx;
        const dy = point.y - yy;
        
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Create SVG path object from simplified points
     * @param {Array} points - Simplified path points
     * @returns {Object} SVG path object
     */
    createSVGPath(points) {
        if (points.length < 2) return null;
        
        // Generate smooth SVG path using cubic Bezier curves
        const pathData = this.generateSmoothPathData(points);
        
        return {
            points: points,
            pathData: pathData,
            length: this.calculatePathLength(points),
            bounds: this.calculateBounds(points)
        };
    }

    /**
     * Generate smooth SVG path data using Bezier curves
     * @param {Array} points - Path points
     * @returns {string} SVG path data string
     */
    generateSmoothPathData(points) {
        if (points.length < 2) return '';
        
        let pathData = `M ${points[0].x} ${points[0].y}`;
        
        if (points.length === 2) {
            pathData += ` L ${points[1].x} ${points[1].y}`;
            return pathData;
        }
        
        // Use quadratic Bezier curves for smooth paths
        for (let i = 1; i < points.length - 1; i++) {
            const current = points[i];
            const next = points[i + 1];
            
            // Calculate control point for smooth curve
            const controlX = current.x;
            const controlY = current.y;
            const endX = (current.x + next.x) / 2;
            const endY = (current.y + next.y) / 2;
            
            pathData += ` Q ${controlX} ${controlY} ${endX} ${endY}`;
        }
        
        // Add final line to last point
        const lastPoint = points[points.length - 1];
        pathData += ` L ${lastPoint.x} ${lastPoint.y}`;
        
        return pathData;
    }

    /**
     * Calculate path length
     * @param {Array} points - Path points
     * @returns {number} Total path length
     */
    calculatePathLength(points) {
        let length = 0;
        
        for (let i = 1; i < points.length; i++) {
            const dx = points[i].x - points[i - 1].x;
            const dy = points[i].y - points[i - 1].y;
            length += Math.sqrt(dx * dx + dy * dy);
        }
        
        return length;
    }

    /**
     * Calculate bounding box for points
     * @param {Array} points - Path points
     * @returns {Object} Bounds object
     */
    calculateBounds(points) {
        if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
        
        let minX = points[0].x, maxX = points[0].x;
        let minY = points[0].y, maxY = points[0].y;
        
        for (const point of points) {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        }
        
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * Create complete SVG document
     * @param {Array} vectorPaths - Array of vector path objects
     * @param {Object} metadata - Image metadata
     * @returns {SVGElement} SVG document element
     */
    createSVGDocument(vectorPaths, metadata) {
        // Create SVG root element
        const svg = document.createElementNS(this.svgNamespace, 'svg');
        const settings = window.AppState.currentSettings;
        
        // Set document properties
        const pageSize = this.getPageDimensions(settings.pageSize);
        
        svg.setAttribute('width', `${pageSize.width}mm`);
        svg.setAttribute('height', `${pageSize.height}mm`);
        svg.setAttribute('viewBox', `0 0 ${pageSize.width} ${pageSize.height}`);
        svg.setAttribute('xmlns', this.svgNamespace);
        
        // Add title and description
        const title = document.createElementNS(this.svgNamespace, 'title');
        title.textContent = `Coloring Page: ${metadata.filename}`;
        svg.appendChild(title);
        
        const desc = document.createElementNS(this.svgNamespace, 'desc');
        desc.textContent = `Generated coloring page from ${metadata.filename} using Photo Coloring Converter`;
        svg.appendChild(desc);
        
        // Create main content group
        const mainGroup = document.createElementNS(this.svgNamespace, 'g');
        mainGroup.setAttribute('id', 'coloring-content');
        
        // Scale and center the image content
        const imageBounds = this.calculateOverallBounds(vectorPaths);
        const transform = this.calculateTransform(imageBounds, pageSize);
        mainGroup.setAttribute('transform', transform);
        
        // Add vector paths
        vectorPaths.forEach((path, index) => {
            if (path && path.pathData) {
                const pathElement = document.createElementNS(this.svgNamespace, 'path');
                pathElement.setAttribute('d', path.pathData);
                pathElement.setAttribute('fill', 'none');
                pathElement.setAttribute('stroke', 'black');
                pathElement.setAttribute('stroke-width', this.getStrokeWidth(settings.lineWeight));
                pathElement.setAttribute('stroke-linecap', 'round');
                pathElement.setAttribute('stroke-linejoin', 'round');
                pathElement.setAttribute('id', `path-${index}`);
                
                mainGroup.appendChild(pathElement);
            }
        });
        
        svg.appendChild(mainGroup);
        
        return svg;
    }

    /**
     * Get page dimensions based on page size setting
     * @param {string} pageSize - Page size setting
     * @returns {Object} Page dimensions in mm
     */
    getPageDimensions(pageSize) {
        const dimensions = {
            'a4': { width: 210, height: 297 },
            'letter': { width: 216, height: 279 },
            'a3': { width: 297, height: 420 }
        };
        
        return dimensions[pageSize] || dimensions.a4;
    }

    /**
     * Get stroke width based on line weight setting
     * @param {string} lineWeight - Line weight setting
     * @returns {number} Stroke width in mm
     */
    getStrokeWidth(lineWeight) {
        const weights = {
            'thin': 0.5,
            'medium': 1.0,
            'thick': 1.5
        };
        
        return weights[lineWeight] || weights.medium;
    }

    /**
     * Calculate overall bounds for all paths
     * @param {Array} vectorPaths - Array of vector paths
     * @returns {Object} Overall bounds
     */
    calculateOverallBounds(vectorPaths) {
        if (vectorPaths.length === 0) {
            return { x: 0, y: 0, width: 100, height: 100 };
        }
        
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        vectorPaths.forEach(path => {
            if (path && path.bounds) {
                minX = Math.min(minX, path.bounds.x);
                maxX = Math.max(maxX, path.bounds.x + path.bounds.width);
                minY = Math.min(minY, path.bounds.y);
                maxY = Math.max(maxY, path.bounds.y + path.bounds.height);
            }
        });
        
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * Calculate transform to fit and center content
     * @param {Object} contentBounds - Content bounding box
     * @param {Object} pageSize - Page dimensions
     * @returns {string} SVG transform attribute
     */
    calculateTransform(contentBounds, pageSize) {
        const margin = 20; // 20mm margin
        const availableWidth = pageSize.width - (margin * 2);
        const availableHeight = pageSize.height - (margin * 2);
        
        // Calculate scale to fit within available area
        const scaleX = availableWidth / contentBounds.width;
        const scaleY = availableHeight / contentBounds.height;
        const scale = Math.min(scaleX, scaleY, 1); // Don't scale up
        
        // Calculate centering offsets
        const scaledWidth = contentBounds.width * scale;
        const scaledHeight = contentBounds.height * scale;
        const offsetX = margin + (availableWidth - scaledWidth) / 2 - (contentBounds.x * scale);
        const offsetY = margin + (availableHeight - scaledHeight) / 2 - (contentBounds.y * scale);
        
        return `translate(${offsetX}, ${offsetY}) scale(${scale})`;
    }

    /**
     * Optimize SVG paths for better performance and quality
     * @param {SVGElement} svgDocument - SVG document to optimize
     * @returns {SVGElement} Optimized SVG document
     */
    optimizeSVGPaths(svgDocument) {
        // Remove very short paths that don't contribute to the design
        const paths = svgDocument.querySelectorAll('path');
        
        paths.forEach(path => {
            const pathLength = this.getPathLength(path);
            if (pathLength < 5) { // Remove paths shorter than 5mm
                path.remove();
            }
        });
        
        return svgDocument;
    }

    /**
     * Get path length from SVG path element
     * @param {SVGPathElement} pathElement - SVG path element
     * @returns {number} Path length
     */
    getPathLength(pathElement) {
        try {
            return pathElement.getTotalLength ? pathElement.getTotalLength() : 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Add theme elements based on settings
     * @param {SVGElement} svgDocument - Base SVG document
     * @param {Object} metadata - Image metadata
     * @returns {SVGElement} SVG with theme elements
     */
    addThemeElements(svgDocument, metadata) {
        const settings = window.AppState.currentSettings;
        
        if (settings.pageTheme === 'decorative') {
            this.addDecorativeBorder(svgDocument);
        }
        
        if (settings.pageTheme === 'educational') {
            this.addEducationalElements(svgDocument, metadata);
        }
        
        // Always add title
        this.addPageTitle(svgDocument, metadata);
        
        return svgDocument;
    }

    /**
     * Add decorative border to SVG
     * @param {SVGElement} svg - SVG document
     */
    addDecorativeBorder(svg) {
        const borderGroup = document.createElementNS(this.svgNamespace, 'g');
        borderGroup.setAttribute('id', 'decorative-border');
        
        // Simple decorative border
        const rect = document.createElementNS(this.svgNamespace, 'rect');
        rect.setAttribute('x', '10');
        rect.setAttribute('y', '10');
        rect.setAttribute('width', `${svg.viewBox.baseVal.width - 20}`);
        rect.setAttribute('height', `${svg.viewBox.baseVal.height - 20}`);
        rect.setAttribute('fill', 'none');
        rect.setAttribute('stroke', 'black');
        rect.setAttribute('stroke-width', '1');
        rect.setAttribute('stroke-dasharray', '5,3');
        
        borderGroup.appendChild(rect);
        svg.insertBefore(borderGroup, svg.firstChild);
    }

    /**
     * Add educational elements to SVG
     * @param {SVGElement} svg - SVG document
     * @param {Object} metadata - Image metadata
     */
    addEducationalElements(svg, metadata) {
        const eduGroup = document.createElementNS(this.svgNamespace, 'g');
        eduGroup.setAttribute('id', 'educational-elements');
        
        // Add simple labels or instruction text
        const instruction = document.createElementNS(this.svgNamespace, 'text');
        instruction.setAttribute('x', '20');
        instruction.setAttribute('y', `${svg.viewBox.baseVal.height - 10}`);
        instruction.setAttribute('font-family', 'Arial, sans-serif');
        instruction.setAttribute('font-size', '8');
        instruction.setAttribute('fill', 'black');
        instruction.textContent = 'Color within the lines and be creative!';
        
        eduGroup.appendChild(instruction);
        svg.appendChild(eduGroup);
    }

    /**
     * Add page title to SVG
     * @param {SVGElement} svg - SVG document
     * @param {Object} metadata - Image metadata
     */
    addPageTitle(svg, metadata) {
        const settings = window.AppState.currentSettings;
        const titleText = settings.projectTitle || 'Coloring Page';
        
        const titleElement = document.createElementNS(this.svgNamespace, 'text');
        titleElement.setAttribute('x', `${svg.viewBox.baseVal.width / 2}`);
        titleElement.setAttribute('y', '15');
        titleElement.setAttribute('text-anchor', 'middle');
        titleElement.setAttribute('font-family', 'Arial, sans-serif');
        titleElement.setAttribute('font-size', '10');
        titleElement.setAttribute('font-weight', 'bold');
        titleElement.setAttribute('fill', 'black');
        titleElement.textContent = titleText;
        
        svg.appendChild(titleElement);
    }

    /**
     * Serialize SVG to string
     * @param {SVGElement} svgElement - SVG element
     * @returns {string} SVG string
     */
    serializeSVG(svgElement) {
        const serializer = new XMLSerializer();
        return serializer.serializeToString(svgElement);
    }

    /**
     * Calculate SVG file size
     * @param {SVGElement} svgElement - SVG element
     * @returns {number} File size in bytes
     */
    calculateSVGSize(svgElement) {
        return new Blob([this.serializeSVG(svgElement)]).size;
    }

    /**
     * Export SVG files for download
     * @param {Array} processedImages - Processed image data
     */
    async exportSVGFiles(processedImages) {
        try {
            console.log('Starting SVG export...');
            
            // Convert to SVG first if not already done
            let svgResults;
            if (processedImages[0].svgDocument) {
                svgResults = processedImages;
            } else {
                svgResults = await this.convertToSVG(processedImages);
            }
            
            if (svgResults.length === 1) {
                // Single file download
                this.downloadSVGFile(svgResults[0]);
            } else {
                // Multiple files - create ZIP
                await this.downloadSVGZip(svgResults);
            }
            
        } catch (error) {
            console.error('SVG export failed:', error);
            alert('SVG export failed. Please try again.');
        }
    }

    /**
     * Download single SVG file
     * @param {Object} svgResult - SVG result object
     */
    downloadSVGFile(svgResult) {
        const filename = `${svgResult.originalImage.metadata.filename.replace(/\.[^/.]+$/, '')}-coloring.svg`;
        const svgContent = svgResult.svgString;
        
        this.triggerDownload(filename, svgContent, 'image/svg+xml');
    }

    /**
     * Download multiple SVG files as ZIP
     * @param {Array} svgResults - Array of SVG results
     */
    async downloadSVGZip(svgResults) {
        // For demo purposes, download the first SVG
        // In a real implementation, you'd use a ZIP library like JSZip
        console.log(`Would create ZIP with ${svgResults.length} SVG files`);
        
        if (svgResults.length > 0) {
            this.downloadSVGFile(svgResults[0]);
            alert(`SVG export: Generated ${svgResults.length} files. Downloading first file as demonstration.`);
        }
    }

    /**
     * Trigger file download
     * @param {string} filename - File name
     * @param {string} content - File content
     * @param {string} mimeType - MIME type
     */
    triggerDownload(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        console.log(`Downloaded: ${filename}`);
    }

    /**
     * Utility delay function
     * @param {number} ms - Delay in milliseconds
     * @returns {Promise} Delay promise
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize global SVG generator
window.SVGGenerator = new SVGVectorGenerator();

console.log('SVG Vector Generator loaded successfully');
