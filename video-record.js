/**
 * Video recording overlay — record up to 2 min video and send to Telegram.
 */

var MAX_RECORD_SEC = 120;
var videoRecState = null;

function createVideoRecordOverlay() {
    if (document.getElementById("videoRecOverlay")) return;

    var overlay = document.createElement("div");
    overlay.id = "videoRecOverlay";
    overlay.className = "casting-overlay";
    overlay.innerHTML =
        '<div class="casting-overlay__header">' +
            '<h2>Видео визитка</h2>' +
            '<button class="casting-overlay__close" id="videoRecClose" type="button" aria-label="Жабу">&times;</button>' +
        '</div>' +
        '<div class="casting-overlay__body">' +
            '<div class="casting-overlay__video-wrap">' +
                '<video id="videoRecPreview" autoplay playsinline muted></video>' +
                '<video id="videoRecPlayback" playsinline hidden></video>' +
            '</div>' +
            '<div class="casting-overlay__panel">' +
                '<p class="casting-overlay__emotion-label" id="videoRecStatus">Дайын</p>' +
                '<p class="casting-overlay__emotion-desc" id="videoRecDesc">Өзіңіз туралы қысқа видео жазыңыз (2 мин дейін)</p>' +
                '<div class="casting-overlay__meter">' +
                    '<div class="casting-overlay__meter-fill" id="videoRecProgress" style="width:0%;background:linear-gradient(90deg,#c8a264,#e0c080)"></div>' +
                    '<span class="casting-overlay__meter-text" id="videoRecTimer">0:00 / 2:00</span>' +
                '</div>' +
                '<div id="videoRecActions" style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">' +
                    '<button class="casting-overlay__start-btn" id="videoRecStartBtn" type="button" style="background:linear-gradient(135deg,#4caf50,#66bb6a)">Видеоны бастау</button>' +
                '</div>' +
            '</div>' +
        '</div>';

    document.body.appendChild(overlay);
    document.getElementById("videoRecClose").addEventListener("click", closeVideoRecord);
    document.getElementById("videoRecStartBtn").addEventListener("click", toggleRecording);
}

function openVideoRecord() {
    createVideoRecordOverlay();
    var overlay = document.getElementById("videoRecOverlay");
    overlay.classList.add("is-open");
    document.body.style.overflow = "hidden";

    navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true
    }).then(function(stream) {
        videoRecState = {
            stream: stream,
            recorder: null,
            chunks: [],
            timer: null,
            elapsed: 0,
            recording: false,
            blob: null
        };

        var preview = document.getElementById("videoRecPreview");
        preview.srcObject = stream;
        preview.play();
    }).catch(function(err) {
        document.getElementById("videoRecStatus").textContent = "Камера қатесі";
        document.getElementById("videoRecDesc").textContent = err.message || "Камера мен микрофонға рұқсат беріңіз";
        document.getElementById("videoRecStartBtn").disabled = true;
    });
}

function closeVideoRecord() {
    if (videoRecState) {
        if (videoRecState.recorder && videoRecState.recording) {
            videoRecState.recorder.stop();
        }
        if (videoRecState.timer) {
            clearInterval(videoRecState.timer);
        }
        if (videoRecState.stream) {
            videoRecState.stream.getTracks().forEach(function(t) { t.stop(); });
        }
        videoRecState = null;
    }

    var overlay = document.getElementById("videoRecOverlay");
    if (overlay) {
        overlay.classList.remove("is-open");
        document.body.style.overflow = "";
        setTimeout(function() { overlay.remove(); }, 300);
    }
}

