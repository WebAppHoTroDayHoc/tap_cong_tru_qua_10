// --- SOUND SYNTHESIZER (Web Audio API) ---
let audioCtx = null;
let soundEnabled = true;

function getAudioContext() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            audioCtx = new AudioContext();
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function playSound(type) {
    if (!soundEnabled) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;

        if (type === 'click') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.05);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'correct') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(523.25, now); // C5
            osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
            osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'wrong') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(150, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'complete') {
            const notes = [523.25, 659.25, 783.99, 1046.50];
            notes.forEach((freq, idx) => {
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.connect(g);
                g.connect(ctx.destination);
                o.type = 'sine';
                o.frequency.setValueAtTime(freq, now + idx * 0.1);
                g.gain.setValueAtTime(0.15, now + idx * 0.1);
                g.gain.linearRampToValueAtTime(0.01, now + idx * 0.1 + 0.2);
                o.start(now + idx * 0.1);
                o.stop(now + idx * 0.1 + 0.2);
            });
        }
    } catch (e) {
        console.error("Audio error:", e);
    }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    const btn = document.getElementById('sound-toggle-btn');
    btn.textContent = soundEnabled ? '🔊' : '🔇';
    playSound('click');
}

// --- GAME STATE VARIABLES ---
let currentMode = ''; // 'addition' or 'subtraction'
let problemsList = [];
let currentIndex = 0;
let score = 0;
let correctCount = 0;
let currentInput = '';
let currentProblem = null;
let questionAnswered = false;

// --- PROBLEM GENERATION LOGIC (STRICT RULES) ---

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Generate Addition Problems (Crossing 10: a+b > 10, a+b <= 20, 1 <= a,b <= 10)
function generateAdditionProblemsList() {
    let list = [];
    for (let a = 1; a <= 10; a++) {
        for (let b = 1; b <= 10; b++) {
            if (a + b > 10 && a + b <= 20) {
                list.push({
                    type: 'addition',
                    num1: a,
                    num2: b,
                    operator: '+',
                    answer: a + b
                });
            }
        }
    }
    shuffleArray(list);
    return list.slice(0, 10);
}

