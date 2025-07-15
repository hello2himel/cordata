// PolygonCalculator class ported from Python to JavaScript
class PolygonCalculator {
    static calculateArea(coordinates) {
        if (coordinates.length < 3) {
            throw new Error("At least 3 points are required to form a polygon.");
        }

        // Shoelace formula implementation
        const coords = [...coordinates, coordinates[0]]; // Close the polygon
        let area = 0;
        for (let i = 0; i < coords.length - 1; i++) {
            const [x0, y0] = coords[i];
            const [x1, y1] = coords[i + 1];
            area += (x0 * y1) - (x1 * y0);
        }

        return Math.abs(area) / 2;
    }

    static calculatePerimeter(coordinates) {
        if (coordinates.length < 2) {
            return 0;
        }

        let perimeter = 0;
        const n = coordinates.length;
        for (let i = 0; i < n; i++) {
            const [x1, y1] = coordinates[i];
            const [x2, y2] = coordinates[(i + 1) % n];
            const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
            perimeter += distance;
        }

        return perimeter;
    }

    static calculateCentroid(coordinates) {
        if (!coordinates.length) {
            return [0, 0];
        }

        if (coordinates.length < 3) {
            // Return average of points for 1 or 2 points
            const xSum = coordinates.reduce((sum, [x, _]) => sum + x, 0);
            const ySum = coordinates.reduce((sum, [_, y]) => sum + y, 0);
            return [xSum / coordinates.length, ySum / coordinates.length];
        }

        // Close the polygon for calculation
        const coords = [...coordinates, coordinates[0]];
        let area = 0;
        let cx = 0;
        let cy = 0;

        for (let i = 0; i < coords.length - 1; i++) {
            const [x0, y0] = coords[i];
            const [x1, y1] = coords[i + 1];
            const a = (x0 * y1) - (x1 * y0);
            area += a;
            cx += (x0 + x1) * a;
            cy += (y0 + y1) * a;
        }

        area = Math.abs(area) / 2;
        if (area === 0) {
            // If area is zero, return average
            const xSum = coordinates.reduce((sum, [x, _]) => sum + x, 0);
            const ySum = coordinates.reduce((sum, [_, y]) => sum + y, 0);
            return [xSum / coordinates.leng, ySum / coordinates.length];
        }

        // Factor of 6 for centroid formula
        cx = Math.abs(cx / (6 * area));
        cy = Math.abs(cy / (6 * area));

        return [cx, cy];
    }

    static getBounds(coordinates, paddingPercent = 10) {
        if (!coordinates.length) {
            return [-10, 10, -10, 10];
        }

        const minX = Math.min(...coordinates.map(([x, _]) => x));
        const maxX = Math.max(...coordinates.map(([x, _]) => x));
        const minY = Math.min(...coordinates.map(([_, y]) => y));
        const maxY = Math.max(...coordinates.map(([_, y]) => y));

        // Add padding
        const paddingX = Math.max(0.1, (maxX - minX) * paddingPercent / 100);
        const paddingY = Math.max(0.1, (maxY - minY) * paddingPercent / 100);

        let finalMinX = minX - paddingX;
        let finalMaxX = maxX + paddingX;
        let finalMinY = minY - paddingY;
        let finalMaxY = maxY + paddingY;

        // Handle the case where min and max are the same
        if (finalMinX === finalMaxX) {
            finalMinX -= 1;
            finalMaxX += 1;
        }
        if (finalMinY === finalMaxY) {
            finalMinY -= 1;
            finalMaxY += 1;
        }

        return [finalMinX, finalMaxX, finalMinY, finalMaxY];
    }

    static findNiceInterval(rangeVal) {
        if (rangeVal <= 0) {
            return 1;
        }

        const magnitude = 10 ** Math.floor(Math.max(0, Math.min(10, Math.floor(Math.log10(rangeVal)))));

        if (rangeVal / magnitude < 2) {
            return magnitude / 5;
        } else if (rangeVal / magnitude < 5) {
            return magnitude / 2;
        } else {
            return magnitude;
        }
    }
}

