/**
 * MediaPipe Face Landmarker — Casting Emotion Test
 * Full-screen overlay: shows emotions, MediaPipe scores them in real-time.
 * Results sent to chat + Telegram via worker.
 */

const CASTING_EMOTIONS = [
    {
        key: "smile",
        label: "Күліңіз!",
        description: "Күліп көрсетіңіз",
        blendshapes: ["mouthSmileLeft", "mouthSmileRight"]
    },
    {
        key: "anger",
        label: "Ашуланыңыз!",
        description: "Ашулы бет жасаңыз",
        blendshapes: ["browDownLeft", "browDownRight", "mouthFrownLeft", "mouthFrownRight"]
    },
    {
        key: "surprise",
        label: "Таң қалыңыз!",
        description: "Таңданып көрсетіңіз",
        blendshapes: ["eyeWideLeft", "eyeWideRight", "jawOpen"]
    },
    {
        key: "thinking",
        label: "Ойланыңыз!",
        description: "Ойланып тұрған бет жасаңыз",
        blendshapes: ["browInnerUp", "eyeSquintLeft", "eyeSquintRight"]
    },
    {
        key: "fear",
        label: "Қорқыңыз!",
        description: "Қорқып тұрған бет жасаңыз",
        blendshapes: ["eyeWideLeft", "eyeWideRight", "browInnerUp", "jawOpen"]
    },
    {
        key: "disgust",
        label: "Жиіркеніңіз!",
        description: "Жиіркенген бет жасаңыз",
        blendshapes: ["noseSneerLeft", "noseSneerRight", "mouthFrownLeft"]
    }
];

const EMOTIONS_PER_TEST = 5;
const SECONDS_PER_EMOTION = 6;
const MEDIAPIPE_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";

var faceLandmarker = null;
var castingState = null;

function createCastingOverlay() {
    if (document.getElementById("castingTestOverlay")) return;

    var overlay = document.createElement("div");
    overlay.id = "castingTestOverlay";
    overlay.className = "casting-overlay";
    overlay.innerHTML =
        '<div class="casting-overlay__header">' +
            '<h2>Кастинг тесті</h2>' +
            '<button class="casting-overlay__close" id="castingClose" type="button" aria-label="Жабу">&times;</button>' +
        '</div>' +
        '<div class="casting-overlay__body">' +
            '<div class="casting-overlay__video-wrap">' +
                '<video id="castingVideo" autoplay playsinline muted></video>' +
                '<canvas id="castingCanvas"></canvas>' +
            '</div>' +
            '<div class="casting-overlay__panel">' +
                '<div class="casting-overlay__status" id="castingStatus">' +
                    '<p class="casting-overlay__emotion-label" id="castingEmotionLabel">Камера жүктелуде...</p>' +
                    '<p class="casting-overlay__emotion-desc" id="castingEmotionDesc">Күте тұрыңыз</p>' +
                '</div>' +
                '<div class="casting-overlay__meter">' +
                    '<div class="casting-overlay__meter-fill" id="castingMeterFill"></div>' +
                    '<span class="casting-overlay__meter-text" id="castingMeterText">0%</span>' +
                '</div>' +
                '<div class="casting-overlay__timer" id="castingTimer"></div>' +
                '<div class="casting-overlay__results" id="castingResults" hidden></div>' +
                '<button class="casting-overlay__start-btn" id="castingStartBtn" type="button" disabled style="background:linear-gradient(135deg,#4caf50,#66bb6a)">Бастау</button>' +
            '</div>' +
        '</div>';

    document.body.appendChild(overlay);
    document.getElementById("castingClose").addEventListener("click", closeCastingTest);
    document.getElementById("castingStartBtn").addEventListener("click", startCastingTest);
}

function openCastingTest() {
    createCastingOverlay();
    var overlay = document.getElementById("castingTestOverlay");
    overlay.classList.add("is-open");
    document.body.style.overflow = "hidden";

    navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
    }).then(function(stream) {
        var video = document.getElementById("castingVideo");
        video.srcObject = stream;
        video.play();

        var canvas = document.getElementById("castingCanvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        return loadFaceLandmarker();
    }).then(function() {
        document.getElementById("castingStartBtn").disabled = false;
        document.getElementById("castingEmotionLabel").textContent = "Дайын!";
        document.getElementById("castingEmotionDesc").textContent = "\"Бастау\" батырмасын басыңыз";
    }).catch(function(err) {
        document.getElementById("castingEmotionLabel").textContent = "Камера қатесі";
        document.getElementById("castingEmotionDesc").textContent = err.message || "Камераға рұқсат беріңіз";
    });
}