// Generate Subtraction Problems (Borrowing within 20)
function generateSubtractionProblemsList() {
    let list = [];
    let seen = new Set();
    
    for (let minuend = 11; minuend <= 19; minuend++) {
        for (let subtrahend = 1; subtrahend < minuend; subtrahend++) {
            let ones = minuend % 10;
            if (ones < subtrahend) {
                let key = `${minuend}-${subtrahend}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    list.push({
                        type: 'subtraction',
                        num1: minuend,
                        num2: subtrahend,
                        operator: '-',
                        answer: minuend - subtrahend
                    });
                }
            }
        }
    }
    shuffleArray(list);
    return list.slice(0, 10);
}

// --- NAVIGATION & SCREEN CONTROL ---
function startPractice(mode) {
    playSound('click');
    getAudioContext(); 
    currentMode = mode;
    score = 0;
    correctCount = 0;
    currentIndex = 0;

    if (mode === 'addition') {
        problemsList = generateAdditionProblemsList();
        document.getElementById('game-mode-badge').className = "font-bold text-sm sm:text-base flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-100 text-amber-700";
        document.getElementById('game-mode-badge').innerHTML = "🌟 TẬP CỘNG";
    } else {
        problemsList = generateSubtractionProblemsList();
        document.getElementById('game-mode-badge').className = "font-bold text-sm sm:text-base flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-100 text-sky-700";
        document.getElementById('game-mode-badge').innerHTML = "➖ TẬP TRỪ";
    }

    document.getElementById('view-home').classList.add('hidden');
    document.getElementById('view-summary').classList.add('hidden');
    document.getElementById('view-game').classList.remove('hidden');
    document.getElementById('view-game').classList.add('flex');
    document.getElementById('home-btn').classList.remove('hidden');

    loadQuestion();
}

function loadQuestion() {
    if (currentIndex >= problemsList.length) {
        showSummary();
        return;
    }

    currentProblem = problemsList[currentIndex];
    currentInput = '';
    questionAnswered = false;

    document.getElementById('score-display').textContent = score;
    document.getElementById('current-q-num').textContent = currentIndex + 1;
    document.getElementById('problem-text').textContent = `${currentProblem.num1} ${currentProblem.operator} ${currentProblem.num2}`;
    document.getElementById('user-answer-display').textContent = '?';
    document.getElementById('user-answer-display').className = "min-w-[80px] px-4 py-1 bg-purple-50 border-3 border-dashed border-purple-300 rounded-2xl text-purple-700 text-center inline-block";

    document.getElementById('feedback-text').textContent = "Hãy nhập đáp án bên dưới nhé!";
    document.getElementById('feedback-text').className = "text-base sm:text-lg font-semibold text-slate-500";
    document.getElementById('action-buttons-container').classList.add('hidden');
    document.getElementById('btn-next').classList.add('hidden');
    document.getElementById('keypad-container').classList.remove('hidden');
}

// --- KEYPAD INPUT HANDLING ---
function appendNumber(num) {
    playSound('click');
    if (questionAnswered) return;
    if (currentInput.length < 2) {
        currentInput += num;
        document.getElementById('user-answer-display').textContent = currentInput;
        document.getElementById('user-answer-display').classList.remove('border-dashed');
        document.getElementById('user-answer-display').classList.add('border-solid', 'border-purple-500');
    }
}

function deleteNumber() {
    playSound('click');
    if (questionAnswered) return;
    currentInput = currentInput.slice(0, -1);
    if (currentInput === '') {
        document.getElementById('user-answer-display').textContent = '?';
        document.getElementById('user-answer-display').classList.add('border-dashed');
        document.getElementById('user-answer-display').classList.remove('border-solid', 'border-purple-500');
    } else {
        document.getElementById('user-answer-display').textContent = currentInput;
    }
}

// --- ANSWER SUBMISSION & VERIFICATION ---
function submitAnswer() {
    playSound('click');
    if (questionAnswered || currentInput === '') return;

    const userAns = parseInt(currentInput, 10);
    const correctAns = currentProblem.answer;

    questionAnswered = true;
    document.getElementById('keypad-container').classList.add('hidden');
    document.getElementById('action-buttons-container').classList.remove('hidden');

    if (userAns === correctAns) {
        playSound('correct');
        score += 1;
        correctCount += 1;
        document.getElementById('score-display').textContent = score;

        document.getElementById('feedback-text').innerHTML = "🎉 Chính xác! Tuyệt vời quá!";
        document.getElementById('feedback-text').className = "text-base sm:text-lg font-bold text-emerald-600 animate-bounce-gentle";
        
        document.getElementById('btn-retry').classList.add('hidden');
        document.getElementById('btn-hint').classList.add('hidden');
        document.getElementById('btn-next').classList.remove('hidden');
    } else {
        playSound('wrong');
        document.getElementById('feedback-text').innerHTML = "😊 Gần đúng rồi! Bé thử lại hoặc xem gợi ý nhé.";
        document.getElementById('feedback-text').className = "text-base sm:text-lg font-bold text-amber-600";

        document.getElementById('btn-retry').classList.remove('hidden');
        document.getElementById('btn-hint').classList.remove('hidden');
        document.getElementById('btn-next').classList.add('hidden');
    }
}

function retryQuestion() {
    playSound('click');
    currentInput = '';
    questionAnswered = false;
    document.getElementById('user-answer-display').textContent = '?';
    document.getElementById('user-answer-display').classList.add('border-dashed');
    document.getElementById('user-answer-display').classList.remove('border-solid', 'border-purple-500');

    document.getElementById('feedback-text').textContent = "Hãy nhập đáp án bên dưới nhé!";
    document.getElementById('feedback-text').className = "text-base sm:text-lg font-semibold text-slate-500";
    document.getElementById('action-buttons-container').classList.add('hidden');
    document.getElementById('keypad-container').classList.remove('hidden');
}

function nextQuestion() {
    playSound('click');
    currentIndex++;
    loadQuestion();
}

// --- CUSTOM VISUAL HINTS ---
function showHintModal() {
    playSound('click');
    const hintContent = document.getElementById('hint-content');
    const a = currentProblem.num1;
    const b = currentProblem.num2;

    if (currentProblem.type === 'addition') {
        let needed = 10 - a;
        let remainder = b - needed;
        hintContent.innerHTML = `
            <p><b>Phép cộng qua 10:</b> <code>${a} + ${b}</code></p>
            <ul class="list-disc pl-5 space-y-1 text-sm sm:text-base">
                <li>Số ${a} cần thêm <b>${needed}</b> để tròn 10.</li>
                <li>Tách ${b} thành <b>${needed} + ${remainder}</b>.</li>
                <li>Lấy ${a} + ${needed} = 10.</li>
                <li>Sau đó lấy 10 + ${remainder} = <b>${a + b}</b>.</li>
            </ul>
        `;
    } else {
        let ones = a % 10;
        hintContent.innerHTML = `
            <p><b>Phép trừ có nhớ:</b> <code>${a} - ${b}</code></p>
            <ul class="list-disc pl-5 space-y-1 text-sm sm:text-base">
                <li>Hàng đơn vị số bị trừ là ${ones}, nhỏ hơn số trừ (${b}), nên <b>không trừ được</b>.</li>
                <li>Đổi 1 chục thành 10 đơn vị.</li>
                <li>Ta có: ${a} = 10 + ${ones}, mượn 1 chục thành ${10 + ones} đơn vị.</li>
                <li>Thực hiện: ${10 + ones} - ${b} = <b>${a - b}</b>.</li>
            </ul>
        `;
    }

    document.getElementById('hint-modal').classList.remove('hidden');
}

function closeHintModal() {
    playSound('click');
    document.getElementById('hint-modal').classList.add('hidden');
}

// --- SUMMARY SCREEN ---
function showSummary() {
    playSound('complete');
    document.getElementById('view-game').classList.add('hidden');
    document.getElementById('view-summary').classList.remove('hidden');
    document.getElementById('view-summary').classList.add('flex');

    document.getElementById('final-score').textContent = `${score}/10`;
    document.getElementById('final-correct-count').textContent = `${correctCount}/10`;
}

function restartCurrentMode() {
    startPractice(currentMode);
}

// --- GO HOME & CONFIRMATION ---
function confirmGoHome() {
    playSound('click');
    if (!document.getElementById('view-game').classList.contains('hidden')) {
        document.getElementById('confirm-modal').classList.remove('hidden');
    } else {
        goHome();
    }
}

function closeConfirmModal() {
    playSound('click');
    document.getElementById('confirm-modal').classList.add('hidden');
}

function executeGoHome() {
    playSound('click');
    closeConfirmModal();
    goHome();
}

function goHome() {
    document.getElementById('view-game').classList.add('hidden');
    document.getElementById('view-summary').classList.add('hidden');
    document.getElementById('view-home').classList.remove('hidden');
    document.getElementById('home-btn').classList.add('hidden');
}