// Global variables
let coordinates = [];
let canvas, ctx;
let isDarkTheme = false;
let calculationTimeout;

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize canvas
    canvas = document.getElementById('polygon-canvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();

    // Add event listeners
    document.getElementById('add-coordinate').addEventListener('click', addCoordinateRow);
    document.getElementById('calculate-btn').addEventListener('click', function () {
        calculatePolygon(false); // explicitly mark this as manual
    });

    document.getElementById('clear-btn').addEventListener('click', clearAll);
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    window.addEventListener('resize', resizeCanvas);

    // Add initial coordinate row
    addCoordinateRow();

    // Check for system theme preference first
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    if (prefersDarkScheme.matches) {
        toggleTheme();
    }

    // Then check for saved theme preference (overrides system preference)
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' && !isDarkTheme) {
        toggleTheme();
    } else if (savedTheme === 'light' && isDarkTheme) {
        toggleTheme();
    }
});

function resizeCanvas() {
    const container = document.getElementById('canvas-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    updatePreview();
}

function addCoordinateRow() {
    const container = document.getElementById('coordinates-container');
    const index = container.children.length + 1;

    const row = document.createElement('div');
    row.className = 'coordinate-row';
    row.innerHTML = `
        <div class="coordinate-label">Point ${index}:</div>
        <div class="coordinate-inputs">
            <div class="input-group">
                <div class="input-label">X:</div>
                <input type="number" step="any" class="coordinate-input x-input" data-index="${index - 1}" oninput="updateCoordinates(this)" onkeydown="handleKeydown(event, this)">
            </div>
            <div class="input-group">
                <div class="input-label">Y:</div>
                <input type="number" step="any" class="coordinate-input y-input" data-index="${index - 1}" oninput="updateCoordinates(this)" onkeydown="handleKeydown(event, this)">
            </div>
        </div>
        <button class="remove-btn" onclick="removeCoordinateRow(this)"><i class="ri-delete-bin-line"></i></button>
    `;

    container.appendChild(row);
    updateCoordinateIndices();

    // Add this coordinate to the array
    coordinates.push([null, null]);
    
    // Focus on the new X input
    const inputs = row.querySelectorAll('input');
    if (inputs.length > 0) {
        inputs[0].focus();
    }
}

function handleKeydown(event, input) {
    // Check if Enter key was pressed
    if (event.key === 'Enter') {
        event.preventDefault();
        
        // If this is an X input, move to the next Y input
        if (input.classList.contains('x-input')) {
            const yInput = input.parentElement.parentElement.querySelector('.y-input');
            if (yInput) {
                yInput.focus();
            } 
        } 
        // If this is a Y input, add a new row and focus on its X input
        else if (input.classList.contains('y-input')) {
            addCoordinateRow();
        }
    }
}

function removeCoordinateRow(button) {
    const row = button.parentElement;
    const container = row.parentElement;
    const index = Array.from(container.children).indexOf(row);

    // Remove the row
    container.removeChild(row);

    // Remove the corresponding coordinate
    coordinates.splice(index, 1);

    // Update indices
    updateCoordinateIndices();
    updatePreview();
    
    // Trigger live calculation
    triggerLiveCalculation();
}

function updateCoordinateIndices() {
    const rows = document.querySelectorAll('.coordinate-row');
    rows.forEach((row, index) => {
        const label = row.querySelector('.coordinate-label');
        label.textContent = `Point ${index + 1}:`;

        const xInput = row.querySelector('.x-input');
        const yInput = row.querySelector('.y-input');

        xInput.dataset.index = index;
        yInput.dataset.index = index;
    });
}

function updateCoordinates(input) {
    const index = parseInt(input.dataset.index);
    const value = input.value === '' ? null : parseFloat(input.value);

    if (input.classList.contains('x-input')) {
        if (coordinates[index]) {
            coordinates[index][0] = value;
        } else {
            coordinates[index] = [value, null];
        }
    } else if (input.classList.contains('y-input')) {
        if (coordinates[index]) {
            coordinates[index][1] = value;
        } else {
            coordinates[index] = [null, value];
        }
    }

    updatePreview();
    
    // Trigger live calculation with debounce
    triggerLiveCalculation();
}

function triggerLiveCalculation() {
    // Clear any existing timeout
    clearTimeout(calculationTimeout);
    
    // Set a new timeout to trigger calculation after 300ms of inactivity
    calculationTimeout = setTimeout(function() {
        calculatePolygon(true); // Pass true to indicate this is a live calculation
    }, 300);
}

function getValidCoordinates() {
    return coordinates.filter(coord => 
        coord[0] !== null && coord[1] !== null && 
        !isNaN(coord[0]) && !isNaN(coord[1])
    );
}

function clearAll() {
    const container = document.getElementById('coordinates-container');
    container.innerHTML = '';
    coordinates = [];
    addCoordinateRow();

    // Clear result and hide stats
    document.getElementById('area-stat').style.display = 'none';
    document.getElementById('perimeter-stat').style.display = 'none';
    document.getElementById('centroid-stat').style.display = 'none';

    // Update the preview
    updatePreview();
}

// Function to highlight statistics with animations
function highlightStatistics() {
    const statsContainer = document.getElementById('statistics-container');
    const areaStats = document.getElementById('area-stat');
    const perimeterStats = document.getElementById('perimeter-stat');
    const centroidStats = document.getElementById('centroid-stat');

    // Remove existing highlight classes to reset animations
    areaStats.classList.remove('highlight-stat');
    perimeterStats.classList.remove('highlight-stat');
    centroidStats.classList.remove('highlight-stat');
    
    // Trigger reflow to restart animations
    void areaStats.offsetWidth;
    void perimeterStats.offsetWidth;
    void centroidStats.offsetWidth;

    // Add highlight classes with sequential timing for better visual effect
    setTimeout(() => {
        areaStats.classList.add('highlight-stat');
    }, 0);

    setTimeout(() => {
        perimeterStats.classList.add('highlight-stat');
    }, 150);

    setTimeout(() => {
        centroidStats.classList.add('highlight-stat');
    }, 300);

    // Clean up animations after they're done
    setTimeout(() => {
        statsContainer.classList.remove('pulse-outline');
    }, 1800);
}

async function calculatePolygon(isLive = false) {
    const validCoords = getValidCoordinates();

    if (validCoords.length < 3) {
        // Hide stats if not enough points
        document.getElementById('area-stat').style.display = 'none';
        document.getElementById('perimeter-stat').style.display = 'none';
        document.getElementById('centroid-stat').style.display = 'none';
        
        // Only show error if not a live calculation
        if (!isLive) {
            showError('At least 3 points are required to form a polygon.');
        }
        return;
    }

    if (!isLive) {
        showSpinner(true);
    }

    try {
        // Perform calculations client-side
        const area = PolygonCalculator.calculateArea(validCoords);
        const perimeter = PolygonCalculator.calculatePerimeter(validCoords);
        const centroid = PolygonCalculator.calculateCentroid(validCoords);

        // Update area stat
        const areaStat = document.getElementById('area-stat');
        areaStat.textContent = `Area: ${area.toFixed(4)}`;
        areaStat.style.display = 'block';

        // Update perimeter stat
        const perimeterStat = document.getElementById('perimeter-stat');
        perimeterStat.textContent = `Perimeter: ${perimeter.toFixed(4)}`;
        perimeterStat.style.display = 'block';

        // Update centroid stat
        const centroidStat = document.getElementById('centroid-stat');
        centroidStat.textContent = `Centroid: (${centroid[0].toFixed(4)}, ${centroid[1].toFixed(4)})`;
        centroidStat.style.display = 'block';

        // Only highlight with full attention-grabbing animation if this is a manual calculation
        if (!isLive) {
            highlightStatistics();
        }

        updatePreview();
    } catch (error) {
        // Only show error if not a live calculation
        if (!isLive) {
            showError(error.message || 'An error occurred during calculation.');
            console.error(error);
        }
    } finally {
        if (!isLive) {
            showSpinner(false);
        }
    }
}

function showError(message) {
    const errorElement = document.getElementById('error-message');
    errorElement.textContent = message;
    errorElement.style.display = 'block';

    // Add highlight effect to error message to make it more noticeable
    errorElement.classList.add('highlight-stat');

    // Hide error after 5 seconds
    setTimeout(() => {
        errorElement.classList.remove('highlight-stat');
        errorElement.style.display = 'none';
    }, 5000);
}

function showSpinner(show) {
    document.getElementById('spinner').style.display = show ? 'block' : 'none';
}

async function updatePreview() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const validCoords = getValidCoordinates();

    if (validCoords.length === 0) {
        drawCoordinateSystem(-10, 10, -10, 10);
        return;
    }

    try {
        // Get bounds client-side
        const [min_x, max_x, min_y, max_y] = PolygonCalculator.getBounds(validCoords);

        // Draw coordinate system
        drawCoordinateSystem(min_x, max_x, min_y, max_y);

        // Draw points
        validCoords.forEach((coord, index) => {
            const [x, y] = coord;
            const canvasX = transformX(x, min_x, max_x);
            const canvasY = transformY(y, min_y, max_y);

            // Draw point
            ctx.beginPath();
            ctx.arc(canvasX, canvasY, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#ef4444';
            ctx.fill();
            ctx.strokeStyle = isDarkTheme ? '#222' : '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Draw label
            ctx.font = '10px Inter';
            ctx.fillStyle = isDarkTheme ? '#e5e5e5' : '#333';
            ctx.fillText(`${index + 1}: (${x.toFixed(1)}, ${y.toFixed(1)})`, canvasX + 6, canvasY - 6);
        });

        // Connect points with lines
        if (validCoords.length > 1) {
            ctx.beginPath();
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 2]);

            for (let i = 0; i < validCoords.length; i++) {
                const [x, y] = validCoords[i];
                const nextIndex = (i + 1) % validCoords.length;
                const [nextX, nextY] = validCoords[nextIndex];

                const canvasX = transformX(x, min_x, max_x);
                const canvasY = transformY(y, min_y, max_y);
                const nextCanvasX = transformX(nextX, min_x, max_x);
                const nextCanvasY = transformY(nextY, min_y, max_y);

                if (i === 0) {
                    ctx.moveTo(canvasX, canvasY);
                }
                ctx.lineTo(nextCanvasX, nextCanvasY);
            }

            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Draw polygon if there are at least 3 points
        if (validCoords.length >= 3) {
            ctx.beginPath();
            const [firstX, firstY] = validCoords[0];
            ctx.moveTo(
                transformX(firstX, min_x, max_x),
                transformY(firstY, min_y, max_y)
            );

            for (let i = 1; i < validCoords.length; i++) {
                const [x, y] = validCoords[i];
                ctx.lineTo(
                    transformX(x, min_x, max_x),
                    transformY(y, min_y, max_y)
                );
            }

            ctx.closePath();
            ctx.fillStyle = isDarkTheme ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)';
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 1.5;
            ctx.fill();
            ctx.stroke();

            // Draw centroid if available
            const centroidText = document.getElementById('centroid-stat').textContent;
            if (centroidText && document.getElementById('centroid-stat').style.display !== 'none') {
                const matches = centroidText.match(/\(([\d.-]+), ([\d.-]+)\)/);
                if (matches && matches.length >= 3) {
                    const centroidX = parseFloat(matches[1]);
                    const centroidY = parseFloat(matches[2]);

                    const canvasCentroidX = transformX(centroidX, min_x, max_x);
                    const canvasCentroidY = transformY(centroidY, min_y, max_y);

                    ctx.beginPath();
                    ctx.arc(canvasCentroidX, canvasCentroidY, 4, 0, Math.PI * 2);
                    ctx.fillStyle = '#10b981';
                    ctx.strokeStyle = isDarkTheme ? '#222' : '#fff';
                    ctx.lineWidth = 1;
                    ctx.fill();
                    ctx.stroke();
                }
            }
        }
    } catch (error) {
        console.error('Error updating preview:', error);
    }
}

