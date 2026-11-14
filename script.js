// Dọn dẹp dữ liệu lịch sử lỗi
try {
  let testHist = localStorage.getItem('sunbip_history');
  if (testHist && (testHist.includes('TAI') || testHist.includes('undefined'))) {
    localStorage.removeItem('sunbip_history');
  }
} catch (e) {}

// State Management
let balance = localStorage.getItem('sunbip_balance') !== null ? parseInt(localStorage.getItem('sunbip_balance')) : 1000000;
let currentSession = localStorage.getItem('sunbip_session') !== null ? parseInt(localStorage.getItem('sunbip_session')) : 1001;
let historyData = localStorage.getItem('sunbip_history') !== null ? JSON.parse(localStorage.getItem('sunbip_history')) : [];

let selectedChipVal = 10000;
let betSide = null; 
let tempBetAmount = 0; 
let confirmedBetAmount = 0; 
let isBetConfirmed = false;

let countdown = 15;
let gameState = 'BETTING'; 
let timerInterval = null;
let autoOpenTimeout = null;

let diceResults = [1, 1, 1];
let isBowlOpened = false;

let currentTaiCount = 0;
let currentXiuCount = 0;
let currentTaiMoney = 0;
let currentXiuMoney = 0;

let botBetInterval = null;
let liveChatInterval = null;

// DOM Elements
const balanceEl = document.getElementById('balance');
const timerSecEl = document.getElementById('timer-sec');
const timerStateEl = document.getElementById('timer-state');
const bowlEl = document.getElementById('bowl');
const resultBanner = document.getElementById('result-banner');

const zoneTai = document.getElementById('zone-tai');
const zoneXiu = document.getElementById('zone-xiu');
const placedTai = document.getElementById('placed-tai');
const placedXiu = document.getElementById('placed-xiu');
const btnConfirm = document.getElementById('btn-confirm');
const ratioText = document.getElementById('ratio-text');

// Audio Synthesizer
let audioCtx = null;
function playSound(type) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'chip') {
      osc.frequency.setValueAtTime(600, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
      osc.start(); osc.stop(audioCtx.currentTime + 0.05);
    } else if (type === 'win') {
      osc.frequency.setValueAtTime(400, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
      osc.start(); osc.stop(audioCtx.currentTime + 0.25);
    }
  } catch (e) {}
}

if (balanceEl) balanceEl.textContent = balance.toLocaleString();
if (document.getElementById('session-num')) document.getElementById('session-num').textContent = currentSession;

renderHistoryDots();
renderHistoryTable();
drawTrendChart();

// Timer
function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (gameState === 'BETTING') {
      countdown--;
      if (timerSecEl) timerSecEl.textContent = countdown;
      if (countdown <= 0) {
        triggerLockAndShake();
      }
    }
  }, 1000);
}

// Chip Selection
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    if (isBetConfirmed || gameState !== 'BETTING') return;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const v = chip.dataset.val;
    selectedChipVal = v === 'all' ? balance : parseInt(v);
    playSound('chip');
  });
});

if (zoneTai) zoneTai.addEventListener('click', () => placeBet('Tài'));
if (zoneXiu) zoneXiu.addEventListener('click', () => placeBet('Xỉu'));

function placeBet(side) {
  if (gameState !== 'BETTING' || isBetConfirmed) return;
  if (selectedChipVal <= 0 || balance <= 0) return;

  if (betSide && betSide !== side) {
    tempBetAmount = 0;
  }

  betSide = side;
  tempBetAmount = Math.min(tempBetAmount + selectedChipVal, balance);
  updateUI();
  playSound('chip');
}

if (btnConfirm) {
  btnConfirm.addEventListener('click', () => {
    if (!betSide || tempBetAmount <= 0 || isBetConfirmed || gameState !== 'BETTING') return;

    confirmedBetAmount = tempBetAmount;
    balance -= confirmedBetAmount;
    saveData();

    isBetConfirmed = true;
    btnConfirm.disabled = true;
    btnConfirm.textContent = '✔ ĐÃ XÁC NHẬN';
    if (resultBanner) {
      resultBanner.textContent = `Đã cược ${confirmedBetAmount.toLocaleString()}đ vào cửa ${betSide}`;
      resultBanner.style.color = '#34d399';
    }
    updateUI();
    playSound('chip');
  });
}

