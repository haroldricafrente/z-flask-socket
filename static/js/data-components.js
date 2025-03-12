// Declare updateChart functions as global variables for both charts
let updateChestnutChart = null;
let updateMilkyChart = null;

// Utility function to validate incoming data
const validateData = (data) => {
    const requiredFields = ['temperature', 'humidity', 'soilMoisture', 'lightIntensity', 'ECO2'];
    return requiredFields.every(field => field in data && data[field] !== null && data[field] !== undefined);
};

// Assign the appropriate updateChart function based on sensor type
const assignUpdateChart = (sensorType, updateFunction) => {
    if (sensorType === 'milky_mushroom') {
        updateMilkyChart = updateFunction;
    } else if (sensorType === 'chestnut') {
        updateChestnutChart = updateFunction;
    }
};

// Establish the Socket.IO connection
const initializeSocketConnection = () => {
    const socket = io();

    // Generalized event listener for sensor updates
    const handleSensorUpdate = (data, sensorType) => {
        console.log(`Handling ${sensorType} update:`, data);

        if (!data.sensor_type || data.sensor_type !== sensorType) {
            console.warn(`Missing or incorrect sensor type in data:`, data);
            return;
        }

        if (!validateData(data)) {
            console.warn(`Incomplete data received for ${sensorType}:`, data);
            return;
        }

        console.log(`Received ${sensorType} data:`, data);
        updateSensorData(data, sensorType);
    };

    // Listen for Milky Mushroom sensor update events
    socket.on('milky_mushroom_update', (data) => handleSensorUpdate(data, 'milky_mushroom'));


    // Listen for Chestnut sensor update events
    socket.on('chestnut_update', (data) => handleSensorUpdate(data, 'chestnut'));

    // Optional: handle reconnection
    socket.on('reconnect', () => console.log('Reconnected to the server'));
    socket.on('reconnect_error', () => {
        console.error('Reconnection failed');
        alert('Connection failed. Please check your network and try again.');
    });

    return socket;
};

// Chart.js Setup for Chestnut and Milky Mushroom
const initializeChart = (sensorType) => {
    const canvas = document.getElementById(`${sensorType}Chart`);
    if (!canvas) {
        console.warn(`No chart element found for sensor type: ${sensorType}`);
        return;
    }

    const ctx = canvas.getContext('2d');
    const maxDataPoints = 10; // Keep the chart manageable
    const chartData = {
        labels: [], // Timestamps
        datasets: [
            {
                label: 'Temperature (°C)',
                data: [],
                borderColor: 'rgba(255, 99, 132, 1)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                borderWidth: 1,
                tension: 0.4,
                fill: true
            },
            {
                label: 'Humidity (%)',
                data: [],
                borderColor: 'rgba(54, 162, 235, 1)',
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderWidth: 1,
                tension: 0.4,
                fill: true
            },
            {
                label: 'Soil Moisture (%)',
                data: [],
                borderColor: 'rgba(75, 192, 192, 1)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderWidth: 1,
                tension: 0.4,
                fill: true
            },
            {
                label: 'Light Intensity (lx)',
                data: [],
                borderColor: 'rgba(153, 102, 255, 1)',
                backgroundColor: 'rgba(153, 102, 255, 0.2)',
                borderWidth: 1,
                tension: 0.4,
                fill: true
            },
            {
                label: 'ECO2 (ppm)',
                data: [],
                borderColor: 'rgba(255, 159, 64, 1)',
                backgroundColor: 'rgba(255, 159, 64, 0.2)',
                borderWidth: 1,
                tension: 0.4,
                fill: true
            }
        ]
    };

    const sensorChart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Time'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Value'
                    },
                    beginAtZero: true
                }
            }
        }
    });

    // Function to update the chart with new data
    const updateChart = (timestamp, temperature, humidity, soilMoisture, lightIntensity, ECO2) => {
        chartData.labels.push(timestamp);
        chartData.datasets[0].data.push(temperature);
        chartData.datasets[1].data.push(humidity);
        chartData.datasets[2].data.push(soilMoisture);
        chartData.datasets[3].data.push(lightIntensity);
        chartData.datasets[4].data.push(ECO2);

        if (chartData.labels.length > maxDataPoints) {
            chartData.labels.shift();
            chartData.datasets.forEach(dataset => dataset.data.shift());
        }

        sensorChart.update();
    };

    assignUpdateChart(sensorType, updateChart);
};

// Function to get the correct unit for display
const getUnit = (key) => {
    return key === 'temperature' ? '°C' :
           key === 'ECO2' ? 'PPM' :
           key === 'lightIntensity' ? 'lx' : '%';
};

// Function to update the sensor data in the HTML
const updateSensorData = (data, sensorType) => {
    console.log(`Updating ${sensorType} sensor data:`, data);

    const elements = ['temperature', 'humidity', 'soilMoisture', 'lightIntensity', 'ECO2'];
    elements.forEach(key => {
        const elementId = `${key}-${sensorType.replace('_', '-')}`; // Convert _ to - for ID consistency
        const element = document.getElementById(elementId);
        if (element) {
            element.innerText = `${data[key] ?? "N/A"} ${getUnit(key)}`;
        } else {
            console.warn(`Element not found: ${elementId}`);
        }
    });

    // Chestnut Mushroom Humidity Warning
    if (sensorType === 'chestnut' && (data.humidity < 80 || data.humidity > 100)) {
        createNotification('Warning: Humidity for Chestnut Mushroom is not optimal! Please check the environment.');
    }

    // Validate data before updating charts
    if (validateData(data)) {
        const timestamp = new Date().toLocaleTimeString();
        if (sensorType === 'milky_mushroom' && typeof updateMilkyChart === 'function') {
            updateMilkyChart(timestamp, data.temperature, data.humidity, data.soilMoisture, data.lightIntensity, data.ECO2);
        } else if (sensorType === 'chestnut' && typeof updateChestnutChart === 'function') {
            updateChestnutChart(timestamp, data.temperature, data.humidity, data.soilMoisture, data.lightIntensity, data.ECO2);
        }
    }
};


// Initialization for both sensors
const initializeDataComponents = () => {
    initializeChart('milky_mushroom');
    initializeChart('chestnut');
    initializeSocketConnection();
};

initializeDataComponents();