function drawCoordinateSystem(min_x, max_x, min_y, max_y) {
    // Draw border
    ctx.strokeStyle = isDarkTheme ? '#333' : '#ddd';
    ctx.lineWidth = 1;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

    // Calculate range
    const range_x = max_x - min_x;
    const range_y = max_y - min_y;

    // Determine grid spacing
    const x_interval = PolygonCalculator.findNiceInterval(range_x);
    const y_interval = PolygonCalculator.findNiceInterval(range_y);

    // Draw grid lines
    ctx.strokeStyle = isDarkTheme ? '#333' : '#eee';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);

    // X grid lines
    let x_start = min_x - (min_x % x_interval);
    if (min_x < 0 && x_start < min_x) {
        x_start += x_interval;
    }

    for (let x = x_start; x <= max_x; x += x_interval) {
        if (min_x <= x && x <= max_x) {
            const canvas_x = transformX(x, min_x, max_x);

            // Vertical grid line
            ctx.beginPath();
            ctx.moveTo(canvas_x, 10);
            ctx.lineTo(canvas_x, canvas.height - 10);
            ctx.stroke();

            // X-axis label
            const label = Math.abs(x) < 0.0001 ? '0' : x.toFixed(1);
            ctx.font = '9px Inter';
            ctx.fillStyle = isDarkTheme ? '#888' : '#666';
            ctx.textAlign = 'center';
            ctx.fillText(label, canvas_x, canvas.height - 5);
        }
    }

    // Y grid lines
    let y_start = min_y - (min_y % y_interval);
    if (min_y < 0 && y_start < min_y) {
        y_start += y_interval;
    }

    for (let y = y_start; y <= max_y; y += y_interval) {
        if (min_y <= y && y <= max_y) {
            const canvas_y = transformY(y, min_y, max_y);

            // Horizontal grid line
            ctx.beginPath();
            ctx.moveTo(10, canvas_y);
            ctx.lineTo(canvas.width - 10, canvas_y);
            ctx.stroke();

            // Y-axis label
            const label = Math.abs(y) < 0.0001 ? '0' : y.toFixed(1);
            ctx.font = '9px Inter';
            ctx.fillStyle = isDarkTheme ? '#888' : '#666';
            ctx.textAlign = 'left';
            ctx.fillText(label, 5, canvas_y + 3);
        }
    }

    ctx.setLineDash([]);
}

function transformX(x, min_x, max_x) {
    const range_x = max_x - min_x;
    return 30 + ((x - min_x) / range_x) * (canvas.width - 60);
}

function transformY(y, min_y, max_y) {
    const range_y = max_y - min_y;
    // Flip y-coordinate since canvas has top-left origin
    return canvas.height - 30 - ((y - min_y) / range_y) * (canvas.height - 60);
}

function toggleTheme() {
    isDarkTheme = !isDarkTheme;

    // Update body class
    document.body.setAttribute('data-theme', isDarkTheme ? 'dark' : 'light');

    // Update toggle button
    const themeToggle = document.getElementById('theme-toggle');
    themeToggle.innerHTML = isDarkTheme ? '<i class="ri-sun-line"></i>' : '<i class="ri-moon-line"></i>';

    // Save preference
    localStorage.setItem('theme', isDarkTheme ? 'dark' : 'light');

    // Redraw canvas
    updatePreview();
}