function updateUI() {
  if (balanceEl) balanceEl.textContent = balance.toLocaleString();
  if (zoneTai) zoneTai.className = 'side-box side-tai' + (betSide === 'Tài' ? ' selected-tai' : '');
  if (zoneXiu) zoneXiu.className = 'side-box side-xiu' + (betSide === 'Xỉu' ? ' selected-xiu' : '');

  if (placedTai) placedTai.textContent = betSide === 'Tài' ? `${(isBetConfirmed ? confirmedBetAmount : tempBetAmount).toLocaleString()}đ ${isBetConfirmed ? '(Đã chốt)' : '(Chờ XN)'}` : '';
  if (placedXiu) placedXiu.textContent = betSide === 'Xỉu' ? `${(isBetConfirmed ? confirmedBetAmount : tempBetAmount).toLocaleString()}đ ${isBetConfirmed ? '(Đã chốt)' : '(Chờ XN)'}` : '';
}

function triggerLockAndShake() {
  gameState = 'SHAKING';
  clearInterval(botBetInterval); 

  if (timerStateEl) timerStateEl.textContent = 'ĐANG XÓC...';
  if (timerSecEl) timerSecEl.textContent = '0';
  if (resultBanner) resultBanner.textContent = 'Khóa cửa cược! Đang lắc xúc xắc...';
  if (btnConfirm) btnConfirm.disabled = true;

  if (bowlEl) {
    bowlEl.style.transform = 'translate(0, 0)';
    bowlEl.classList.add('shake');
  }
  isBowlOpened = false;

  setTimeout(() => {
    if (bowlEl) bowlEl.classList.remove('shake');
    rollDiceStrictBip(); 
    gameState = 'WAIT_OPEN';
    
    let autoOpenSec = 3;
    if (timerStateEl) timerStateEl.textContent = `TỰ MỞ (${autoOpenSec}s)`;
    
    clearInterval(autoOpenTimeout);
    autoOpenTimeout = setInterval(() => {
      autoOpenSec--;
      if (timerStateEl) timerStateEl.textContent = `TỰ MỞ (${autoOpenSec}s)`;
      if (autoOpenSec <= 0) {
        clearInterval(autoOpenTimeout);
        if (!isBowlOpened) {
          isBowlOpened = true;
          if (bowlEl) bowlEl.style.transform = `translate(250px, 0px)`;
          finishRound();
        }
      }
    }, 1000);

  }, 1500);
}

// Tỷ lệ chuẩn 50% - 50%
function rollDiceStrictBip() {
  let targetOutcome = null;
  if (isBetConfirmed) {
    targetOutcome = (Math.random() < 0.5) ? betSide : ((betSide === 'Tài') ? 'Xỉu' : 'Tài');
  }

  do {
    diceResults = [
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1
    ];
    let sum = diceResults.reduce((a, b) => a + b, 0);
    let outcome = sum >= 11 ? 'Tài' : 'Xỉu';
    if (!targetOutcome || outcome === targetOutcome) break;
  } while (true);

  const rotations = [
    { x: 0, y: 0 }, { x: 0, y: -90 }, { x: 0, y: -180 },    
    { x: 0, y: 90 }, { x: -90, y: 0 }, { x: 90, y: 0 }       
  ];

  for (let i = 1; i <= 3; i++) {
    const cube = document.getElementById(`cube-${i}`);
    if (cube) {
      const res = diceResults[i - 1];
      const rot = rotations[res - 1];
      const extraX = (Math.floor(Math.random() * 2) + 2) * 360;
      const extraY = (Math.floor(Math.random() * 2) + 2) * 360;
      cube.style.transform = `rotateX(${rot.x + extraX}deg) rotateY(${rot.y + extraY}deg)`;
    }
  }
}

// Bowl Drag
let isDragging = false;
let startX, startY;
function startDrag(e) {
  if (gameState !== 'WAIT_OPEN' || isBowlOpened) return;
  isDragging = true;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  startX = clientX; startY = clientY;
}
function moveDrag(e) {
  if (!isDragging || !bowlEl) return;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const deltaX = clientX - startX;
  const deltaY = clientY - startY;

  bowlEl.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
  if (Math.hypot(deltaX, deltaY) > 80 && !isBowlOpened) {
    isBowlOpened = true;
    isDragging = false;
    clearInterval(autoOpenTimeout);
    bowlEl.style.transform = `translate(${deltaX * 2}px, ${deltaY * 2}px)`;
    finishRound();
  }
}
function endDrag() {
  if (!isDragging) return;
  isDragging = false;
  if (!isBowlOpened && bowlEl) bowlEl.style.transform = 'translate(0, 0)';
}

