document.addEventListener('DOMContentLoaded', function () {
    // Initialize Socket.IO client
    const socket = io();

    // Utility Functions
    const toggleClass = (element, className) => {
        element.classList.toggle(className);
    };

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

        if (temperatureElement) temperatureElement.innerText = temperature + ' °C';
        if (humidityElement) humidityElement.innerText = humidity + ' %';
        if (soilMoistureElement) soilMoistureElement.innerText = soilMoisture + ' %';
        if (lightIntensityElement) lightIntensityElement.innerText = lightIntensity + ' lx';
    };

    // Sidebar Logic
    const setupSidebar = () => {
        const sidebar = document.getElementById('sidebar');
        const allDropdown = document.querySelectorAll('#sidebar .side-dropdown');
        const toggleSidebarBtn = document.querySelector('.toggle-sidebar');
        const allSideDivider = document.querySelectorAll('#sidebar .divider');

        const toggleSidebarElements = (hide) => {
            allSideDivider.forEach(item => item.textContent = hide ? '-' : item.dataset.text);
            allDropdown.forEach(item => {
                const a = item.parentElement.querySelector('a:first-child');
                a.classList.remove('active');
                item.classList.remove('show');
            });
        };

        allDropdown.forEach(item => {
            const a = item.parentElement.querySelector('a:first-child');
            a.addEventListener('click', function (e) {
                e.preventDefault();
                if (!this.classList.contains('active')) {
                    allDropdown.forEach(i => {
                        const aLink = i.parentElement.querySelector('a:first-child');
                        aLink.classList.remove('active');
                        i.classList.remove('show');
                    });
                }
                this.classList.toggle('active');
                item.classList.toggle('show');
            });
        });

        toggleSidebarBtn.addEventListener('click', function () {
            sidebar.classList.toggle('close');
            toggleSidebarElements(sidebar.classList.contains('close'));
        });

        sidebar.addEventListener('mouseleave', function () {
            if (this.classList.contains('close')) {
                toggleSidebarElements(true);
            }
        });

        sidebar.addEventListener('mouseenter', function () {
            if (this.classList.contains('close')) {
                toggleSidebarElements(false);
            }
        });
    };

    // Profile Dropdown
    const setupProfileDropdown = () => {
        const profile = document.querySelector('nav .profile');
        const imgProfile = profile.querySelector('img');
        const dropdownProfile = profile.querySelector('.profile-link');

        imgProfile.addEventListener('click', function () {
            dropdownProfile.classList.toggle('show');
        });
    };

    // Menu
    const setupMenu = () => {
        const allMenu = document.querySelectorAll('main .content-data .head .menu, main .content-data-mushroom .head .menu');
        
        document.body.addEventListener('click', function (e) {
            if (e.target.matches('.icon')) {
                e.stopPropagation();
                e.target.nextElementSibling?.classList.toggle('show');
            } else {
                document.querySelectorAll('.menu-link.show').forEach(menu => menu.classList.remove('show'));
            }
        });
    };

    // Progress Bar
    const setupProgressBar = () => {
        const allProgress = document.querySelectorAll('main .card .progress');
        
        allProgress.forEach(item => {
            item.style.setProperty('--value', item.dataset.value);
        });
    };

    // Initialize the sidebar, profile dropdown, menu, and progress bar
    setupSidebar();
    setupProfileDropdown();
    setupMenu();
    setupProgressBar();

    // Handle real-time sensor data updates
    socket.on('sensor_update', function (data) {
        if (!data.sensor_type) {
            console.warn('Missing sensor type in data:', data);
            return;
        }
        
        console.log('Received data: ', data);
        updateSensorData(data);
    });

    // Optional: handle reconnection
    socket.on('reconnect', () => {
        console.log('Reconnected to the server');
    });

    socket.on('reconnect_error', () => {
        console.error('Reconnection failed');
        // You can display a message to the user about the error
        alert('Connection failed. Please check your network and try again.');
    });
});
