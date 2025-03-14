// Declare updateChart functions as global variables for all mushroom types
let updateChestnutChart = null;
let updateMilkyMushroomChart = null;
let updateReishiChart = null;
let updateShiitakeChart = null;
let updateWhiteOysterChart = null;

// Utility function to validate incoming data
const validateData = (data) => {
    const requiredFields = ['temperature', 'humidity', 'soilMoisture', 'lightIntensity', 'ECO2'];
    return requiredFields.every(field => field in data && data[field] !== null && data[field] !== undefined);
};

// Function to get the correct unit
const getUnit = (key) => {
    return key === 'temperature' ? '°C' :
           key === 'ECO2' ? 'PPM' :
           key === 'lightIntensity' ? 'lx' : '%';
};

// Assign the appropriate updateChart function based on sensor type
const assignUpdateChart = (sensorType, updateFunction) => {
    if (sensorType === 'milky-mushroom') updateMilkyMushroomChart = updateFunction;
    else if (sensorType === 'chestnut') updateChestnutChart = updateFunction;
    else if (sensorType === 'reishi') updateReishiChart = updateFunction;
    else if (sensorType === 'shiitake') updateShiitakeChart = updateFunction;
    else if (sensorType === 'white-oyster') updateWhiteOysterChart = updateFunction;

    console.log(`✅ Assigned updateChart for ${sensorType}`);
};


// Establish the Socket.IO connection
const initializeSocketConnection = () => {
    // const socket = io();
    const protocol = window.location.protocol === "https:" ? "https" : "http";
    const socketUrl = window.location.hostname === "iotmushkin.homes" ? `${protocol}://iotmushkin.homes` : `${protocol}://52.64.254.252`;

    const socket = io(socketUrl, { transports: ["websocket", "polling"] });

    const handleSensorUpdate = (data) => {
        if (!data.sensor_type) return;
    
        const sensorType = data.sensor_type.replace('_', '-');
        
        // Check if any data element exists on the page before proceeding
        const hasDataElement = document.getElementById(`temperature-${sensorType}`) ||
                               document.getElementById(`humidity-${sensorType}`) ||
                               document.getElementById(`carbonDioxide-${sensorType}`) ||
                               document.getElementById(`soilMoisture-${sensorType}`) ||
                               document.getElementById(`lightIntensity-${sensorType}`);
    
        if (!hasDataElement) {
            return;  // Stop execution if no related data element is found
        }
    
        console.log(`📡 Handling ${sensorType} update:`, data);
    
        if (!validateData(data)) {
            console.warn(`⚠️ Incomplete data received for ${sensorType}:`, data);
            return;
        }
    
        updateSensorData(data, sensorType);
    };
    
    

    socket.on('milky_mushroom_update', handleSensorUpdate);
    socket.on('chestnut_update', handleSensorUpdate);
    socket.on('reishi_update', handleSensorUpdate);
    socket.on('shiitake_update', handleSensorUpdate);
    socket.on('white_oyster_update', handleSensorUpdate);

    socket.on('reconnect', () => console.log('🔄 Reconnected to the server'));
    socket.on('reconnect_error', () => {
        console.error('❌ Reconnection failed');
        alert('⚠️ Connection failed. Please check your network and try again.');
    });

    return socket;
};