if (bowlEl) {
  bowlEl.addEventListener('mousedown', startDrag);
  window.addEventListener('mousemove', moveDrag);
  window.addEventListener('mouseup', endDrag);
  bowlEl.addEventListener('touchstart', startDrag);
  window.addEventListener('touchmove', moveDrag);
  window.addEventListener('touchend', endDrag);
}

function finishRound() {
  gameState = 'RESULT';
  clearInterval(autoOpenTimeout);
  const sum = diceResults.reduce((a, b) => a + b, 0);
  const outcome = sum >= 11 ? 'Tài' : 'Xỉu';

  let winAmount = 0;
  let isWin = false;

  if (isBetConfirmed && betSide === outcome) {
    winAmount = Math.floor(confirmedBetAmount * 1.98);
    balance += winAmount;
    isWin = true;
    playSound('win');

    if (typeof confetti === 'function') confetti({ particleCount: 120, spread: 80 });

    if (resultBanner) {
      resultBanner.textContent = `🎉 KẾT QUẢ: ${sum} ĐIỂM (${outcome}) - THẮNG +${winAmount.toLocaleString()}đ!`;
      resultBanner.style.color = '#4ade80';
    }
  } else if (isBetConfirmed) {
    if (resultBanner) {
      resultBanner.textContent = `❌ KẾT QUẢ: ${sum} ĐIỂM (${outcome}) - THUA -${confirmedBetAmount.toLocaleString()}đ!`;
      resultBanner.style.color = '#f87171';
    }
  } else {
    if (resultBanner) {
      resultBanner.textContent = `KẾT QUẢ: ${sum} ĐIỂM (${outcome}) (Không đặt cược)`;
      resultBanner.style.color = '#fbbf24';
    }
  }

  triggerPostResultChat(outcome, sum);

  historyData.unshift({
    session: currentSession,
    dices: [...diceResults],
    sum,
    outcome,
    betSide: isBetConfirmed ? betSide : 'Không cược',
    betAmount: isBetConfirmed ? confirmedBetAmount : 0,
    winAmount: isWin ? winAmount - confirmedBetAmount : (isBetConfirmed ? -confirmedBetAmount : 0)
  });

  if (historyData.length > 50) historyData.pop();

  currentSession++;
  saveData();

  renderHistoryDots();
  renderHistoryTable();
  drawTrendChart();

  setTimeout(() => {
    if (document.getElementById('session-num')) document.getElementById('session-num').textContent = currentSession;
    betSide = null;
    tempBetAmount = 0;
    confirmedBetAmount = 0;
    isBetConfirmed = false;

    if (btnConfirm) {
      btnConfirm.disabled = false;
      btnConfirm.textContent = '✔ XÁC NHẬN';
    }

    updateUI();
    if (bowlEl) bowlEl.style.transform = 'translate(0, 0)';
    if (resultBanner) {
      resultBanner.textContent = 'CHỌN CỬA - NHẬP CHIP - BẤM XÁC NHẬN';
      resultBanner.style.color = '#fbbf24';
    }

    countdown = 15;
    gameState = 'BETTING';
    if (timerStateEl) timerStateEl.textContent = 'ĐANG ĐẶT CƯỢC';
    
    startNewRoundBettingScale();
  }, 4000);
}

function saveData() {
  localStorage.setItem('sunbip_balance', balance);
  localStorage.setItem('sunbip_session', currentSession);
  localStorage.setItem('sunbip_history', JSON.stringify(historyData));
}

function renderHistoryDots() {
  const container = document.getElementById('history-dots');
  if (!container) return;
  const recent = historyData.slice(0, 15);
  container.innerHTML = recent.map(h => `
    <div class="dot-item ${h.outcome === 'Tài' ? 'tai' : 'xiu'}">${h.sum}</div>
  `).join('');
}

