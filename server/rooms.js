const { scoreGuess, isValidGuess, MAX_ATTEMPTS } = require('./wordle');

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O, avoid look-alikes
const rooms = new Map(); // code -> Room

function generateRoomCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () =>
      ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]
    ).join('');
  } while (rooms.has(code));
  return code;
}

class Room {
  constructor(code, teacherSocketId) {
    this.code = code;
    this.teacherSocketId = teacherSocketId;
    this.mode = 'idle'; // 'idle' | 'practice' | 'test'
    this.word = null; // practice mode secret word
    this.testWords = []; // test mode word list
    this.currentWordIndex = -1;
    this.students = new Map(); // socketId -> StudentState
  }

  addStudent(socketId, name) {
    this.students.set(socketId, {
      name,
      guesses: [],
      attemptsLeft: MAX_ATTEMPTS,
      solved: false,
      testResults: [],
    });
  }

  removeStudent(socketId) {
    this.students.delete(socketId);
  }

  resetStudentRound() {
    for (const student of this.students.values()) {
      student.guesses = [];
      student.attemptsLeft = MAX_ATTEMPTS;
      student.solved = false;
    }
  }

  setWord(word) {
    this.mode = 'practice';
    this.word = word.toUpperCase();
    this.testWords = [];
    this.currentWordIndex = -1;
    this.resetStudentRound();
  }

  startTest(words) {
    this.mode = 'test';
    this.word = null;
    this.testWords = words.map((w) => w.toUpperCase());
    this.currentWordIndex = 0;
    for (const student of this.students.values()) {
      student.testResults = [];
    }
    this.resetStudentRound();
  }

  currentSecretWord() {
    if (this.mode === 'practice') return this.word;
    if (this.mode === 'test') return this.testWords[this.currentWordIndex] || null;
    return null;
  }

  nextWord() {
    if (this.mode !== 'test') return false;
    if (this.currentWordIndex >= this.testWords.length - 1) return false;
    this.currentWordIndex += 1;
    this.resetStudentRound();
    return true;
  }

  isTestComplete() {
    return this.mode === 'test' && this.currentWordIndex >= this.testWords.length - 1;
  }

  submitGuess(socketId, rawGuess) {
    const student = this.students.get(socketId);
    if (!student) return { error: 'You are not in this room.' };
    if (!isValidGuess(rawGuess)) return { error: 'Guess must be a 5-letter word.' };
    if (student.solved) return { error: 'You already solved this word.' };
    if (student.attemptsLeft <= 0) return { error: 'No attempts left.' };

    const secret = this.currentSecretWord();
    if (!secret) return { error: 'No word has been set yet.' };

    const colors = scoreGuess(rawGuess, secret);
    const correct = colors.every((c) => c === 'green');

    student.guesses.push({ guess: rawGuess.toUpperCase(), colors });
    student.attemptsLeft -= 1;
    if (correct) student.solved = true;

    if (this.mode === 'test' && (correct || student.attemptsLeft <= 0)) {
      student.testResults.push({
        wordIndex: this.currentWordIndex,
        word: secret,
        correct,
        attemptsUsed: student.guesses.length,
        guesses: student.guesses.slice(),
      });
    }

    return {
      guess: rawGuess.toUpperCase(),
      colors,
      correct,
      attemptsLeft: student.attemptsLeft,
      gameOver: correct || student.attemptsLeft <= 0,
    };
  }

  getRoster() {
    return Array.from(this.students.entries()).map(([socketId, s]) => ({
      socketId,
      name: s.name,
      attempts: s.guesses.length,
      attemptsLeft: s.attemptsLeft,
      solved: s.solved,
      lastGuessColors: s.guesses.length ? s.guesses[s.guesses.length - 1].colors : null,
      guesses: s.guesses.slice(),
      testResults: s.testResults.slice(),
    }));
  }

  getTestSummary() {
    return Array.from(this.students.values()).map((s) => ({
      name: s.name,
      results: s.testResults,
    }));
  }

  // Ranks each test word from easiest (fewest attempts on average) to
  // hardest (most attempts), aggregated across every student who reached it.
  getWordDifficulty() {
    const byWord = new Map(); // wordIndex -> { word, attemptsList, correctCount, total }
    for (const student of this.students.values()) {
      for (const r of student.testResults) {
        if (!byWord.has(r.wordIndex)) {
          byWord.set(r.wordIndex, { wordIndex: r.wordIndex, word: r.word, attemptsList: [], correctCount: 0, total: 0 });
        }
        const entry = byWord.get(r.wordIndex);
        entry.attemptsList.push(r.attemptsUsed);
        entry.total += 1;
        if (r.correct) entry.correctCount += 1;
      }
    }
    return Array.from(byWord.values())
      .map((e) => ({
        wordIndex: e.wordIndex,
        word: e.word,
        averageAttempts: e.attemptsList.reduce((a, b) => a + b, 0) / e.attemptsList.length,
        correctCount: e.correctCount,
        total: e.total,
      }))
      .sort((a, b) => a.averageAttempts - b.averageAttempts);
  }
}

function createRoom(teacherSocketId) {
  const code = generateRoomCode();
  const room = new Room(code, teacherSocketId);
  rooms.set(code, room);
  return room;
}

function getRoom(code) {
  return rooms.get((code || '').toUpperCase());
}

function removeRoom(code) {
  rooms.delete(code);
}

module.exports = { createRoom, getRoom, removeRoom, rooms };
