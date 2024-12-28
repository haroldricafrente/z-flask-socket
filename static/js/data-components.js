// Declare updateChart as a global variable for both charts
let updateChestnutChart = null;
let updateMilkyChart = null;

// Establish the Socket.IO connection
const initializeSocketConnection = () => {
    const socket = io();

    // Listen for Milky Mushroom sensor update events
    socket.on('milky_update', function (data) {
        if (!data.sensor_type || data.sensor_type !== 'milky_mushroom') {
            console.warn('Missing sensor type in data or wrong sensor type:', data);
            return;
        }

        console.log('Received Milky Mushroom data:', data);
        updateSensorData(data, 'milky_mushroom');
    });

    // Listen for Chestnut sensor update events
    socket.on('chestnut_update', function (data) {
        if (!data.sensor_type || data.sensor_type !== 'chestnut') {
            console.warn('Missing sensor type in data or wrong sensor type:', data);
            return;
        }

        console.log('Received Chestnut data:', data);
        updateSensorData(data, 'chestnut');
    });

    // Optional: handle reconnection
    socket.on('reconnect', () => {
        console.log('Reconnected to the server');
    });

    socket.on('reconnect_error', () => {
        console.error('Reconnection failed');
        alert('Connection failed. Please check your network and try again.');
    });

    return socket;
};

// Chart.js Setup for Chestnut and Milky Mushroom
const initializeChart = (sensorType) => {
    const canvas = document.getElementById(`${sensorType}Chart`);
    let sensorChart = null;
    let chartData = null;

    // Function to update the chart with new data
    const updateChart = (timestamp, temperature, humidity, soilMoisture, lightIntensity) => {
        if (!sensorChart) return;

        const maxDataPoints = 10; // Keep the chart manageable

        // Add new timestamp and data points
        chartData.labels.push(timestamp);
        chartData.datasets[0].data.push(temperature); // Temperature dataset
        chartData.datasets[1].data.push(humidity);    // Humidity dataset
        chartData.datasets[2].data.push(soilMoisture); // Soil Moisture dataset
        chartData.datasets[3].data.push(lightIntensity); // Light Intensity dataset

        // Maintain a fixed number of data points
        if (chartData.labels.length > maxDataPoints) {
            chartData.labels.shift();
            chartData.datasets.forEach(dataset => dataset.data.shift());
        }

        sensorChart.update();
    };

    if (canvas) {
        const ctx = canvas.getContext('2d');
        chartData = {
            labels: [], // Timestamps
            datasets: [
                {
                    label: 'Temperature (°C)',
                    data: [],
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderWidth: 1,
                    tension: 0.4
                },
                {
                    label: 'Humidity (%)',
                    data: [],
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderWidth: 1,
                    tension: 0.4
                },
                {
                    label: 'Soil Moisture (%)',
                    data: [],
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderWidth: 1,
                    tension: 0.4
                },
                {
                    label: 'Light Intensity (lx)',
                    data: [],
                    borderColor: 'rgba(153, 102, 255, 1)',
                    backgroundColor: 'rgba(153, 102, 255, 0.2)',
                    borderWidth: 1,
                    tension: 0.4
                }
            ]
        };

        sensorChart = new Chart(ctx, {
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

        if (sensorType === 'milky_mushroom') {
            updateMilkyChart = updateChart; // Assign the chart update function for milky_mushroom
        } else if (sensorType === 'chestnut') {
            updateChestnutChart = updateChart; // Assign the chart update function for chestnut
        }
    } else {
        console.log('No chart element found on this page.');
    }
};

// Function to update the sensor data in the HTML
const updateSensorData = (data, sensorType) => {
    const temperature = data.temperature || 'N/A';
    const humidity = data.humidity || 'N/A';
    const soilMoisture = data.soilMoisture || 'N/A';
    const lightIntensity = data.lightIntensity || 'N/A';

    const temperatureElement = document.getElementById(`temperature-${sensorType}`);
    const humidityElement = document.getElementById(`humidity-${sensorType}`);
    const soilMoistureElement = document.getElementById(`soilMoisture-${sensorType}`);
    const lightIntensityElement = document.getElementById(`lightIntensity-${sensorType}`);

    if (temperatureElement) temperatureElement.innerText = `${temperature} °C`;
    if (humidityElement) humidityElement.innerText = `${humidity} %`;
    if (soilMoistureElement) soilMoistureElement.innerText = `${soilMoisture} %`;
    if (lightIntensityElement) lightIntensityElement.innerText = `${lightIntensity} lx`;

    if (temperature !== 'N/A' && humidity !== 'N/A' && soilMoisture !== 'N/A' && lightIntensity !== 'N/A') {
        if (sensorType === 'milky_mushroom' && updateMilkyChart) {
            updateMilkyChart(new Date().toLocaleTimeString(), temperature, humidity, soilMoisture, lightIntensity);
        } else if (sensorType === 'chestnut' && updateChestnutChart) {
            updateChestnutChart(new Date().toLocaleTimeString(), temperature, humidity, soilMoisture, lightIntensity);
        }
    }
};

// Initialization for both sensors
const initializeDataComponents = () => {
    initializeChart('milky_mushroom');
    initializeChart('chestnut');
    initializeSocketConnection();
};

// Call initialization
initializeDataComponents();