function renderHistoryTable() {
  const tbody = document.getElementById('hist-table-body');
  if (!tbody) return;
  tbody.innerHTML = historyData.map(h => {
    let winClass = h.winAmount > 0 ? 'win-text' : (h.winAmount < 0 ? 'lose-text' : '');
    let winTxt = h.winAmount > 0 ? `+${h.winAmount.toLocaleString()}đ` : (h.winAmount < 0 ? `${h.winAmount.toLocaleString()}đ` : '0đ');
    return `
      <tr>
        <td>#${h.session}</td>
        <td>${h.dices.join('-')} (${h.sum})</td>
        <td style="color:${h.outcome==='Tài'?'#ef4444':'#3b82f6'}; font-weight:bold">${h.outcome}</td>
        <td>${h.betSide !== 'Không cược' ? `${h.betSide} (${h.betAmount.toLocaleString()}đ)` : 'Không đặt'}</td>
        <td class="${winClass}">${winTxt}</td>
      </tr>
    `;
  }).join('');
}

function drawTrendChart() {
  const canvas = document.getElementById('trendChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const lastRounds = historyData.slice(0, 15).reverse();
  if (lastRounds.length === 0) {
    if (ratioText) ratioText.textContent = `Tài: 50% - Xỉu: 50%`;
    return;
  }

  let taiCount = lastRounds.filter(r => r.outcome === 'Tài').length;
  let total = lastRounds.length;
  let taiPercent = Math.round((taiCount / total) * 100);
  let xiuPercent = 100 - taiPercent;

  if (ratioText) ratioText.textContent = `Tài: ${taiPercent}% - Xỉu: ${xiuPercent}%`;

  const stepX = canvas.width / 15;
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 2;

  lastRounds.forEach((r, idx) => {
    const x = idx * stepX + stepX / 2;
    const y = 45 - ((r.sum - 3) / 15) * 35;
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  lastRounds.forEach((r, idx) => {
    const x = idx * stepX + stepX / 2;
    const y = 45 - ((r.sum - 3) / 15) * 35;

    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = r.outcome === 'Tài' ? '#ef4444' : '#3b82f6';
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(r.sum, x, y + 3);
  });
}

// Modal & Nạp Tiền
document.addEventListener('DOMContentLoaded', () => {
  const btnOpenModal = document.getElementById('btn-open-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const modalHist = document.getElementById('modal-hist');

  if (btnOpenModal && modalHist) {
    btnOpenModal.onclick = function(e) {
      e.preventDefault();
      modalHist.classList.add('open');
      if (typeof renderHistoryTable === 'function') renderHistoryTable();
    };
  }
  if (btnCloseModal && modalHist) {
    btnCloseModal.onclick = function(e) {
      e.preventDefault();
      modalHist.classList.remove('open');
    };
  }
  if (modalHist) {
    modalHist.onclick = function(e) {
      if (e.target === modalHist) modalHist.classList.remove('open');
    };
  }

  const btnOpenDeposit = document.getElementById('btn-open-deposit');
  const btnCloseDeposit = document.getElementById('btn-close-deposit');
  const modalDeposit = document.getElementById('modal-deposit');
  const btnSubmitDeposit = document.getElementById('btn-submit-deposit');
  const depositInput = document.getElementById('deposit-input');

  if (btnOpenDeposit && modalDeposit) {
    btnOpenDeposit.onclick = function(e) { e.preventDefault(); modalDeposit.classList.add('open'); };
  }
  if (btnCloseDeposit && modalDeposit) {
    btnCloseDeposit.onclick = function(e) { e.preventDefault(); modalDeposit.classList.remove('open'); };
  }
  if (modalDeposit) {
    modalDeposit.onclick = function(e) { if (e.target === modalDeposit) modalDeposit.classList.remove('open'); };
  }
  if (btnSubmitDeposit) {
    btnSubmitDeposit.onclick = function(e) {
      e.preventDefault();
      let val = parseInt(depositInput.value);
      if (!isNaN(val) && val > 0) {
        balance += val;
        saveData();
        updateUI();
        playSound('chip');
        if (modalDeposit) modalDeposit.classList.remove('open');
        depositInput.value = '';
      } else {
        alert('Vui lòng nhập số tiền hợp lệ!');
      }
    };
  }

  startTimer();
  startNewRoundBettingScale();
  initSmartLiveChatStream();
});

function setDepositVal(amount) {
  const depositInput = document.getElementById('deposit-input');
  if (depositInput) depositInput.value = amount;
}

// Nhảy số mượt mà
function startNewRoundBettingScale() {
  clearInterval(botBetInterval);

  currentTaiCount = Math.floor(Math.random() * 5) + 3;
  currentXiuCount = Math.floor(Math.random() * 5) + 2;
  currentTaiMoney = currentTaiCount * (Math.floor(Math.random() * 100000) + 50000);
  currentXiuMoney = currentXiuCount * (Math.floor(Math.random() * 100000) + 50000);

  renderPoolDisplay();

  botBetInterval = setInterval(() => {
    if (gameState !== 'BETTING') return;

    let addTaiPeople = Math.floor(Math.random() * 7) + 2;
    let addXiuPeople = Math.floor(Math.random() * 7) + 2;

    currentTaiCount += addTaiPeople;
    currentXiuCount += addXiuPeople;

    currentTaiMoney += addTaiPeople * (Math.floor(Math.random() * 150000) + 50000);
    currentXiuMoney += addXiuPeople * (Math.floor(Math.random() * 150000) + 50000);

    renderPoolDisplay();

  }, 1000);
}

function renderPoolDisplay() {
  const taiCountEl = document.getElementById('count-tai');
  const xiuCountEl = document.getElementById('count-xiu');
  const taiMoneyEl = document.getElementById('total-tai-money');
  const xiuMoneyEl = document.getElementById('total-xiu-money');

  let fmtTai = currentTaiMoney >= 1000000 ? (currentTaiMoney / 1000000).toFixed(1) + 'M' : (currentTaiMoney / 1000).toFixed(0) + 'k';
  let fmtXiu = currentXiuMoney >= 1000000 ? (currentXiuMoney / 1000000).toFixed(1) + 'M' : (currentXiuMoney / 1000).toFixed(0) + 'k';

  if (taiCountEl) taiCountEl.textContent = currentTaiCount;
  if (xiuCountEl) xiuCountEl.textContent = currentXiuCount;
  if (taiMoneyEl) taiMoneyEl.textContent = fmtTai;
  if (xiuMoneyEl) xiuMoneyEl.textContent = fmtXiu;
}

// Bot chat tối ưu hóa & đa dạng
const celebs = [
  { name: "Elon Musk", color: "#38bdf8" },
  { name: "Cristiano Ronaldo", color: "#f472b6" },
  { name: "Lionel Messi", color: "#34d399" },
  { name: "Sơn Tùng M-TP", color: "#f59e0b" },
  { name: "Độ Mixi", color: "#a855f7" },
  { name: "HIEUTHUHAI", color: "#ec4899" },
  { name: "Rhyder", color: "#ef4444" },
  { name: "Bill Gates", color: "#60a5fa" },
  { name: "Shark Hưng", color: "#fbbf24" }
];

const conversationDialogues = [
  [
    { celebIdx: 4, msg: "Mấy thằng lờ như thằng Elon Musk tuổi gì đòi soi cầu Tài với tao?", side: "Xỉu" },
    { celebIdx: 0, msg: "Độ Mixi mồm thì mõm thế thôi chứ lát nữa ra Xỉu lại quỳ lạy tao con ạ kk", side: "Tài" }
  ],
  [
    { celebIdx: 1, msg: "Thằng Ronaldo tao nói thật, mày ngậm mõm vào hộ cái, từ nãy đến giờ hô Xỉu toàn xịt!", side: "Tài" },
    { celebIdx: 7, msg: "Mày bị đui à Bill Gates? Nhìn cái cầu bệt thế kia mà đâm Tài thì ăn cứt à?", side: "Xỉu" }
  ],
  [
    { celebIdx: 3, msg: "Sếp Tùng phím hàng rồi, ae đâm mẹ hết vào Tài cho tao, chấp mọi thể loại bẻ cầu!", side: "Tài" },
    { celebIdx: 6, msg: "Thôi Sơn Tùng ơi mày bớt xạo lờ đi, hôm qua vừa âm 50 củ chưa tởn à :v", side: "Xỉu" }
  ]
];

const singleMessages = [
  "Đm nhà cái bịp lòi mắt, vừa cược cái nó bẻ cầu cay vãi c*t :(",
  "Thằng nào vừa hô Xỉu đấy, ra đây bố mả mẹ mày lên xem nào!",
  "Cái room chat này toàn mõm là giỏi, nạp đc đồng nào chưa hay toàn xin đểu?",
  "Đm cay cái tụi cứ thích dạy đời người khác, t thích Tài đấy làm gì nhau nào.",
  "Mấy thằng ngu đâm đầu vào Xỉu chuẩn bị ngậm đắng nuốt cay đi con ạ.",
  "Vừa làm bát mì tôm qua ngày, đm đéo gỡ đc trận này t thắt cổ tự tử."
];

function initSmartLiveChatStream() {
  clearInterval(liveChatInterval);
  liveChatInterval = setInterval(() => {
    if (gameState === 'BETTING') {
      if (Math.random() < 0.3) {
        triggerBotConversation();
      } else {
        pushSingleBotChat();
      }
    }
  }, 3000);
}

function pushSingleBotChat() {
  const c = celebs[Math.floor(Math.random() * celebs.length)];
  const msg = singleMessages[Math.floor(Math.random() * singleMessages.length)];
  const side = Math.random() > 0.5 ? 'Tài' : 'Xỉu';
  appendChatMessage(c.name, c.color, side, msg);
}

function triggerBotConversation() {
  const dialogue = conversationDialogues[Math.floor(Math.random() * conversationDialogues.length)];
  dialogue.forEach((line, index) => {
    setTimeout(() => {
      if (gameState === 'BETTING') {
        const c = celebs[line.celebIdx];
        appendChatMessage(c.name, c.color, line.side, line.msg);
      }
    }, index * 1200);
  });
}

function triggerPostResultChat(outcome, sum) {
  setTimeout(() => {
    const c1 = celebs[Math.floor(Math.random() * celebs.length)];
    const winMsgs = [
      `Về ${sum} điểm (${outcome}) rồi chúng mày ơi! Mấy thằng mõm nãy chửi tao đâu hết rồi, quỳ xuống bú đít tao lẹ! 💰`,
      `Siuuuu! Húp trọn ổ ${outcome} ${sum} điểm, sướng tê dái, bọn ngu chúng mày chỉ biết ngước nhìn thôi kk.`
    ];
    const loseMsgs = [
      `Đm cay vãi lờ, mẹ kiếp con xúc xắc chó chết ra ${sum} điểm (${outcome}) được á? Bịp bà mày chứ bịp 😡`,
      `Thề đời khốn nạn vãi, tao vừa đâm ngược phát nó vả cho bay mẹ cái xe máy. Đm nhà cái t cay lắm rồi đấy!`
    ];

    const isWin = Math.random() > 0.4;
    const msg = isWin ? winMsgs[Math.floor(Math.random() * winMsgs.length)] : loseMsgs[Math.floor(Math.random() * loseMsgs.length)];
    
    appendChatMessage(c1.name, c1.color, outcome, msg);
  }, 900);
}

function appendChatMessage(name, color, side, text) {
  const chatContainer = document.getElementById('liveChatStream');
  if (!chatContainer) return;

  const sideColor = side === 'Tài' ? '#ef4444' : '#3b82f6';

  const div = document.createElement('div');
  div.className = 'chat-msg-item';
  div.innerHTML = `<b style="color: ${color};">[${name}]:</b> chọn <b style="color: ${sideColor};">${side}</b>! "${text}"`;

  chatContainer.appendChild(div);

  if (chatContainer.children.length > 5) {
    chatContainer.removeChild(chatContainer.firstChild);
  }
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Kéo thả khung chat
document.addEventListener('DOMContentLoaded', () => {
  const chatPanel = document.querySelector('.live-chat-side-panel');
  if (!chatPanel) return;

  let isDraggingChat = false;
  let startX, startY;

  function dragStart(e) {
    isDraggingChat = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    startX = clientX - chatPanel.offsetLeft;
    startY = clientY - chatPanel.offsetTop;
    chatPanel.style.zIndex = 9999;
  }

  function drag(e) {
    if (!isDraggingChat) return;
    e.preventDefault();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    let newX = clientX - startX;
    let newY = clientY - startY;

    const maxX = window.innerWidth - chatPanel.offsetWidth;
    const maxY = window.innerHeight - chatPanel.offsetHeight;

    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));

    chatPanel.style.left = newX + 'px';
    chatPanel.style.top = newY + 'px';
    chatPanel.style.right = 'auto';
    chatPanel.style.transform = 'none';
  }

  function dragEnd() {
    isDraggingChat = false;
  }

  chatPanel.addEventListener('mousedown', dragStart);
  window.addEventListener('mousemove', drag);
  window.addEventListener('mouseup', dragEnd);

  chatPanel.addEventListener('touchstart', dragStart);
  window.addEventListener('touchmove', drag, { passive: false });
  window.addEventListener('touchend', dragEnd);
});