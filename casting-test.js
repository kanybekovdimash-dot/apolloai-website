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
                '<button class="casting-overlay__start-btn" id="castingStartBtn" type="button" disabled>Бастау</button>' +
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

            if (result && result.faceBlendshapes && result.faceBlendshapes.length > 0) {
                var shapes = result.faceBlendshapes[0].categories;
                var score = computeEmotionScore(shapes, emotion);

                if (score > castingState.maxScore) {
                    castingState.maxScore = score;
                }

                var pct = Math.round(score * 100);
                document.getElementById("castingMeterFill").style.width = pct + "%";
                document.getElementById("castingMeterText").textContent = pct + "%";
                document.getElementById("castingEmotionDesc").textContent = emotion.description;

                var fill = document.getElementById("castingMeterFill");
                if (pct >= 70) {
                    fill.style.background = "linear-gradient(90deg, #4caf50, #66bb6a)";
                } else if (pct >= 40) {
                    fill.style.background = "linear-gradient(90deg, #ff9800, #ffa726)";
                } else {
                    fill.style.background = "linear-gradient(90deg, #f44336, #ef5350)";
                }
            } else {
                document.getElementById("castingEmotionDesc").textContent = "Бетіңізді камераға көрсетіңіз";
            }
        } else if (!faceLandmarker) {
            document.getElementById("castingEmotionDesc").textContent = "Модель жүктелмеді...";
        }
    } catch (e) {
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

// Global access
window.openCastingTest = openCastingTest;
window.closeCastingTest = closeCastingTest;