function closeCastingTest() {
    var overlay = document.getElementById("castingTestOverlay");
    if (!overlay) return;

    var video = document.getElementById("castingVideo");
    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(function(track) { track.stop(); });
        video.srcObject = null;
    }

    if (castingState && castingState.animFrame) {
        cancelAnimationFrame(castingState.animFrame);
    }
    castingState = null;

    overlay.classList.remove("is-open");
    document.body.style.overflow = "";
    setTimeout(function() { overlay.remove(); }, 300);
}

function loadFaceLandmarker() {
    if (faceLandmarker) return Promise.resolve();

    return import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18").then(function(vision) {
        return vision.FilesetResolver.forVisionTasks(MEDIAPIPE_CDN).then(function(filesetResolver) {
            // Try GPU first, fallback to CPU
            return vision.FaceLandmarker.createFromOptions(filesetResolver, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
                },
                outputFaceBlendshapes: true,
                outputFacialTransformationMatrixes: false,
                runningMode: "VIDEO",
                numFaces: 1
            });
        });
    }).then(function(landmarker) {
        faceLandmarker = landmarker;
        console.log("FaceLandmarker loaded successfully");
    });
}

function shuffleAndPick(arr, count) {
    var shuffled = arr.slice().sort(function() { return Math.random() - 0.5; });
    return shuffled.slice(0, count);
}

