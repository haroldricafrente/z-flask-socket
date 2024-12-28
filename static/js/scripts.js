document.addEventListener('DOMContentLoaded', function () {
    // Initialize Socket.IO client
    const socket = io();

    // Chart.js Setup
    const canvas = document.getElementById('sensorChart');
    let sensorChart = null;
    let chartData = null;

    // Function to update the chart with new data
    const updateChart = (timestamp, temperature, humidity, soilMoisture, lightIntensity) => {
        if (!sensorChart) {
            
            return;
        }

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
    } else {
        console.log('No chart element found on this page.');
    }

    // Function to update the sensor data in the HTML
    const updateSensorData = (data) => {
        const sensorType = data.sensor_type;

        // Validate data fields
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
            updateChart(new Date().toLocaleTimeString(), temperature, humidity, soilMoisture, lightIntensity);
        }
    };

    // Consolidated Socket.IO event listener
    socket.on('sensor_update', function (data) {
        if (!data.sensor_type) {
            console.warn('Missing sensor type in data:', data);
            return;
        }

        console.log('Received data:', data);
        updateSensorData(data);
    });

    // Optional: handle reconnection
    socket.on('reconnect', () => {
        console.log('Reconnected to the server');
    });

    socket.on('reconnect_error', () => {
        console.error('Reconnection failed');
        alert('Connection failed. Please check your network and try again.');
    });

    // Sidebar Dropdown Functionality
    const allDropdown = document.querySelectorAll('#sidebar .side-dropdown');
    const sidebar = document.getElementById('sidebar');

    allDropdown.forEach(item => {
        const a = item.parentElement.querySelector('a:first-child');
        a.addEventListener('click', function (e) {
            e.preventDefault();

            if (!this.classList.contains('active')) {
                allDropdown.forEach(i => {
                    const aLink = i.parentElement.querySelector('a:first-child');
                    aLink.classList.remove('active');
                    i.classList.remove('show');
                })
            }

            this.classList.toggle('active');
            item.classList.toggle('show');
        })
    });

    // Sidebar Collapse Functionality
    const toggleSidebar = document.querySelector('nav .toggle-sidebar');
    const allSideDivider = document.querySelectorAll('#sidebar .divider');

    if (sidebar.classList.contains('hide')) {
        allSideDivider.forEach(item => {
            item.textContent = '-';
        });
        allDropdown.forEach(item => {
            const a = item.parentElement.querySelector('a:first-child');
            a.classList.remove('active');
            item.classList.remove('show');
        });
    } else {
        allSideDivider.forEach(item => {
            item.textContent = item.dataset.text;
        });
    }

    toggleSidebar.addEventListener('click', function () {
        sidebar.classList.toggle('hide');

        if (sidebar.classList.contains('hide')) {
            allSideDivider.forEach(item => {
                item.textContent = '-';
            });

            allDropdown.forEach(item => {
                const a = item.parentElement.querySelector('a:first-child');
                a.classList.remove('active');
                item.classList.remove('show');
            });
        } else {
            allSideDivider.forEach(item => {
                item.textContent = item.dataset.text;
            });
        }
    });

    sidebar.addEventListener('mouseleave', function () {
        if (this.classList.contains('hide')) {
            allDropdown.forEach(item => {
                const a = item.parentElement.querySelector('a:first-child');
                a.classList.remove('active');
                item.classList.remove('show');
            });
            allSideDivider.forEach(item => {
                item.textContent = '-';
            });
        }
    });

    sidebar.addEventListener('mouseenter', function () {
        if (this.classList.contains('hide')) {
            allDropdown.forEach(item => {
                const a = item.parentElement.querySelector('a:first-child');
                a.classList.remove('active');
                item.classList.remove('show');
            });
            allSideDivider.forEach(item => {
                item.textContent = item.dataset.text;
            });
        }
    });

    // Profile Dropdown Functionality
    const profile = document.querySelector('nav .profile');
    const imgProfile = profile.querySelector('img');
    const dropdownProfile = profile.querySelector('.profile-link');

    imgProfile.addEventListener('click', function () {
        dropdownProfile.classList.toggle('show');
    });

    // Menu Toggle Functionality
    const allMenu = document.querySelectorAll('main .content-data .head .menu, main .content-data-mushroom .head .menu ');

    allMenu.forEach(item => {
        const icon = item.querySelector('.icon');
        const menuLink = item.querySelector('.menu-link');

        icon.addEventListener('click', function () {
            menuLink.classList.toggle('show');
        })
    });

    window.addEventListener('click', function (e) {
        if (e.target !== imgProfile) {
            if (e.target !== dropdownProfile) {
                if (dropdownProfile.classList.contains('show')) {
                    dropdownProfile.classList.remove('show');
                }
            }
        }

        allMenu.forEach(item => {
            const icon = item.querySelector('.icon');
            const menuLink = item.querySelector('.menu-link');

            if (e.target !== icon) {
                if (e.target !== menuLink) {
                    if (menuLink.classList.contains('show')) {
                        menuLink.classList.remove('show');
                    }
                }
            }
        })
    });
});
