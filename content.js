var floatingTimer = null;
var lastTimerState = null;
var stopwatchIntervalId = null;
var lastUpdateTimeMs = 0;

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [
    h.toString().padStart(2, '0'),
    m.toString().padStart(2, '0'),
    s.toString().padStart(2, '0')
  ].join(':');
}

function formatStopwatchTime(seconds) {
  const totalTenths = Math.floor(seconds * 10);
  const tenths = totalTenths % 10;
  const totalWholeSeconds = Math.floor(totalTenths / 10);

  const h = Math.floor(totalWholeSeconds / 3600);
  const m = Math.floor((totalWholeSeconds % 3600) / 60);
  const s = totalWholeSeconds % 60;

  return [
    h.toString().padStart(2, '0'),
    m.toString().padStart(2, '0'),
    s.toString().padStart(2, '0')
  ].join(':') + '.' + tenths.toString();
}

function createFloatingTimer() {
  const existing = document.getElementById('floating-timer-container');
  if (existing) {
    floatingTimer = existing;
    return;
  }

  floatingTimer = document.createElement('div');
  floatingTimer.id = 'floating-timer-container';
  floatingTimer.innerHTML = `
    <div id="floating-timer-inner">
      <div id="timer-display">00:00:00</div>
      <div id="floating-controls">
        <button id="floating-start-btn" class="floating-control-btn">Start</button>
        <button id="floating-pause-btn" class="floating-control-btn">Pause</button>
        <button id="floating-reset-btn" class="floating-control-btn">Reset</button>
      </div>
    </div>
  `;
  document.body.appendChild(floatingTimer);

  const startBtn = floatingTimer.querySelector('#floating-start-btn');
  const pauseBtn = floatingTimer.querySelector('#floating-pause-btn');
  const resetBtn = floatingTimer.querySelector('#floating-reset-btn');

  if (startBtn) {
    startBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ command: 'start' });
    });
  }

  if (pauseBtn) {
    pauseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ command: 'pause' });
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ command: 'reset' });
    });
  }

  makeDraggable(floatingTimer);
}

function updateDisplay(state) {
    if (!floatingTimer) createFloatingTimer();
    const display = document.getElementById('timer-display');
    if (!display) return;

    lastTimerState = state;

    if (state.mode === 'stopwatch') {
        if (state.isRunning) {
            lastUpdateTimeMs = Date.now();
            startStopwatchAnimation();
        } else {
            stopStopwatchAnimation();
        }

        const baseSeconds = state.currentTime || 0;
        display.textContent = formatStopwatchTime(baseSeconds);
    } else {
        // Countdown timer: keep whole seconds only
        stopStopwatchAnimation();
        display.textContent = formatTime(state.currentTime);
    }

    // Add a visual cue when paused
    floatingTimer.classList.toggle('paused', !state.isRunning);
}


function startStopwatchAnimation() {
  if (stopwatchIntervalId) return;

  stopwatchIntervalId = setInterval(() => {
    if (!lastTimerState || !floatingTimer) return;
    if (lastTimerState.mode !== 'stopwatch') return;

    const display = document.getElementById('timer-display');
    if (!display) return;

    const baseSeconds = lastTimerState.currentTime || 0;
    let displaySeconds = baseSeconds;

    if (lastTimerState.isRunning && lastUpdateTimeMs) {
      const elapsedMs = Date.now() - lastUpdateTimeMs;
      if (elapsedMs >= 0) {
        displaySeconds = baseSeconds + elapsedMs / 1000;
      }
    }

    display.textContent = formatStopwatchTime(displaySeconds);
  }, 100);
}

function stopStopwatchAnimation() {
  if (stopwatchIntervalId) {
    clearInterval(stopwatchIntervalId);
    stopwatchIntervalId = null;
  }
}

function makeDraggable(element) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

  element.addEventListener('dragstart', (e) => {
    e.preventDefault();
  });

  element.addEventListener('mousedown', dragMouseDown);

  function dragMouseDown(e) {
    if (e.button !== 0) return;
    if (e.target.closest('.floating-control-btn')) {
      return;
    }

    const computedStyle = window.getComputedStyle(element);
    if (computedStyle.bottom !== 'auto' || computedStyle.right !== 'auto') {
      const rect = element.getBoundingClientRect();
      element.style.top = rect.top + 'px';
      element.style.left = rect.left + 'px';
      element.style.bottom = 'auto';
      element.style.right = 'auto';
    }

    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.addEventListener('mouseup', closeDragElement);
    document.addEventListener('mousemove', elementDrag);
  }

  function elementDrag(e) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    element.style.top = (element.offsetTop - pos2) + 'px';
    element.style.left = (element.offsetLeft - pos1) + 'px';
  }

  function closeDragElement() {
    document.removeEventListener('mouseup', closeDragElement);
    document.removeEventListener('mousemove', elementDrag);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === 'update') {
    updateDisplay(request.state);
  }
});

// Initial creation
createFloatingTimer();