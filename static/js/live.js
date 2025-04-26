// Global Flask server URL (not used since you're capturing directly from ESP32)
const flaskServer = "/upload_image"; // Not needed for local IP-based capture

// List of camera IDs that match the Flask server's routing
const cameraIds = ["chestnut", "milky", "reishi", "shiitake", "white_oyster"];

// List of camera IPs in the local network
const cameraIps = {
    "chestnut": "http://192.168.100.191:81",
    "milky": "http://192.168.100.193:81",
    "reishi": "http://192.168.100.194:81",
    "shiitake": "http://192.168.100.195:81",
    "white_oyster": "http://192.168.100.196:81"
};

// Refresh the camera streams every 5 seconds
function refreshStreams() {
    cameraIds.forEach(id => {
        let streamImg = document.getElementById(`${id}-stream`);
        let timestamp = new Date().getTime();
        // Use local network IPs for streaming
        streamImg.src = `${cameraIps[id]}/stream?t=${timestamp}`;
    });
}
setInterval(refreshStreams, 10000);

// Show upload status in a modal
function showUploadStatus(message, isSuccess) {
    const modal = document.getElementById("uploadStatusModal");
    const messageElement = document.getElementById("uploadMessage");
    messageElement.innerHTML = message;
    messageElement.style.color = isSuccess ? "green" : "red";
    modal.style.display = "block";
    document.querySelector(".close").onclick = function () {
        modal.style.display = "none";
    };
}

// Capture image through the local ESP32 camera and upload to Google Drive
function captureAndUploadImage(mushroom) {
    // Use the local network IP to call the capture_image endpoint for each mushroom
    fetch(`${cameraIps[mushroom]}/capture_image`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.blob(); // Expecting an image as blob
        })
        .then(imageBlob => {
            // Create a FormData object to send the image to Flask server
            let formData = new FormData();
            formData.append("image", imageBlob, `${mushroom}_image.jpg`);
            
            // Send the image to your Flask server for upload to Google Drive
            fetch('http://192.168.100.25:5000/upload_image', {
                method: 'POST',
                headers: {
                    'Mushroom-Type': mushroom,
                },
                body: formData,
            })
            .then(response => response.json())
            .then(data => {
                if (data.message) {
                    showUploadStatus(`✅ ${mushroom} image uploaded to Google Drive successfully!`, true);
                } else {
                    throw new Error(data.error || 'Upload failed.');
                }
            })
            .catch(error => {
                showUploadStatus(`❌ Upload failed for ${mushroom}: ` + error.message, false);
            });
            
        })
        .catch(error => {
            showUploadStatus(`❌ Capture failed for ${mushroom}: ` + error.message, false);
        });
}


// Size Selector for resizing camera streams
document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("sizeSelector").addEventListener("change", function () {
        let size = this.value;
        document.querySelectorAll(".camera-stream").forEach(img => {
            img.style.width = size === "small" ? "200px" : size === "medium" ? "400px" : "600px";
            img.style.height = "auto";
        });
    });
});

// Expose the capture function to the global scope
window.captureImage = captureAndUploadImage;