function toggleRecording() {
    if (!videoRecState) return;

    if (videoRecState.recording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording() {
    if (!videoRecState || !videoRecState.stream) return;

    videoRecState.chunks = [];
    videoRecState.elapsed = 0;
    videoRecState.blob = null;

    var mimeType = "video/webm;codecs=vp8,opus";
    if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm";
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "";
    }

    var options = mimeType ? { mimeType: mimeType } : {};
    var recorder = new MediaRecorder(videoRecState.stream, options);
    videoRecState.recorder = recorder;

    recorder.ondataavailable = function(e) {
        if (e.data && e.data.size > 0) {
            videoRecState.chunks.push(e.data);
        }
    };

    recorder.onstop = function() {
        videoRecState.recording = false;
        if (videoRecState.timer) {
            clearInterval(videoRecState.timer);
            videoRecState.timer = null;
        }

        var blob = new Blob(videoRecState.chunks, { type: recorder.mimeType || "video/webm" });
        videoRecState.blob = blob;
        showPlayback(blob);
    };

    recorder.start(1000);
    videoRecState.recording = true;

    document.getElementById("videoRecStartBtn").textContent = "Тоқтату";
    document.getElementById("videoRecStartBtn").style.background = "#f44336";
    document.getElementById("videoRecStatus").textContent = "Жазылуда...";
    document.getElementById("videoRecDesc").textContent = "Өзіңіз туралы айтыңыз";

    // Recording pulse
    var dot = document.getElementById("videoRecStatus");
    dot.style.color = "#f44336";

    videoRecState.timer = setInterval(function() {
        videoRecState.elapsed++;
        updateRecordTimer();

        if (videoRecState.elapsed >= MAX_RECORD_SEC) {
            stopRecording();
        }
    }, 1000);

    updateRecordTimer();
}

function stopRecording() {
    if (!videoRecState || !videoRecState.recorder) return;
    videoRecState.recorder.stop();
    videoRecState.stream.getTracks().forEach(function(t) { t.stop(); });
}

function updateRecordTimer() {
    if (!videoRecState) return;
    var el = videoRecState.elapsed;
    var min = Math.floor(el / 60);
    var sec = el % 60;
    var total = "2:00";
    var current = min + ":" + (sec < 10 ? "0" : "") + sec;

    document.getElementById("videoRecTimer").textContent = current + " / " + total;
    var pct = Math.min(100, (el / MAX_RECORD_SEC) * 100);
    document.getElementById("videoRecProgress").style.width = pct + "%";
}

function showPlayback(blob) {
    var preview = document.getElementById("videoRecPreview");
    var playback = document.getElementById("videoRecPlayback");

    preview.hidden = true;
    playback.hidden = false;
    playback.src = URL.createObjectURL(blob);
    playback.controls = true;
    playback.style.width = "100%";
    playback.style.height = "100%";
    playback.style.objectFit = "cover";
    playback.play();

    document.getElementById("videoRecStatus").textContent = "Дайын!";
    document.getElementById("videoRecStatus").style.color = "#4caf50";
    document.getElementById("videoRecDesc").textContent = "Видеоны қарап шығыңыз";

    var sizeMB = (blob.size / 1024 / 1024).toFixed(1);
    document.getElementById("videoRecTimer").textContent = "Өлшемі: " + sizeMB + " MB";

    var actions = document.getElementById("videoRecActions");
    actions.innerHTML =
        '<button class="casting-overlay__start-btn" id="videoRecRetry" type="button" style="background:#666">Қайта жазу</button>' +
        '<button class="casting-overlay__start-btn" id="videoRecSend" type="button">Жіберу</button>';

    document.getElementById("videoRecRetry").addEventListener("click", retryRecording);
    document.getElementById("videoRecSend").addEventListener("click", function() {
        sendVideoToTelegram(blob);
    });
}

function retryRecording() {
    var playback = document.getElementById("videoRecPlayback");
    var preview = document.getElementById("videoRecPreview");

    if (playback.src) {
        URL.revokeObjectURL(playback.src);
    }
    playback.hidden = true;
    preview.hidden = false;

    navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true
    }).then(function(stream) {
        videoRecState.stream = stream;
        videoRecState.chunks = [];
        videoRecState.blob = null;
        preview.srcObject = stream;
        preview.play();

        document.getElementById("videoRecStatus").textContent = "Дайын";
        document.getElementById("videoRecStatus").style.color = "#ffffff";
        document.getElementById("videoRecDesc").textContent = "Өзіңіз туралы қысқа видео жазыңыз";

        var actions = document.getElementById("videoRecActions");
        actions.innerHTML = '<button class="casting-overlay__start-btn" id="videoRecStartBtn" type="button" style="background:linear-gradient(135deg,#4caf50,#66bb6a)">Видеоны бастау</button>';
        document.getElementById("videoRecStartBtn").addEventListener("click", toggleRecording);

        document.getElementById("videoRecProgress").style.width = "0%";
        document.getElementById("videoRecTimer").textContent = "0:00 / 2:00";
    });
}

function sendVideoToTelegram(blob) {
    var sendBtn = document.getElementById("videoRecSend");
    sendBtn.disabled = true;
    sendBtn.textContent = "Жіберілуде...";

    document.getElementById("videoRecStatus").textContent = "Жүктелуде...";
    document.getElementById("videoRecDesc").textContent = "Видео менеджерге жіберілуде";

    var apiBase = (document.querySelector('meta[name="apollo-api-base"]') || {}).content || "";
    apiBase = apiBase.replace(/\/$/, "");

    var formData = new FormData();
    formData.append("video", blob, "video-vizitka-" + Date.now() + ".webm");
    formData.append("sessionId", "video-" + Date.now());

    fetch(apiBase + "/video", {
        method: "POST",
        body: formData
    }).then(function(res) {
        return res.json();
    }).then(function(data) {
        if (data.ok) {
            document.getElementById("videoRecStatus").textContent = "Жіберілді!";
            document.getElementById("videoRecStatus").style.color = "#4caf50";
            document.getElementById("videoRecDesc").textContent = "Видео менеджерге жетті. Рахмет!";

            var actions = document.getElementById("videoRecActions");
            actions.innerHTML = '<button class="casting-overlay__start-btn" id="videoRecDone" type="button">Жабу</button>';
            document.getElementById("videoRecDone").addEventListener("click", closeVideoRecord);
        } else {
            throw new Error(data.error || "Жіберу қатесі");
        }
    }).catch(function(err) {
        document.getElementById("videoRecStatus").textContent = "Қате!";
        document.getElementById("videoRecStatus").style.color = "#f44336";
        document.getElementById("videoRecDesc").textContent = err.message || "Видеоны жіберу мүмкін болмады";
        sendBtn.disabled = false;
        sendBtn.textContent = "Қайта жіберу";
    });
}

window.openVideoRecord = openVideoRecord;
window.closeVideoRecord = closeVideoRecord;
