const socket = io();

const errorBanner = document.getElementById('error-banner');
const roomCodeEl = document.getElementById('room-code');
const wordInput = document.getElementById('word-input');
const setWordBtn = document.getElementById('set-word-btn');
const revealBtn = document.getElementById('reveal-btn');
const testWordsInput = document.getElementById('test-words-input');
const startTestBtn = document.getElementById('start-test-btn');
const testControls = document.getElementById('test-controls');
const testProgress = document.getElementById('test-progress');
const advanceTestBtn = document.getElementById('advance-test-btn');
const resultsCard = document.getElementById('results-card');
const resultsBody = document.getElementById('results-body');
const difficultyCard = document.getElementById('difficulty-card');
const difficultyBody = document.getElementById('difficulty-body');
const rosterList = document.getElementById('roster-list');
const studentCount = document.getElementById('student-count');

let latestRoster = [];
let latestMode = 'idle';
let latestWordIndex = -1;
let onLastWord = false;
const expandedRosterIds = new Set();
const expandedResultIndexes = new Set();

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.classList.add('show');
  clearTimeout(showError.timer);
  showError.timer = setTimeout(() => errorBanner.classList.remove('show'), 6000);
}

// Mirrors the server's 5-letter check (server/wordle.js isValidGuess) so a
// bad word list is caught before it's sent — otherwise the server silently
// rejects it and only the teacher sees a fleeting error banner, while
// students' screens just sit unchanged since no round-start is ever sent.
function parseTestWords(raw) {
  const lines = raw
    .split('\n')
    .map((w) => w.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return { error: 'Type at least one word (one per line) before starting the test.' };
  }
  const badWord = lines.find((w) => !/^[a-zA-Z]{5}$/.test(w));
  if (badWord) {
    return { error: `"${badWord}" isn't a 5-letter word — every line must be exactly 5 letters.` };
  }
  return { words: lines };
}

function buildTiles(colors) {
  const tiles = document.createElement('div');
  tiles.className = 'tiles';
  for (const color of colors) {
    const tile = document.createElement('div');
    tile.className = `wordle-tile mini ${color}`;
    tiles.appendChild(tile);
  }
  return tiles;
}

function buildGuessRow(guess) {
  const row = document.createElement('div');
  row.className = 'guess-row';
  const label = document.createElement('span');
  label.textContent = guess.guess;
  row.appendChild(label);
  row.appendChild(buildTiles(guess.colors));
  return row;
}

function renderRoster() {
  rosterList.innerHTML = '';
  for (const s of latestRoster) {
    const li = document.createElement('li');
    const expanded = expandedRosterIds.has(s.socketId);

    const header = document.createElement('div');
    header.className = 'roster-row-header';

    const left = document.createElement('div');
    const nameEl = document.createElement('div');
    nameEl.className = 'name';
    nameEl.textContent = `${s.name} ${expanded ? '▾' : '▸'}`;
    left.appendChild(nameEl);

    const statusEl = document.createElement('div');
    statusEl.className = s.solved ? 'status solved' : 'status';
    statusEl.textContent = s.solved
      ? `Solved in ${s.attempts}`
      : s.attemptsLeft <= 0
      ? 'Out of attempts'
      : `Attempt ${s.attempts}/6`;
    left.appendChild(statusEl);
    header.appendChild(left);
    li.appendChild(header);

    if (expanded) {
      const detail = document.createElement('div');
      detail.className = 'guess-history';

      if (latestMode === 'test') {
        const testResults = s.testResults || [];
        const hasHistory = testResults.length > 0;
        const hasCurrent = s.guesses.length > 0;
        for (const r of testResults) {
          const heading = document.createElement('div');
          heading.className = 'word-heading';
          heading.textContent = `Word ${r.wordIndex + 1}: ${r.word} — ${r.correct ? 'correct' : 'missed'} (${r.attemptsUsed} ${r.attemptsUsed === 1 ? 'try' : 'tries'})`;
          detail.appendChild(heading);
          r.guesses.forEach((g) => detail.appendChild(buildGuessRow(g)));
        }
        if (hasCurrent) {
          const heading = document.createElement('div');
          heading.className = 'word-heading';
          heading.textContent = `Word ${latestWordIndex + 1} (in progress)`;
          detail.appendChild(heading);
          s.guesses.forEach((g) => detail.appendChild(buildGuessRow(g)));
        }
        if (!hasHistory && !hasCurrent) {
          const empty = document.createElement('div');
          empty.className = 'empty-hint';
          empty.textContent = 'No guesses yet.';
          detail.appendChild(empty);
        }
      } else if (s.guesses.length) {
        s.guesses.forEach((g) => detail.appendChild(buildGuessRow(g)));
      } else {
        const empty = document.createElement('div');
        empty.className = 'empty-hint';
        empty.textContent = 'No guesses yet.';
        detail.appendChild(empty);
      }

      li.appendChild(detail);
    }

    li.addEventListener('click', () => {
      if (expanded) expandedRosterIds.delete(s.socketId);
      else expandedRosterIds.add(s.socketId);
      renderRoster();
    });

    rosterList.appendChild(li);
  }
}

