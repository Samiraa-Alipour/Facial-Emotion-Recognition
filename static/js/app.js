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

    // Mode selection handler
    modeSelect.addEventListener('change', function() {
        const selectedMode = this.value;
        hideAllContainers();
        modeSelect.parentElement.classList.add('minimized');

        // Remove the setTimeout to prevent disappearing
        switch(selectedMode) {
            case 'realtime':
                realtimeContainer.classList.remove('hidden');
                realtimeContainer.classList.add('visible');
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
    
    function uploadImage() {
        const imageInput = document.getElementById("imageUpload");
        const file = imageInput.files[0];
    
        if (file) {
            const formData = new FormData();
            formData.append("file", file);
    
            fetch("/upload_image", {
                method: "POST",
                body: formData,
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert(data.error);
                } else {
                    document.getElementById("imageEmotionResult").innerText = `Emotion: ${data.emotion}`;
                }
            })
            .catch(error => console.error("Error:", error));
        }
    }
    
    function uploadVideo() {
        const videoInput = document.getElementById("videoUpload");
        const file = videoInput.files[0];
    
        if (file) {
            const formData = new FormData();
            formData.append("file", file);
    
            fetch("/upload_video", {
                method: "POST",
                body: formData,
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert(data.error);
                } else {
                    document.getElementById("videoEmotionResult").innerText = `Emotions: ${data.emotions.join(", ")}`;
                }
            })
            .catch(error => console.error("Error:", error));
        }
    }
    

    // Image upload handler
    document.getElementById('image-upload').addEventListener('change', function(e) {
        if (e.target.files.length === 0) return;

        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);

        showLoading();

        fetch('/process_image', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'error') {
                throw new Error(data.message);
            }

            const resultContainer = document.getElementById('image-result');
            const processedImage = document.getElementById('processed-image');
            const emotionsContainer = document.getElementById('image-emotions');

            processedImage.src = `data:image/jpeg;base64,${data.image}`;
            emotionsContainer.innerHTML = '';

            // Create emotion results
            Object.entries(data.emotions).forEach(([emotion, value]) => {
                const emotionElement = document.createElement('div');
                emotionElement.className = 'emotion-item';
                emotionElement.innerHTML = `
                    <div class="emotion-name">${emotion}</div>
                    <div class="emotion-value">${(value * 100).toFixed(1)}%</div>
                `;
                emotionsContainer.appendChild(emotionElement);
            });

            resultContainer.classList.remove('hidden');
        })
        .catch(error => showError(error.message))
        .finally(() => hideLoading());
    });

    // Video upload handler
    document.getElementById('video-upload').addEventListener('change', function(e) {
        if (e.target.files.length === 0) return;
    
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);
    
        showLoading();
    
        fetch('/process_video', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'error') {
                throw new Error(data.message);
            }
    
            const resultContainer = document.getElementById('video-result');
            const videoElement = document.getElementById('processed-video');
            
            // Set the processed video source
            videoElement.src = `/static/${data.video_path}`;
            videoElement.load();
            
            // Update emotions chart
            updateEmotionsChart(data.emotions_timeline);
            resultContainer.classList.remove('hidden');
        })
        .catch(error => showError(error.message))
        .finally(() => hideLoading());
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
                        title: {
                            display: true,
                            text: 'Confidence (%)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    title: {
                        display: true,
                        text: 'Emotion Analysis Over Time'
                    }
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

    function updateEmotionsChart(emotionsTimeline) {
        if (emotionsChart) {
            emotionsChart.destroy();
        }

        const ctx = document.getElementById('emotions-chart').getContext('2d');
        const labels = emotionsTimeline.map((_, index) => `Frame ${index + 1}`);
        const datasets = Object.keys(emotionsTimeline[0] || {}).map(emotion => ({
            label: emotion,
            data: emotionsTimeline.map(frame => frame[emotion] * 100),
            borderColor: getRandomColor(),
            fill: false
        }));

        emotionsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Confidence (%)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Frame'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    title: {
                        display: true,
                        text: 'Emotion Timeline'
                    }
                }
            }
        });
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