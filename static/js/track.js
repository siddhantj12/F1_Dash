/**
 * F1 Track Visualization
 * Handles rendering the track map with sector information
 */
import F1DashAPI from './api.js';

class TrackVisualizer {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        
        if (!this.container) {
            console.error(`Container with ID "${containerId}" not found`);
            return;
        }
        
        // Create canvas element
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.trackData = null;
        this.comparisonData = null;
        this.isLoading = false;
        this.error = null;
        this.singleDriverColor = '#e10600';
        
        // Default sector colors (white)
        this.sectorColors = ['#ffffff', '#ffffff', '#ffffff'];
        
        // Set canvas dimensions
        this.canvas.width = this.container.clientWidth;
        this.canvas.height = this.container.clientHeight;
        
        // Add canvas to container
        this.container.innerHTML = '';
        this.container.appendChild(this.canvas);
        
        // Add debug container for visualization
        this.debugContainer = document.createElement('div');
        this.debugContainer.style.position = 'absolute';
        this.debugContainer.style.bottom = '10px';
        this.debugContainer.style.left = '10px';
        this.debugContainer.style.right = '10px';
        this.debugContainer.style.color = '#fff';
        this.debugContainer.style.fontSize = '10px';
        this.debugContainer.style.fontFamily = 'monospace';
        this.debugContainer.style.display = 'none'; // Hidden by default
        this.container.appendChild(this.debugContainer);
        
