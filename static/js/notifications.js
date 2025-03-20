document.addEventListener("DOMContentLoaded", function () {
    const notificationList = document.getElementById("notification-list");
    const notificationCounter = document.getElementById("notification-counter");
    let notificationCount = 0;

    // 🌈 Define mushroom colors
    const mushroomColors = {
        Chestnut: "#8B4513",
        Shiitake: "#A52A2A",
        Oyster: "#008080",
        Milky: "#4B0082",
        Reishi: "#B22222",
        Default: "#555"
    };

    // 📊 Define optimal thresholds per mushroom type
    const thresholds = {
        Chestnut: {
            temperature: { min: 18, max: 22 },
            humidity: { min: 85, max: 95 },
            soilMoisture: { min: 60, max: 80 },
            lightIntensity: { min: 500, max: 1000 },
            ECO2: { max: 1000 }
        },
        Shiitake: {
            temperature: { min: 12, max: 20 },
            humidity: { min: 80, max: 90 },
            soilMoisture: { min: 55, max: 75 },
            lightIntensity: { min: 400, max: 900 },
            ECO2: { max: 1200 }
        },
        Oyster: {
            temperature: { min: 15, max: 25 },
            humidity: { min: 70, max: 90 },
            soilMoisture: { min: 50, max: 70 },
            lightIntensity: { min: 300, max: 800 },
            ECO2: { max: 800 }
        },
        Milky: {
            temperature: { min: 20, max: 30 },
            humidity: { min: 85, max: 95 },
            soilMoisture: { min: 65, max: 85 },
            lightIntensity: { min: 400, max: 900 },
            ECO2: { max: 900 }
        },
        Reishi: {
            temperature: { min: 24, max: 30 },
            humidity: { min: 75, max: 85 },
            soilMoisture: { min: 50, max: 70 },
            lightIntensity: { min: 600, max: 1200 },
            ECO2: { max: 1500 }
        }
    };

    // 🏷️ Format parameter names for display (capitalize words)
    function formatParamName(param) {
        return param
            .replace(/([A-Z])/g, ' $1') // Add space before capital letters
            .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
            .trim();
    }

    // 🚨 Handle incoming sensor data and generate alerts
    window.handleSensorData = function (mushroomType, data) {
        const alerts = [];
        const mushroomThresholds = thresholds[mushroomType];

        console.log(`🚨 Threshold check for ${mushroomType}:`, data);

        if (!mushroomThresholds) {
            console.warn(`No thresholds found for ${mushroomType}`);
            return;
        }

        for (const [param, value] of Object.entries(data)) {
            if (mushroomThresholds[param]) {
                const { min, max } = mushroomThresholds[param];
                if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
                    const optimalRange = [
                        min !== undefined ? min : '-',
                        max !== undefined ? max : '∞'
                    ].join(' - ');

                    alerts.push(`${formatParamName(param)}: ${value} (Optimal: ${optimalRange})`);
                }
            }
        }

        if (alerts.length > 0) {
            notificationCount++;
            notificationCounter.style.display = "inline-block";
            notificationCounter.innerText = notificationCount;

            // 🌟 Create notification item for in-page display
            const li = document.createElement("li");
            li.textContent = `⚠️ ${mushroomType} Alert: ${alerts.join("; ")}`;

            // 🎨 Apply mushroom-specific color
            const color = mushroomColors[mushroomType] || mushroomColors.Default;
            li.style.backgroundColor = color;
            li.style.color = "#fff";
            li.style.padding = "8px";
            li.style.borderRadius = "5px";
            li.style.marginBottom = "5px";

            notificationList.appendChild(li);

            // 🔔 Browser notification
            if (Notification.permission === "granted") {
                new Notification(`${mushroomType} Alert! ⚠️`, {
                    body: alerts.join("\n"),
                    icon: "http://52.64.254.252/static/images/mushkin_logo.png"
                });
            } else if (Notification.permission !== "denied") {
                Notification.requestPermission().then(permission => {
                    if (permission === "granted") {
                        new Notification(`${mushroomType} Alert! ⚠️`, {
                            body: alerts.join("\n"),
                            icon: "http://52.64.254.252/static/images/mushkin_logo.png"
                        });
                    }
                });
            } else {
                console.warn("Notifications are blocked. Please enable them for alerts.");
            }
        }
    };

    // 🧹 Clear notifications
    document.getElementById("clear-notifications").addEventListener("click", function () {
        notificationList.innerHTML = "";
        notificationCounter.style.display = "none";
        notificationCount = 0;
    });
});