socket.on('connect', () => socket.emit('create-room'));

socket.on('room-created', ({ code }) => {
  roomCodeEl.textContent = code;
});

socket.on('error', ({ message }) => showError(message));

socket.on('roster-update', ({ roster, mode, wordIndex, totalWords }) => {
  studentCount.textContent = roster.length;
  latestRoster = roster;
  latestMode = mode;
  latestWordIndex = wordIndex;
  renderRoster();

  if (mode === 'test') {
    testControls.style.display = 'block';
    testProgress.textContent = `Word ${wordIndex + 1} of ${totalWords}`;
    onLastWord = wordIndex >= totalWords - 1;
    advanceTestBtn.textContent = onLastWord ? 'Finish Test' : 'Next Word';
  } else {
    testControls.style.display = 'none';
  }
});

setWordBtn.addEventListener('click', () => {
  const word = wordInput.value.trim();
  socket.emit('set-word', { word });
});

revealBtn.addEventListener('click', () => socket.emit('reveal-word'));

startTestBtn.addEventListener('click', () => {
  const parsed = parseTestWords(testWordsInput.value);
  if (parsed.error) {
    showError(parsed.error);
    return;
  }
  resultsCard.style.display = 'none';
  difficultyCard.style.display = 'none';
  expandedResultIndexes.clear();
  socket.emit('start-test', { words: parsed.words });
});

advanceTestBtn.addEventListener('click', () => {
  socket.emit(onLastWord ? 'end-test' : 'next-word');
});

socket.on('test-complete', ({ summary, wordDifficulty }) => {
  renderDifficulty(wordDifficulty);
  renderResults(summary);
});

function renderDifficulty(wordDifficulty) {
  if (!wordDifficulty || !wordDifficulty.length) {
    difficultyCard.style.display = 'none';
    return;
  }
  difficultyCard.style.display = 'block';
  difficultyBody.innerHTML = '';
  const list = document.createElement('ul');
  list.className = 'difficulty-list';
  wordDifficulty.forEach((entry, i) => {
    const li = document.createElement('li');
    const rank = document.createElement('span');
    rank.className = 'difficulty-rank';
    rank.textContent = `#${i + 1}`;
    const word = document.createElement('span');
    word.className = 'difficulty-word';
    word.textContent = entry.word;
    const stats = document.createElement('span');
    stats.className = 'difficulty-stats';
    stats.textContent = `${entry.averageAttempts.toFixed(1)} avg attempts · ${entry.correctCount}/${entry.total} correct`;
    li.append(rank, word, stats);
    list.appendChild(li);
  });
  difficultyBody.appendChild(list);
}

function renderResults(summary) {
  resultsCard.style.display = 'block';
  resultsBody.innerHTML = '';
  summary.forEach((student, index) => {
    const wrap = document.createElement('div');
    wrap.className = 'student-result';

    const summaryLine = document.createElement('div');
    summaryLine.className = 'summary-line';
    const title = document.createElement('div');
    title.className = 'name';
    const correctCount = student.results.filter((r) => r.correct).length;
    title.textContent = `${student.name} ${expandedResultIndexes.has(index) ? '▾' : '▸'}`;
    const scoreEl = document.createElement('div');
    scoreEl.className = 'hint';
    scoreEl.textContent = student.results.length ? `${correctCount}/${student.results.length} correct` : 'No attempts recorded';
    summaryLine.append(title, scoreEl);
    wrap.appendChild(summaryLine);

    if (expandedResultIndexes.has(index)) {
      const detail = document.createElement('div');
      detail.className = 'guess-history';
      if (student.results.length) {
        for (const r of student.results) {
          const heading = document.createElement('div');
          heading.className = 'word-heading';
          heading.textContent = `${r.word} — ${r.correct ? 'correct' : 'missed'} (${r.attemptsUsed} ${r.attemptsUsed === 1 ? 'try' : 'tries'})`;
          detail.appendChild(heading);
          r.guesses.forEach((g) => detail.appendChild(buildGuessRow(g)));
        }
      } else {
        const empty = document.createElement('div');
        empty.className = 'empty-hint';
        empty.textContent = 'No attempts recorded.';
        detail.appendChild(empty);
      }
      wrap.appendChild(detail);
    }

    wrap.addEventListener('click', () => {
      if (expandedResultIndexes.has(index)) expandedResultIndexes.delete(index);
      else expandedResultIndexes.add(index);
      renderResults(summary);
    });

    resultsBody.appendChild(wrap);
  });
}
