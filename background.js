let timerState = {
  isRunning: false,
  mode: 'timer', // 'timer' or 'stopwatch'
  initialTime: 300, // Default 5 minutes
  currentTime: 300,
};

let timerInterval = null;

// Load state from storage when the extension starts
chrome.storage.local.get(['timerState'], (result) => {
  if (result.timerState) {
    timerState = result.timerState;
  }
});

function startTimer() {
  if (timerState.isRunning) return;
  timerState.isRunning = true;
  saveState();
  
  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    if (timerState.mode === 'timer') {
      if (timerState.currentTime > 0) {
        timerState.currentTime--;
      } else {
        // Timer finished
        pauseTimer(); // Stop the interval
        timerState.currentTime = 0;
      }
    } else { // Stopwatch
      timerState.currentTime++;
    }
    broadcastState();
    saveState();
  }, 1000);
  injectContentScript();
}

function pauseTimer() {
  timerState.isRunning = false;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  saveState();
  broadcastState();
}

function resetTimer() {
  pauseTimer();
  if (timerState.mode === 'timer') {
    timerState.currentTime = timerState.initialTime;
  } else {
    timerState.currentTime = 0;
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
  } else { // stopwatch
    timerState.initialTime = 0;
    timerState.currentTime = 0;
  }
  
  saveState();
  broadcastState();
}

function saveState() {
  chrome.storage.local.set({ timerState });
}

function broadcastState() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].id) {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { command: 'update', state: timerState },
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
      sendResponse(timerState);
      broadcastState(); // Also update content script when popup opens
      break;
  }
  return true; // for async response
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