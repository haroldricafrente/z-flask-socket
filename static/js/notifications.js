document.addEventListener("DOMContentLoaded", function () {
    const notificationList = document.getElementById("notification-list");
    const notificationCounter = document.getElementById("notification-counter");
    let notificationCount = 0;

    // Define optimal conditions (hardcoded for chestnut)
    const thresholds = {
        temperature: { min: 18, max: 22 },
        humidity: { min: 85, max: 95 },
        soilMoisture: { min: 60, max: 80 },
        lightIntensity: { min: 500, max: 1000 },
        ECO2: { max: 1000 }  // Only max for ECO2
    };

    // Function to handle incoming sensor data
    function handleSensorData(data) {
        const alerts = [];

        for (const [param, value] of Object.entries(data)) {
            if (thresholds[param]) {
                const { min, max } = thresholds[param];
                if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
                    alerts.push(`${param} out of range: ${value} (Optimal: ${min ?? '0'}-${max ?? '∞'})`);
                }
            }
        }

        if (alerts.length > 0) {
            notificationCount++;
            notificationCounter.style.display = "inline-block";
            notificationCounter.innerText = notificationCount;

            const li = document.createElement("li");
            li.textContent = `⚠️ Chestnut Alert: ${alerts.join("; ")}`;
            notificationList.appendChild(li);
        }
    }

    // Expose the function globally so other scripts can call it
    window.handleSensorData = handleSensorData;

    // Clear notifications
    document.getElementById("clear-notifications").addEventListener("click", function () {
        notificationList.innerHTML = "";
        notificationCounter.style.display = "none";
        notificationCount = 0;
    });
});
