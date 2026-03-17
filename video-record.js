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

function showCountdown(callback) {
    var videoWrap = document.querySelector(".casting-overlay__video-wrap");
    if (!videoWrap) { callback(); return; }

    // Create countdown overlay
    var cdOverlay = document.createElement("div");
    cdOverlay.id = "countdownOverlay";
    cdOverlay.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:100;overflow:hidden;";

    // Film leader circle (outer ring with tick marks)
    var circle = document.createElement("div");
    circle.id = "countdownCircle";
    circle.style.cssText = "width:220px;height:220px;border-radius:50%;border:6px solid #c8a264;position:relative;display:flex;align-items:center;justify-content:center;transition:transform 0.8s cubic-bezier(0.4,0,0.2,1);";

    // Tick marks around circle (like film leader)
    for (var t = 0; t < 12; t++) {
        var tick = document.createElement("div");
        var angle = t * 30;
        tick.style.cssText = "position:absolute;width:3px;height:14px;background:#c8a264;top:4px;left:50%;transform:translateX(-50%) rotate(" + angle + "deg);transform-origin:1.5px 106px;";
        circle.appendChild(tick);
    }

    // Cross lines (film leader style)
    var crossH = document.createElement("div");
    crossH.style.cssText = "position:absolute;width:100%;height:2px;background:rgba(200,162,100,0.4);top:50%;left:0;";
    circle.appendChild(crossH);
    var crossV = document.createElement("div");
    crossV.style.cssText = "position:absolute;height:100%;width:2px;background:rgba(200,162,100,0.4);left:50%;top:0;";
    circle.appendChild(crossV);

    // Sweeping arc (countdown wedge)
    var arcSvg = document.createElement("div");
    arcSvg.innerHTML = '<svg width="220" height="220" style="position:absolute;top:-6px;left:-6px;"><circle cx="110" cy="110" r="104" fill="none" stroke="#c8a264" stroke-width="4" stroke-dasharray="653.45" stroke-dashoffset="0" id="countdownArc" style="transition:stroke-dashoffset 1s linear;transform:rotate(-90deg);transform-origin:center;" opacity="0.5"/></svg>';
    circle.appendChild(arcSvg);

    // Number in center
    var num = document.createElement("div");
    num.id = "countdownNum";
    num.style.cssText = "font-size:90px;font-weight:900;color:#c8a264;font-family:'Arial Black',Impact,sans-serif;z-index:2;text-shadow:0 0 20px rgba(200,162,100,0.5);line-height:1;";
    num.textContent = "3";
    circle.appendChild(num);

    cdOverlay.appendChild(circle);

    // Film grain effect
    var grain = document.createElement("div");
    grain.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;opacity:0.08;pointer-events:none;background:url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"200\" height=\"200\"><filter id=\"n\"><feTurbulence baseFrequency=\"0.9\" numOctaves=\"4\" stitchTiles=\"stitch\"/></filter><rect width=\"200\" height=\"200\" filter=\"url(%23n)\" opacity=\"1\"/></svg>');";
    cdOverlay.appendChild(grain);

    // Film scratches (vertical lines)
    for (var s = 0; s < 3; s++) {
        var scratch = document.createElement("div");
        scratch.style.cssText = "position:absolute;width:1px;height:100%;background:rgba(255,255,255,0.15);left:" + (20 + Math.random() * 60) + "%;animation:filmScratch " + (0.3 + Math.random() * 0.4) + "s ease-in-out infinite;";
        cdOverlay.appendChild(scratch);
    }

    // Add film scratch animation
    if (!document.getElementById("countdownStyles")) {
        var style = document.createElement("style");
        style.id = "countdownStyles";
        style.textContent =
            "@keyframes filmScratch{0%,100%{opacity:0}50%{opacity:0.2}}" +
            "@keyframes countdownPulse{0%{transform:scale(1)}50%{transform:scale(1.15)}100%{transform:scale(1)}}" +
            "@keyframes countdownFlicker{0%{opacity:0.85}25%{opacity:1}50%{opacity:0.9}75%{opacity:1}100%{opacity:0.85}}";
        document.head.appendChild(style);
    }

    videoWrap.style.position = "relative";
    videoWrap.appendChild(cdOverlay);

    // Beep sound using AudioContext
    function playBeep(freq, duration) {
        try {
            var ctx = new (window.AudioContext || window.webkitAudioContext)();
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            osc.type = "square";
            gain.gain.value = 0.15;
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
            osc.stop(ctx.currentTime + duration);
        } catch(e) {}
    }

    var count = 3;
    var arc = document.getElementById("countdownArc");
    var circumference = 653.45;

    function doCount() {
        var numEl = document.getElementById("countdownNum");
        var circleEl = document.getElementById("countdownCircle");
        if (!numEl || !circleEl) return;

        if (count <= 0) {
            // Flash white and go!
            cdOverlay.style.background = "rgba(255,255,255,0.9)";
            cdOverlay.style.transition = "background 0.15s, opacity 0.3s";
            numEl.textContent = "🎬";
            numEl.style.fontSize = "60px";
            numEl.style.color = "#333";
            circleEl.style.border = "6px solid #333";
            playBeep(1200, 0.3);

            setTimeout(function() {
                cdOverlay.style.opacity = "0";
                setTimeout(function() {
                    if (cdOverlay.parentNode) cdOverlay.parentNode.removeChild(cdOverlay);
                    callback();
                }, 300);
            }, 400);
            return;
        }

        numEl.textContent = count;
        numEl.style.animation = "countdownPulse 0.4s ease-out";
        cdOverlay.style.animation = "countdownFlicker 0.5s";

        // Rotate the circle clockwise
        var rotation = (3 - count) * 120;
        circleEl.style.transform = "rotate(" + rotation + "deg)";

        // Arc sweep
        if (arc) {
            var offset = circumference * (1 - (3 - count) / 3);
            arc.style.strokeDashoffset = offset;
        }

        playBeep(800, 0.15);

        setTimeout(function() {
            if (numEl) numEl.style.animation = "";
            if (cdOverlay) cdOverlay.style.animation = "";
        }, 450);

        count--;
        setTimeout(doCount, 1000);
    }

    doCount();
}

function startRecording() {
    if (!videoRecState || !videoRecState.stream) return;

    // Disable button during countdown
    var startBtn = document.getElementById("videoRecStartBtn");
    if (startBtn) startBtn.disabled = true;

    document.getElementById("videoRecStatus").textContent = "Дайындалыңыз!";
    document.getElementById("videoRecDesc").textContent = "";

    showCountdown(function() {
        actuallyStartRecording();
    });
}

function actuallyStartRecording() {
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

    var startBtn = document.getElementById("videoRecStartBtn");
    if (startBtn) {
        startBtn.disabled = false;
        startBtn.textContent = "Тоқтату";
        startBtn.style.background = "#f44336";
    }
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
