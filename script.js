document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const timeLeftDisplay = document.getElementById('time-left');
  const timerLabel = document.getElementById('timer-label');
  const startStopBtn = document.getElementById('start_stop');
  const resetBtn = document.getElementById('reset');
  
  const sessionLengthDisplay = document.getElementById('session-length');
  const sessionIncBtn = document.getElementById('session-increment');
  const sessionDecBtn = document.getElementById('session-decrement');
  
  const breakLengthDisplay = document.getElementById('break-length');
  const breakIncBtn = document.getElementById('break-increment');
  const breakDecBtn = document.getElementById('break-decrement');
  
  const historyList = document.getElementById('history-list');

  // State
  let sessionLength = 25;
  let breakLength = 5;
  let timeLeft = sessionLength * 60;
  let isTimerRunning = false;
  let isSession = true;
  let timerInterval = null;
  let audioCtx = null;

  // Play Audio Cue via Web Audio API
  function playAudioCue(type = 'end') {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = 'sine';
    
    if (type === 'start') {
      oscillator.frequency.setValueAtTime(660, audioCtx.currentTime); // E5 note for start
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3);
    } else {
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note for end
      gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 1);
    }
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
  }

  // Update Display
  function updateDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timeLeftDisplay.textContent = 
      `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  // Start / Stop Timer
  function toggleTimer(isAuto = false) {
    if (isTimerRunning) {
      clearInterval(timerInterval);
      isTimerRunning = false;
    } else {
      if (!isAuto) playAudioCue('start');
      isTimerRunning = true;
      timerInterval = setInterval(() => {
        timeLeft--;
        updateDisplay();

        if (timeLeft < 0) {
          playAudioCue('end');
          // Switch mode
          clearInterval(timerInterval);
          
          if (isSession) {
            // Session just ended
            addHistoryRecord('Session', sessionLength);
            isSession = false;
            timerLabel.textContent = 'Break';
            timeLeft = breakLength * 60;
            document.querySelector('.timer').classList.add('break-mode');
          } else {
            // Break just ended
            addHistoryRecord('Break', breakLength);
            isSession = true;
            timerLabel.textContent = 'Session';
            timeLeft = sessionLength * 60;
            document.querySelector('.timer').classList.remove('break-mode');
          }
          
          updateDisplay();
          isTimerRunning = false;
          toggleTimer(true); // Restart automatically for the next mode
        }
      }, 1000);
    }
  }

  // Reset
  function resetTimer() {
    clearInterval(timerInterval);
    isTimerRunning = false;
    isSession = true;
    sessionLength = 25;
    breakLength = 5;
    timeLeft = sessionLength * 60;
    
    sessionLengthDisplay.textContent = sessionLength;
    breakLengthDisplay.textContent = breakLength;
    timerLabel.textContent = 'Session';
    document.querySelector('.timer').classList.remove('break-mode');
    
    updateDisplay();
  }

  // Adjust Length
  function adjustLength(type, change) {
    if (isTimerRunning) return; // Prevent adjustment while timer is running

    if (type === 'session') {
      sessionLength += change;
      if (sessionLength < 1) sessionLength = 1;
      if (sessionLength > 60) sessionLength = 60;
      sessionLengthDisplay.textContent = sessionLength;
      if (isSession) {
        timeLeft = sessionLength * 60;
        updateDisplay();
      }
    } else {
      breakLength += change;
      if (breakLength < 1) breakLength = 1;
      if (breakLength > 60) breakLength = 60;
      breakLengthDisplay.textContent = breakLength;
      if (!isSession) {
        timeLeft = breakLength * 60;
        updateDisplay();
      }
    }
  }

  // History Management
  let historyData = [];

  function getTodayString() {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`;
  }

  function loadHistory() {
    const saved = localStorage.getItem('pomotimer_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.date === getTodayString()) {
          historyData = parsed.records || [];
          historyData.forEach(record => {
            renderHistoryRecord(record.type, record.duration, record.timeStr);
          });
        } else {
          // New day, clear history
          localStorage.removeItem('pomotimer_history');
        }
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }

  function renderHistoryRecord(type, duration, timeStr) {
    const li = document.createElement('li');
    li.textContent = `${type} (${duration}m) - Ended at ${timeStr}`;
    historyList.appendChild(li);
  }

  // Add History Record
  function addHistoryRecord(type, duration) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Save to State & LocalStorage
    historyData.unshift({ type, duration, timeStr });
    localStorage.setItem('pomotimer_history', JSON.stringify({
      date: getTodayString(),
      records: historyData
    }));
    
    // Add to top of list horizontally in UI
    const li = document.createElement('li');
    li.textContent = `${type} (${duration}m) - Ended at ${timeStr}`;
    historyList.insertBefore(li, historyList.firstChild);
  }

  // Event Listeners
  startStopBtn.addEventListener('click', () => toggleTimer(false));
  resetBtn.addEventListener('click', resetTimer);

  sessionIncBtn.addEventListener('click', () => adjustLength('session', 1));
  sessionDecBtn.addEventListener('click', () => adjustLength('session', -1));
  breakIncBtn.addEventListener('click', () => adjustLength('break', 1));
  breakDecBtn.addEventListener('click', () => adjustLength('break', -1));

  // Initial Display
  updateDisplay();
  loadHistory();
});
