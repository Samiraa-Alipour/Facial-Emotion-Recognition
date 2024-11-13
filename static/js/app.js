document.addEventListener('DOMContentLoaded', function() {
    const modeSelect = document.getElementById('mode-select');
    const realtimeContainer = document.getElementById('realtime-container');
    const imageContainer = document.getElementById('image-container');
    const videoContainer = document.getElementById('video-container');
    const loadingOverlay = document.getElementById('loading-overlay');
    const errorModal = document.getElementById('error-modal');
    const errorMessage = document.getElementById('error-message');
    const closeError = document.getElementById('close-error');
    let emotionsChart = null;

    // Close error modal
    closeError.addEventListener('click', function() {
        errorModal.classList.add('hidden');
    });

    // Mode selection handler
    modeSelect.addEventListener('change', function() {
        const selectedMode = this.value;
        hideAllContainers();
        modeSelect.parentElement.classList.add('minimized');

        switch(selectedMode) {
            case 'realtime':
                realtimeContainer.classList.remove('hidden');
                realtimeContainer.classList.add('visible');
                startRealtime(); // Start the webcam feed
                break;
            case 'image':
                imageContainer.classList.remove('hidden');
                imageContainer.classList.add('visible');
                break;
            case 'video':
                videoContainer.classList.remove('hidden');
                videoContainer.classList.add('visible');
                break;
        }
    });

    // Back button handlers
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const container = this.closest('.mode-container');
            container.classList.remove('visible');
            container.classList.add('hidden');
            modeSelect.parentElement.classList.remove('minimized');
            modeSelect.value = '';
        });
    });

    function startRealtime() {
        document.getElementById("realtime-video").src = "/video_feed";
    }

    // Image upload handler
    document.getElementById("imageUpload").addEventListener("change", function() {
        const file = this.files[0];
    
        if (file) {
            const formData = new FormData();
            formData.append("file", file);
    
            showLoading();

            fetch("/process_image", {
                method: "POST",
                body: formData,
            })
            .then(response => response.json())
            .then(data => {
                hideLoading();
                if (data.status === 'error') {
                    throw new Error(data.message);
                } else {
                    // Display processed image
                    const processedImage = document.getElementById("processed-image");
                    processedImage.src = `data:image/jpeg;base64,${data.image}`;
                    
                    // Display detected emotions
                    const emotionsContainer = document.getElementById("image-emotions");
                    emotionsContainer.innerHTML = '';
                    Object.entries(data.emotions).forEach(([emotion, value]) => {
                        const emotionItem = document.createElement("div");
                        emotionItem.innerText = `${emotion}: ${(value * 100).toFixed(1)}%`;
                        emotionsContainer.appendChild(emotionItem);
                    });
                }
            })
            .catch(error => showError(error.message));
        }
    });

    // Video upload handler
    document.getElementById("videoUpload").addEventListener("change", function() {
        const file = this.files[0];
    
        if (file) {
            const formData = new FormData();
            formData.append("file", file);
    
            showLoading();
    
            fetch("/process_video", {
                method: "POST",
                body: formData,
            })
            .then(response => response.json())
            .then(data => {
                hideLoading();
                if (data.status === 'error') {
                    throw new Error(data.message);
                } else {
                    // Set the processed video source
                    const videoElement = document.getElementById("processed-video");
                    videoElement.src = `/static/${data.video_path}`;
                    videoElement.load();

                    // Update emotions chart
                    updateEmotionsChart(data.emotions_timeline);
                }
            })
            .catch(error => showError(error.message));
        }
    });

    // Update emotions chart function
    function updateEmotionsChart(emotionsTimeline) {
        if (emotionsChart) {
            emotionsChart.destroy();
        }

        const ctx = document.getElementById('emotions-chart').getContext('2d');
        const datasets = Object.keys(emotionsTimeline[0] || {}).map(emotion => ({
            label: emotion,
            data: emotionsTimeline.map(frame => frame[emotion] * 100),
            borderColor: getRandomColor(),
            fill: false,
            tension: 0.4
        }));

        emotionsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array.from({length: emotionsTimeline.length}, (_, i) => `Frame ${i + 1}`),
                datasets: datasets
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: { display: true, text: 'Confidence (%)' }
                    }
                },
                plugins: {
                    legend: { position: 'top' },
                    title: { display: true, text: 'Emotion Analysis Over Time' }
                }
            }
        });
    }

    // Utility functions
    function hideAllContainers() {
        [realtimeContainer, imageContainer, videoContainer].forEach(container => {
            container.classList.add('hidden');
            container.classList.remove('visible');
        });
    }

    function showLoading() {
        loadingOverlay.classList.remove('hidden');
    }

    function hideLoading() {
        loadingOverlay.classList.add('hidden');
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorModal.classList.remove('hidden');
    }

    function getRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }
});