// Chart.js Setup
const initializeChart = (sensorType) => {
    console.log(`📊 Attempting to initialize chart for: ${sensorType}`);

    const canvasId = `${sensorType}-Chart`;
    const canvas = document.getElementById(canvasId);

    if (!canvas) {
        console.warn(`⚠️ No chart element found for sensor type: ${sensorType} (Expected ID: ${canvasId})`);
        return;
    }

    console.log(`✅ Found canvas element for ${sensorType}`);

    const ctx = canvas.getContext('2d');
    const maxDataPoints = 10;
    const chartData = {
        labels: [],
        datasets: [
            { label: 'Temperature (°C)', data: [], borderColor: 'rgba(255, 99, 132, 1)', backgroundColor: 'rgba(255, 99, 132, 0.2)', borderWidth: 1, tension: 0.4, fill: true },
            { label: 'Humidity (%)', data: [], borderColor: 'rgba(54, 162, 235, 1)', backgroundColor: 'rgba(54, 162, 235, 0.2)', borderWidth: 1, tension: 0.4, fill: true },
            { label: 'Soil Moisture (%)', data: [], borderColor: 'rgba(75, 192, 192, 1)', backgroundColor: 'rgba(75, 192, 192, 0.2)', borderWidth: 1, tension: 0.4, fill: true },
            { label: 'Light Intensity (lx)', data: [], borderColor: 'rgba(153, 102, 255, 1)', backgroundColor: 'rgba(153, 102, 255, 0.2)', borderWidth: 1, tension: 0.4, fill: true },
            { label: 'ECO2 (ppm)', data: [], borderColor: 'rgba(255, 159, 64, 1)', backgroundColor: 'rgba(255, 159, 64, 0.2)', borderWidth: 1, tension: 0.4, fill: true }
        ]
    };

    const sensorChart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            plugins: {
                legend: { display: true, position: 'top' }
            },
            scales: {
                x: { title: { display: true, text: 'Time' } },
                y: { title: { display: true, text: 'Value' }, beginAtZero: true }
            }
        }
    });

    // Debug: Log the chart instance
    console.log(`✅ Chart instance for ${sensorType}:`, sensorChart);

    assignUpdateChart(sensorType, (timestamp, ...values) => {
        console.log(`📊 Updating chart for ${sensorType} at ${timestamp}`);
        chartData.labels.push(timestamp);
        chartData.datasets.forEach((dataset, index) => dataset.data.push(values[index]));
        if (chartData.labels.length > maxDataPoints) {
            chartData.labels.shift();
            chartData.datasets.forEach(dataset => dataset.data.shift());
        }
        sensorChart.update();
    });
};


// Update sensor data in HTML
// Update sensor data in HTML
const updateSensorData = (data, sensorType) => {
    console.log(`🔄 Updating ${sensorType} sensor data:`, data);

    ['temperature', 'humidity', 'soilMoisture', 'lightIntensity', 'ECO2'].forEach(key => {
        const elementId = `${key}-${sensorType}`;
        const element = document.getElementById(elementId);
        if (element) element.innerText = `${data[key] ?? "N/A"} ${getUnit(key)}`;
    });

    const timestamp = new Date().toLocaleTimeString();

    // ✅ Properly map function names
    let updateFunction;
    if (sensorType === "milky-mushroom") updateFunction = updateMilkyMushroomChart;
    else if (sensorType === "chestnut") updateFunction = updateChestnutChart;
    else if (sensorType === "reishi") updateFunction = updateReishiChart;
    else if (sensorType === "shiitake") updateFunction = updateShiitakeChart;
    else if (sensorType === "white-oyster") updateFunction = updateWhiteOysterChart;

    if (typeof updateFunction === "function") {
        console.log(`📊 Updating chart for ${sensorType} at ${timestamp}`);
        updateFunction(timestamp, data.temperature, data.humidity, data.soilMoisture, data.lightIntensity, data.ECO2);
    } else {
        console.warn(`⚠️ updateChart function is not defined for ${sensorType}`);
    }
};



// Initialize charts & socket connection
const initializeDataComponents = () => {
    ['milky-mushroom', 'chestnut', 'reishi', 'shiitake', 'white-oyster'].forEach(initializeChart);
    initializeSocketConnection();

    console.log("🔍 Checking available canvas elements...");
    document.querySelectorAll("canvas").forEach(el => console.log(`✅ Found chart: ${el.id}`));
};

if (window.location.hostname !== "localhost") {
    console.log = function () {};
    console.warn = function () {};
    console.error = function () {};
}

initializeDataComponents();
