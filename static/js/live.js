// Global Flask server URL
const flaskServer = "/upload_image";

// List of camera IDs that match the Flask server's routing
const cameraIds = ["chestnut", "milky", "reishi", "shiitake", "white_oyster"];

// Refresh the camera streams every 5 seconds
function refreshStreams() {
    cameraIds.forEach(id => {
        let streamImg = document.getElementById(`${id}-stream`);
        let timestamp = new Date().getTime();
        // Use EC2 instance for streaming
        streamImg.src = `http://52.64.254.252:5000/stream?camera_id=${id}&t=${timestamp}`;
    });
}
setInterval(refreshStreams, 5000);

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

// Capture image through the EC2 server
function captureImage(mushroom) {
    fetch(`http://52.64.254.252:5000/capture?camera_id=${mushroom}`)
        .then(response => {
            if (!response.ok) throw new Error(`ESP32 Error: ${response.statusText}`);
            return response.blob();
        })
        .then(blob => {
            let formData = new FormData();
            formData.append("file", blob, `capture_${mushroom}_${new Date().toISOString()}.jpg`);
            formData.append("mushroom", mushroom);
            return fetch(flaskServer, { method: "POST", body: formData });
        })
        .then(response => response.json())
        .then(data => {
            if (data.message && data.message.includes("✅ Uploaded Successfully")) {
                showUploadStatus(`✅ ${mushroom} image uploaded successfully to Google Drive!`, true);
            } else {
                showUploadStatus(`❌ Upload failed for ${mushroom}: ` + (data.error || "Unknown error"), false);
            }
        })
        .catch(error => {
            showUploadStatus(`❌ Upload error for ${mushroom}: ` + error.message, false);
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
window.captureImage = captureImage;
