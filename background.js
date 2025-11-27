let timerState = {
  isRunning: false,
  mode: 'timer', // 'timer' or 'stopwatch'
  initialTime: 300, // Default 5 minutes
  currentTime: 300,
  targetEndTime: null,
  startTime: null,
  elapsedBeforeStart: 0,
};

const TIMER_ALARM_NAME = 'floating-timer-finish';

// Load state from storage when the extension starts
chrome.storage.local.get(['timerState'], (result) => {
  if (result.timerState) {
    timerState = {
      isRunning: false,
      mode: 'timer',
      initialTime: 300,
      currentTime: 300,
      targetEndTime: null,
      startTime: null,
      elapsedBeforeStart: 0,
      ...result.timerState,
    };
  }
});

function startTimer() {
  if (timerState.isRunning) return;

  const now = Date.now();

  if (timerState.mode === 'timer') {
    const currentSeconds = typeof timerState.currentTime === 'number'
      ? timerState.currentTime
      : timerState.initialTime;

    const safeSeconds = Math.max(0, Math.floor(currentSeconds));
    timerState.currentTime = safeSeconds;

    if (safeSeconds > 0) {
      timerState.isRunning = true;
      timerState.targetEndTime = now + safeSeconds * 1000;

      chrome.alarms.clear(TIMER_ALARM_NAME, () => {
        chrome.alarms.create(TIMER_ALARM_NAME, { when: timerState.targetEndTime });
      });
    } else {
      timerState.isRunning = false;
      timerState.targetEndTime = null;
    }
  } else {
    const baseElapsed = typeof timerState.currentTime === 'number'
      ? timerState.currentTime
      : 0;

    timerState.elapsedBeforeStart = baseElapsed;
    timerState.startTime = now;
    timerState.isRunning = true;
  }

  saveState();
  broadcastState();
  injectContentScript();
}

function pauseTimer() {
  const now = Date.now();

  if (timerState.mode === 'timer') {
    if (timerState.isRunning && timerState.targetEndTime) {
      const remainingMs = timerState.targetEndTime - now;
      const remainingSeconds = Math.max(0, Math.round(remainingMs / 1000));
      timerState.currentTime = remainingSeconds;
    }
    timerState.isRunning = false;
    timerState.targetEndTime = null;
    chrome.alarms.clear(TIMER_ALARM_NAME);
  } else {
    if (timerState.isRunning && timerState.startTime) {
      const elapsedMs = now - timerState.startTime;
      const deltaSeconds = Math.max(0, elapsedMs / 1000);
      timerState.elapsedBeforeStart = (timerState.elapsedBeforeStart || 0) + deltaSeconds;
    }
    timerState.currentTime = timerState.elapsedBeforeStart || 0;
    timerState.isRunning = false;
    timerState.startTime = null;
  }

  saveState();
  broadcastState();
}

function resetTimer() {
  pauseTimer();
  if (timerState.mode === 'timer') {
    timerState.currentTime = timerState.initialTime;
    timerState.targetEndTime = null;
  } else {
    timerState.currentTime = 0;
    timerState.elapsedBeforeStart = 0;
    timerState.startTime = null;
  }
  saveState();
  broadcastState();
}

function setTimer(mode, time) {
  pauseTimer();
  if (mode) timerState.mode = mode;

  if (timerState.mode === 'timer') {
    if (time !== undefined) timerState.initialTime = time;
    timerState.currentTime = timerState.initialTime;
    timerState.targetEndTime = null;
  } else { // stopwatch
    timerState.initialTime = 0;
    timerState.currentTime = 0;
    timerState.elapsedBeforeStart = 0;
    timerState.startTime = null;
  }

  saveState();
  broadcastState();
}

function saveState() {
  chrome.storage.local.set({ timerState });
}

function getDerivedState() {
  const now = Date.now();
  const state = { ...timerState };

  if (state.mode === 'timer') {
    if (state.isRunning && state.targetEndTime) {
      const remainingMs = state.targetEndTime - now;
      const remainingSeconds = Math.max(0, Math.round(remainingMs / 1000));
      state.currentTime = remainingSeconds;

      if (remainingSeconds <= 0) {
        state.isRunning = false;
        state.targetEndTime = null;
      }
    }
  } else {
    const baseElapsed = state.elapsedBeforeStart || 0;

    if (state.isRunning && state.startTime) {
      const elapsedMs = now - state.startTime;
      const totalSeconds = baseElapsed + Math.max(0, elapsedMs / 1000);
      state.currentTime = totalSeconds;
    } else {
      state.currentTime = baseElapsed;
    }
  }

  timerState = {
    ...timerState,
    isRunning: state.isRunning,
    currentTime: state.currentTime,
    targetEndTime: state.targetEndTime,
  };

  return state;
}

function broadcastState() {
  const state = getDerivedState();

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].id) {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { command: 'update', state },
        () => {
          if (chrome.runtime.lastError) {
            // Ignore when there is no receiver or the page is restricted
          }
        }
      );
    }
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.command) {
    case 'start':
      startTimer();
      break;
    case 'pause':
      pauseTimer();
      break;
    case 'reset':
      resetTimer();
      break;
    case 'set':
      setTimer(request.mode, request.time);
      break;
    case 'getState':
      sendResponse(getDerivedState());
      broadcastState(); // Also update content script when popup opens
      break;
  }
  return true; // for async response
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== TIMER_ALARM_NAME) {
    return;
  }

  const state = getDerivedState();

  if (state.mode === 'timer') {
    timerState.isRunning = false;
    timerState.currentTime = 0;
    timerState.targetEndTime = null;
    chrome.alarms.clear(TIMER_ALARM_NAME);
    saveState();
    broadcastState();
  }
});

// Inject content script into the active tab
function injectContentScript() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].id) {
      chrome.scripting.executeScript(
        {
          target: { tabId: tabs[0].id },
          files: ['content.js']
        },
        () => {
          if (chrome.runtime.lastError) {
            // Ignore pages we cannot inject into (e.g. chrome://, Web Store)
          }
        }
      );
      chrome.scripting.insertCSS(
        {
          target: { tabId: tabs[0].id },
          files: ['content.css']
        },
        () => {
          if (chrome.runtime.lastError) {
            // Ignore pages we cannot inject into
          }
        }
      );
    }
  });
}