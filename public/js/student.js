import { WordleGrid, buildKeyboard, listenPhysicalKeyboard } from './grid.js';

const socket = io();

const errorBanner = document.getElementById('error-banner');
const joinCard = document.getElementById('join-card');
const nameInput = document.getElementById('name-input');
const codeInput = document.getElementById('code-input');
const joinBtn = document.getElementById('join-btn');
const gameArea = document.getElementById('game-area');
const promptText = document.getElementById('prompt-text');
const gridEl = document.getElementById('grid');
const keyboardEl = document.getElementById('keyboard');

let grid = null;
let keyboardCtl = null;
let joined = false;

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.classList.add('show');
  setTimeout(() => errorBanner.classList.remove('show'), 4000);
}

joinBtn.addEventListener('click', () => {
  const name = nameInput.value.trim();
  const code = codeInput.value.trim().toUpperCase();
  if (!name || !code) {
    showError('Enter your name and the room code.');
    return;
  }
  socket.emit('join-room', { name, code });
});

socket.on('error', ({ message }) => showError(message));

socket.on('room-joined', () => {
  joined = true;
  joinCard.style.display = 'none';
  gameArea.style.display = 'block';
  grid = new WordleGrid(gridEl);
  keyboardCtl = buildKeyboard(keyboardEl, handleKey);
  listenPhysicalKeyboard((key) => {
    if (joined) handleKey(key);
  });
});

socket.on('room-state', (state) => {
  promptText.textContent = state.prompt;
});

socket.on('round-start', (state) => {
  if (grid) grid.reset();
  if (keyboardCtl) keyboardCtl.resetColors();
  promptText.textContent = state.prompt;
});

socket.on('guess-result', (result) => {
  if (!grid) return;
  grid.commitRow(result.colors);
  keyboardCtl.applyResult(result.guess, result.colors);
  if (result.correct) {
    promptText.textContent = 'Correct! Nicely spelled.';
  } else if (result.gameOver) {
    promptText.textContent = 'Out of attempts — wait for your teacher.';
  }
});

socket.on('word-revealed', ({ word }) => {
  if (grid) grid.lock();
  promptText.textContent = `The word was: ${word}`;
});

socket.on('test-finished', () => {
  if (grid) grid.lock();
  promptText.textContent = 'Test complete! Great job.';
});

socket.on('room-closed', () => {
  if (grid) grid.lock();
  promptText.textContent = 'Your teacher ended the session.';
});

function handleKey(key) {
  if (!grid || grid.locked) return;
  if (key === 'ENTER') {
    if (!grid.isRowFull()) {
      showError('Not enough letters.');
      return;
    }
    socket.emit('submit-guess', { word: grid.currentGuess() });
  } else if (key === 'BACK') {
    grid.backspace();
  } else if (/^[A-Z]$/.test(key)) {
    grid.typeLetter(key);
  }
}