function sleep(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

function startCastingTest() {
    var startBtn = document.getElementById("castingStartBtn");
    startBtn.hidden = true;

    var selectedEmotions = shuffleAndPick(CASTING_EMOTIONS, EMOTIONS_PER_TEST);

    castingState = {
        emotions: selectedEmotions,
        currentIndex: 0,
        scores: [],
        maxScore: 0,
        startTime: 0,
        animFrame: null,
        lastTimestamp: -1,
        frameSkip: 0
    };

    // Countdown 3-2-1
    var label = document.getElementById("castingEmotionLabel");
    var desc = document.getElementById("castingEmotionDesc");

    label.textContent = "3";
    desc.textContent = "Дайындалыңыз...";

    setTimeout(function() {
        label.textContent = "2";
        setTimeout(function() {
            label.textContent = "1";
            setTimeout(function() {
                runEmotionRound();
            }, 1000);
        }, 1000);
    }, 1000);
}

function runEmotionRound() {
    if (!castingState || castingState.currentIndex >= castingState.emotions.length) {
        finishCastingTest();
        return;
    }

    var emotion = castingState.emotions[castingState.currentIndex];
    castingState.maxScore = 0;
    castingState.startTime = performance.now();

    document.getElementById("castingEmotionLabel").textContent = emotion.label;
    document.getElementById("castingEmotionDesc").textContent = emotion.description;
    document.getElementById("castingMeterFill").style.width = "0%";
    document.getElementById("castingMeterText").textContent = "0%";

    detectLoop(emotion);
}

function detectLoop(emotion) {
    if (!castingState) return;

    var video = document.getElementById("castingVideo");
    var elapsed = (performance.now() - castingState.startTime) / 1000;
    var remaining = Math.max(0, SECONDS_PER_EMOTION - elapsed);

    document.getElementById("castingTimer").textContent = Math.ceil(remaining) + " сек";

    if (elapsed >= SECONDS_PER_EMOTION) {
        castingState.scores.push({
            key: emotion.key,
            label: emotion.label,
            score: Math.round(castingState.maxScore * 100)
        });
        castingState.currentIndex++;
        runEmotionRound();
        return;
    }

    // Skip every other frame to reduce CPU load
    castingState.frameSkip = (castingState.frameSkip + 1) % 3;
    var shouldDetect = castingState.frameSkip === 0;

    try {
        if (shouldDetect && faceLandmarker && video && video.readyState >= 2) {
            var nowMs = Math.round(performance.now());
            if (nowMs <= castingState.lastTimestamp) {
                nowMs = castingState.lastTimestamp + 1;
            }
            castingState.lastTimestamp = nowMs;
            var result = faceLandmarker.detectForVideo(video, nowMs);

            // Draw face contours on canvas
            if (result && result.faceLandmarks && result.faceLandmarks.length > 0) {
                drawFaceLandmarks(result.faceLandmarks[0]);
            } else {
                drawFaceLandmarks(null);
            }

            var desc = document.getElementById("castingEmotionDesc");
            var hasFaces = result && result.faceBlendshapes && result.faceBlendshapes.length > 0;

            if (hasFaces) {
                var shapes = result.faceBlendshapes[0].categories;
                var score = computeEmotionScore(shapes, emotion);

                // Show live score (not just max)
                var livePct = Math.round(score * 100);
                if (score > castingState.maxScore) {
                    castingState.maxScore = score;
                }

                var bestPct = Math.round(castingState.maxScore * 100);
                document.getElementById("castingMeterFill").style.width = bestPct + "%";
                document.getElementById("castingMeterText").textContent = bestPct + "%";
                desc.textContent = emotion.description + " (қазір: " + livePct + "%)";

                var fill = document.getElementById("castingMeterFill");
                if (bestPct >= 70) {
                    fill.style.background = "linear-gradient(90deg, #4caf50, #66bb6a)";
                } else if (bestPct >= 40) {
                    fill.style.background = "linear-gradient(90deg, #ff9800, #ffa726)";
                } else {
                    fill.style.background = "linear-gradient(90deg, #f44336, #ef5350)";
                }
            } else {
                desc.textContent = "Бетіңізді камераға көрсетіңіз";
            }
        } else if (shouldDetect && !faceLandmarker) {
            document.getElementById("castingEmotionDesc").textContent = "Модель жүктелмеді...";
        }
    } catch (e) {
        document.getElementById("castingEmotionDesc").textContent = "Қате: " + (e.message || e);
        console.error("Detection error:", e);
    }

    castingState.animFrame = requestAnimationFrame(function() { detectLoop(emotion); });
}

function computeEmotionScore(shapes, emotion) {
    var values = emotion.blendshapes.map(function(name) {
        var shape = shapes.find(function(s) { return s.categoryName === name; });
        return shape ? shape.score : 0;
    });

    if (!values.length) return 0;

    var sum = values.reduce(function(a, b) { return a + b; }, 0);
    return Math.min(1, sum / values.length);
}

function finishCastingTest() {
    if (!castingState) return;

    if (castingState.animFrame) {
        cancelAnimationFrame(castingState.animFrame);
    }

    var scores = castingState.scores;
    var totalScore = Math.round(scores.reduce(function(sum, s) { return sum + s.score; }, 0) / scores.length);

    document.getElementById("castingEmotionLabel").textContent = "Нәтиже!";
    document.getElementById("castingEmotionDesc").textContent = "Жалпы балл: " + totalScore + "%";
    document.getElementById("castingTimer").textContent = "";
    document.getElementById("castingMeterFill").style.width = totalScore + "%";
    document.getElementById("castingMeterText").textContent = totalScore + "%";

    if (totalScore >= 70) {
        document.getElementById("castingMeterFill").style.background = "linear-gradient(90deg, #4caf50, #66bb6a)";
    } else if (totalScore >= 40) {
        document.getElementById("castingMeterFill").style.background = "linear-gradient(90deg, #ff9800, #ffa726)";
    } else {
        document.getElementById("castingMeterFill").style.background = "linear-gradient(90deg, #f44336, #ef5350)";
    }

    var resultsDiv = document.getElementById("castingResults");
    resultsDiv.hidden = false;
    resultsDiv.innerHTML = scores.map(function(s) {
        var icon = s.score >= 70 ? "&#9989;" : s.score >= 40 ? "&#9888;&#65039;" : "&#10060;";
        return '<div class="casting-result-row"><span>' + icon + " " + s.label.replace("!", "") + "</span><strong>" + s.score + "%</strong></div>";
    }).join("");

    // "Send to chat" button
    var sendBtn = document.createElement("button");
    sendBtn.className = "casting-overlay__start-btn";
    sendBtn.textContent = "Чатқа жіберу";
    sendBtn.style.marginTop = "16px";
    sendBtn.addEventListener("click", function() {
        sendCastingResultsToChat(scores, totalScore);
        closeCastingTest();
    });
    resultsDiv.appendChild(sendBtn);

    // Stop camera
    var video = document.getElementById("castingVideo");
    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(function(track) { track.stop(); });
        video.srcObject = null;
    }
}

