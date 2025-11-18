// --- DOM Elements ---
const timerTab = document.getElementById('timer-tab');
const stopwatchTab = document.getElementById('stopwatch-tab');
const timerView = document.getElementById('timer-view');
const stopwatchView = document.getElementById('stopwatch-view');
const statusDiv = document.getElementById('status');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');
const presetBtns = document.querySelectorAll('.preset-btn');
const customTimeInput = document.getElementById('custom-time-input');
const setCustomBtn = document.getElementById('set-custom-btn');

// --- Event Listeners ---

// Tab Switching
timerTab.addEventListener('click', () => switchMode('timer'));
stopwatchTab.addEventListener('click', () => switchMode('stopwatch'));

// Control Buttons
startBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ command: 'start' });
});
pauseBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ command: 'pause' });
});
resetBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ command: 'reset' });
});

// Timer-specific Buttons
presetBtns.forEach(button => {
  button.addEventListener('click', () => {
    const timeInSeconds = parseInt(button.dataset.time, 10);
    chrome.runtime.sendMessage({ command: 'set', mode: 'timer', time: timeInSeconds });
  });
});

setCustomBtn.addEventListener('click', () => {
  const timeString = customTimeInput.value;
  const parts = timeString.split(':').map(part => parseInt(part, 10) || 0);
  let seconds = 0;
  if (parts.length === 3) {
    seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    seconds = parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    seconds = parts[0];
  }
  if (seconds > 0) {
    chrome.runtime.sendMessage({ command: 'set', mode: 'timer', time: seconds });
    customTimeInput.value = '';
  }
});

// --- Functions ---
function switchMode(mode) {
  timerTab.classList.toggle('active', mode === 'timer');
  stopwatchTab.classList.toggle('active', mode === 'stopwatch');
  timerView.classList.toggle('active', mode === 'timer');
  stopwatchView.classList.toggle('active', mode === 'stopwatch');
  statusDiv.textContent = `Current Mode: ${mode.charAt(0).toUpperCase() + mode.slice(1)}`;
  chrome.runtime.sendMessage({ command: 'set', mode });
}

// Update UI based on current state from background
function updateUI(state) {
  const mode = state.mode || 'timer';
  timerTab.classList.toggle('active', mode === 'timer');
  stopwatchTab.classList.toggle('active', mode === 'stopwatch');
  timerView.classList.toggle('active', mode === 'timer');
  stopwatchView.classList.toggle('active', mode === 'stopwatch');
  statusDiv.textContent = `Current Mode: ${mode.charAt(0).toUpperCase() + mode.slice(1)}`;
}

// When popup opens, get the current state
document.addEventListener('DOMContentLoaded', () => {
  chrome.runtime.sendMessage({ command: 'getState' }, (response) => {
    if (response) {
      updateUI(response);
    }
  });
});