        // Add resize listener
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // Show initial message
        this.showMessage('Select data to display track visualization');
    }
    
    /**
     * Handle window resize
     */
    handleResize() {
        this.canvas.width = this.container.clientWidth;
        this.canvas.height = this.container.clientHeight;
        
        if (this.error) {
            this.showError(this.error);
        } else if (this.isLoading) {
            this.showLoading();
        } else if (this.trackData) {
            this.render();
        } else {
            this.showMessage('Select data to display track visualization');
        }
    }
    
    /**
     * Display a message on the canvas
     */
    showMessage(message) {
        const { ctx, canvas } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(message, canvas.width / 2, canvas.height / 2);
    }
    
    /**
     * Debug helper method
     */
    debug(message) {
        console.log(`[TrackVisualizer] ${message}`);
        
        // Add to debug container
        const line = document.createElement('div');
        line.textContent = message;
        this.debugContainer.appendChild(line);
        
        // Limit to 10 lines
        while (this.debugContainer.children.length > 10) {
            this.debugContainer.removeChild(this.debugContainer.firstChild);
        }
    }
    
    /**
     * Toggle debug display
     */
    toggleDebug() {
        if (this.debugContainer.style.display === 'none') {
            this.debugContainer.style.display = 'block';
        } else {
            this.debugContainer.style.display = 'none';
        }
    }
    
    /**
     * Load track data
     * @param {number} year - Season year
     * @param {number} round - Race round
     */
    async loadTrack(year, round) {
        try {
            // Prevent multiple loads
            if (this.isLoading) return;
            
            this.isLoading = true;
            this.error = null;
            this.trackData = null;
            
            // Show loading indicator
            this.showLoading();
            
            console.log(`Loading track data for year=${year}, round=${round}`);
            
            // Fetch track data from API using our API client
            const trackData = await F1DashAPI.getTrackData(year, round);
            
            // Check if we have valid coordinates
            if (!trackData.coordinates || 
                !trackData.coordinates.x || 
                !trackData.coordinates.y || 
                trackData.coordinates.x.length === 0) {
                throw new Error('Track data is unavailable or incomplete');
            }
            
            console.log(`Track data loaded: ${trackData.circuit_name}`);
            console.log(`Coordinates: ${trackData.coordinates.x.length} points`);
            console.log(`Sector boundaries: ${trackData.sector_boundaries.length}`);
            
            this.trackData = trackData;
            this.isLoading = false;
            this.render();
            
            return true;
        } catch (error) {
            console.error('Error loading track:', error);
            this.error = error.message;
            this.showError(error.message);
            this.isLoading = false;
            
            return false;
        }
    }
    
    /**
     * Set comparison data for track visualization
     * @param {Object} data - Driver comparison data
     */
    setComparisonData(data) {
        if (!data) {
            console.warn('No comparison data provided');
            return;
        }
        
        console.log(`Setting comparison data:`, data);
        
        this.comparisonData = data;
        
        // Determine colors for each sector based on which driver is faster
        if (data && data.delta) {
            const { driver1, driver2, delta } = data;
            
            // Make sure we have valid colors for both drivers
            const driver1Color = driver1.color || '#e10600';  // Default to F1 red if no color
            const driver2Color = driver2.color || '#3366ff';  // Default to blue if no color
            
            console.log(`Driver colors: driver1=${driver1Color}, driver2=${driver2Color}`);
            console.log(`Delta values: S1=${delta.sector1}, S2=${delta.sector2}, S3=${delta.sector3}`);
            
            this.sectorColors = [
                delta.sector1 < 0 ? driver1Color : driver2Color,
                delta.sector2 < 0 ? driver1Color : driver2Color,
                delta.sector3 < 0 ? driver1Color : driver2Color
            ];
            
            console.log(`Sector colors set:`, this.sectorColors);
        }
        
        this.render();
    }

    setSingleDriverColor(color) {
        this.singleDriverColor = color || '#e10600';
        this.comparisonData = null;
        this.render();
    }
    
    /**
     * Render the track visualization
     */
    render() {
        const { ctx, canvas } = this;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // If no track data, show message and return
        if (!this.trackData) {
            this.showMessage('Track data not available');
            return;
        }
        
        const { coordinates, sector_boundaries, circuit_name } = this.trackData;
        
        // Draw track title
        ctx.font = 'bold 14px Inter, Arial';
        ctx.fillStyle = '#90909880';
        ctx.textAlign = 'center';
        ctx.fillText(circuit_name, canvas.width / 2, 25);
        
        // Skip if no coordinates
        if (!coordinates || !coordinates.x || !coordinates.y || coordinates.x.length === 0) {
            this.showMessage('Track layout data not available');
            return;
        }
        
        // Find boundaries for scaling
        const minX = Math.min(...coordinates.x);
        const maxX = Math.max(...coordinates.x);
        const minY = Math.min(...coordinates.y);
        const maxY = Math.max(...coordinates.y);
        
        // Calculate scale factors with padding
        const padding = 60; // More padding so track spreads across canvas
        const scaleX = (canvas.width - 2 * padding) / (maxX - minX || 1);
        const scaleY = (canvas.height - 2 * padding) / (maxY - minY || 1);
        const scale = Math.min(scaleX, scaleY);
        
        // Calculate centering offsets
        const offsetX = (canvas.width - scale * (maxX - minX)) / 2 - scale * minX;
        const offsetY = (canvas.height - scale * (maxY - minY)) / 2 - scale * minY;
        
        // Transform coordinate to canvas space
        const transformX = x => x * scale + offsetX;
        const transformY = y => y * scale + offsetY;
        
        // Map sector boundaries to canvas coordinates
        const sectorPoints = [];
        
        // Add start/finish line as the first boundary (sector 0)
        sectorPoints.push({
            sector: 0,
            x: transformX(coordinates.x[0]),
            y: transformY(coordinates.y[0])
        });
        
        // Add sector boundaries
        if (sector_boundaries && sector_boundaries.length > 0) {
            sector_boundaries.forEach(boundary => {
                sectorPoints.push({
                    sector: boundary.sector,
                    x: transformX(boundary.x),
                    y: transformY(boundary.y)
                });
            });
        } else {
            // If no sector boundaries, create approximate ones
            const len = coordinates.x.length;
            sectorPoints.push(
                {
                    sector: 1,
                    x: transformX(coordinates.x[Math.floor(len * 0.33)]),
                    y: transformY(coordinates.y[Math.floor(len * 0.33)])
                },
                {
                    sector: 2,
                    x: transformX(coordinates.x[Math.floor(len * 0.66)]),
                    y: transformY(coordinates.y[Math.floor(len * 0.66)])
                }
            );
        }
        
        // Sort sector points by sector number
        sectorPoints.sort((a, b) => a.sector - b.sector);
        
        // Find the indices of track points closest to sector boundaries
        const sectorIndices = sectorPoints.map(point => {
            return coordinates.x.reduce((closest, _, index) => {
                const distance = Math.sqrt(
                    Math.pow(transformX(coordinates.x[index]) - point.x, 2) +
                    Math.pow(transformY(coordinates.y[index]) - point.y, 2)
                );
                
                if (distance < closest.distance) {
                    return { index, distance };
                }
                return closest;
            }, { index: 0, distance: Infinity }).index;
        });
        
        // Draw track as a single path first (base layer)
        ctx.beginPath();
        ctx.strokeStyle = '#222222';
        ctx.lineWidth = 5; // Thin background track
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Draw the full track
        ctx.moveTo(transformX(coordinates.x[0]), transformY(coordinates.y[0]));
        for (let i = 1; i < coordinates.x.length; i++) {
            ctx.lineTo(transformX(coordinates.x[i]), transformY(coordinates.y[i]));
        }
        
        // Close the loop if it's not already closed
        if (Math.abs(coordinates.x[0] - coordinates.x[coordinates.x.length - 1]) > 0.1 ||
            Math.abs(coordinates.y[0] - coordinates.y[coordinates.y.length - 1]) > 0.1) {
            ctx.lineTo(transformX(coordinates.x[0]), transformY(coordinates.y[0]));
        }
        
        ctx.stroke();
        
        // Now draw each sector with its color
        for (let sector = 0; sector < 3; sector++) {
            const startIdx = sectorIndices[sector];
            const endIdx = sector < 2 ? sectorIndices[sector + 1] : sectorIndices[0];
            
            ctx.beginPath();
            // Determine color for the sector
        let sectorStrokeColor;
        if (this.comparisonData) {
            sectorStrokeColor = this.sectorColors[sector];
        } else {
            sectorStrokeColor = this.singleDriverColor; // Use single driver color for all sectors
        }
        ctx.strokeStyle = sectorStrokeColor;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            // Move to first point
            ctx.moveTo(
                transformX(coordinates.x[startIdx]),
                transformY(coordinates.y[startIdx])
            );
            
            // Draw the sector
            if (startIdx < endIdx) {
                // Normal case: start index is before end index
                for (let i = startIdx + 1; i < endIdx; i++) {
                    ctx.lineTo(
                        transformX(coordinates.x[i]),
                        transformY(coordinates.y[i])
                    );
                }
                ctx.lineTo(
                    transformX(coordinates.x[endIdx]),
                    transformY(coordinates.y[endIdx])
                );
            } else {
                // Edge case: sector wraps around the track
                // First draw from start to end of array
                for (let i = startIdx + 1; i < coordinates.x.length; i++) {
                    ctx.lineTo(
                        transformX(coordinates.x[i]),
                        transformY(coordinates.y[i])
                    );
                }
                // Then draw from beginning of array to end index
                for (let i = 0; i <= endIdx; i++) {
                    ctx.lineTo(
                        transformX(coordinates.x[i]),
                        transformY(coordinates.y[i])
                    );
                }
            }
            
            ctx.stroke();
        }
        
        // Draw sector markers
        ctx.font = '11px Inter, Arial';
        ctx.fillStyle = '#909098';
        ctx.textAlign = 'center';
        
        sectorPoints.forEach((point, index) => {
            if (index > 0) { // Skip start/finish point for sector markers
                ctx.beginPath();
                ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillText(`S${point.sector}`, point.x, point.y - 8);
            }
        });
        
        // Draw start/finish line
        const startX = sectorPoints[0].x;
        const startY = sectorPoints[0].y;
        ctx.beginPath();
        ctx.fillStyle = '#ffffff';
        ctx.arc(startX, startY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText('Start/Finish', startX, startY - 8);
        
        // Draw legend if comparison data exists
        if (this.comparisonData) {
            const { driver1, driver2 } = this.comparisonData;
            
            // Legend background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(10, 40, 250, 70);
            
            // Driver 1 info
            ctx.fillStyle = driver1.color || '#e10600';
            ctx.fillRect(20, 50, 20, 20);
            ctx.fillStyle = '#ffffff';
            ctx.font = '14px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`${driver1.code} - ${driver1.team}`, 50, 65);
            
            // Driver 2 info
            ctx.fillStyle = driver2.color || '#3366ff';
            ctx.fillRect(20, 80, 20, 20);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`${driver2.code} - ${driver2.team}`, 50, 95);
        }
    }
    
    /**
     * Show loading indicator
     */
    showLoading() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.font = '14px Arial';
        this.ctx.fillStyle = '#ffffff';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Loading track data...', this.canvas.width / 2, this.canvas.height / 2);
        
        // Show loading spinner
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2 + 30;
        const radius = 15;
        
        this.ctx.fillStyle = '#e10600';
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius * 0.8, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    /**
     * Show error message
     * @param {string} message - Error message to display
     */
    showError(message) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.font = '14px Arial';
        this.ctx.fillStyle = '#ff3333';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`Error: ${message}`, this.canvas.width / 2, this.canvas.height / 2);
    }
}

export default TrackVisualizer; 