function sendCastingResultsToChat(scores, totalScore) {
    var lines = ["Кастинг тесті нәтижесі:"];
    scores.forEach(function(s) {
        lines.push(s.label.replace("!", "") + ": " + s.score + "%");
    });
    lines.push("Жалпы балл: " + totalScore + "%");

    var message = lines.join("\n");

    var widgetInput = document.getElementById("widgetInput");
    var widgetSend = document.getElementById("widgetSend");

    if (widgetInput && widgetSend) {
        // Open chat if not open
        var widget = document.getElementById("castingWidget");
        var fab = document.getElementById("avatarFab");
        if (widget && !widget.classList.contains("is-open")) {
            fab && fab.click();
        }

        setTimeout(function() {
            widgetInput.value = message;
            widgetInput.dispatchEvent(new Event("input"));
            widgetSend.click();
        }, 300);
    }
}

/* ── Face Landmark Drawing ── */
// MediaPipe Face Mesh landmark indices for key face features
var FACE_CONTOURS = {
    // Lips outer
    lipsOuter: [61,146,91,181,84,17,314,405,321,375,291,409,270,269,267,0,37,39,40,185,61],
    // Lips inner
    lipsInner: [78,95,88,178,87,14,317,402,318,324,308,415,310,311,312,13,82,81,80,191,78],
    // Left eye
    leftEye: [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246,33],
    // Right eye
    rightEye: [362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398,362],
    // Left eyebrow
    leftBrow: [70,63,105,66,107,55,65,52,53,46],
    // Right eyebrow
    rightBrow: [300,293,334,296,336,285,295,282,283,276],
    // Face oval
    faceOval: [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109,10],
    // Nose bridge
    noseBridge: [168,6,197,195,5],
    // Nose bottom
    noseBottom: [98,97,2,326,327]
};

var CONTOUR_STYLES = {
    lipsOuter:  { color: "rgba(255, 100, 120, 0.7)", width: 2 },
    lipsInner:  { color: "rgba(255, 130, 150, 0.5)", width: 1.5 },
    leftEye:    { color: "rgba(100, 200, 255, 0.6)", width: 1.5 },
    rightEye:   { color: "rgba(100, 200, 255, 0.6)", width: 1.5 },
    leftBrow:   { color: "rgba(200, 162, 100, 0.6)", width: 2 },
    rightBrow:  { color: "rgba(200, 162, 100, 0.6)", width: 2 },
    faceOval:   { color: "rgba(200, 200, 200, 0.25)", width: 1 },
    noseBridge:  { color: "rgba(180, 180, 200, 0.4)", width: 1 },
    noseBottom:  { color: "rgba(180, 180, 200, 0.4)", width: 1 }
};

function drawFaceLandmarks(landmarks) {
    var canvas = document.getElementById("castingCanvas");
    var video = document.getElementById("castingVideo");
    if (!canvas || !video) return;

    var ctx = canvas.getContext("2d");
    var w = video.videoWidth || 640;
    var h = video.videoHeight || 480;

    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    ctx.clearRect(0, 0, w, h);

    if (!landmarks || !landmarks.length) return;

    var pts = landmarks;

    Object.keys(FACE_CONTOURS).forEach(function(key) {
        var indices = FACE_CONTOURS[key];
        var style = CONTOUR_STYLES[key];
        if (!style) return;

        ctx.beginPath();
        ctx.strokeStyle = style.color;
        ctx.lineWidth = style.width;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        for (var i = 0; i < indices.length; i++) {
            var idx = indices[i];
            if (idx >= pts.length) continue;
            // Mirror X because video is mirrored via CSS
            var x = (1 - pts[idx].x) * w;
            var y = pts[idx].y * h;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
    });

    // Draw glow dots on key points (lips corners, eye centers)
    var glowPoints = [61, 291, 33, 263, 1]; // lip corners, eye outer corners, nose tip
    ctx.fillStyle = "rgba(200, 162, 100, 0.5)";
    glowPoints.forEach(function(idx) {
        if (idx >= pts.length) return;
        var x = (1 - pts[idx].x) * w;
        var y = pts[idx].y * h;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
    });
}

// Global access
window.openCastingTest = openCastingTest;
window.closeCastingTest = closeCastingTest;
