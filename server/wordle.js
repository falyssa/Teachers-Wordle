const WORD_LENGTH = 5;
const MAX_ATTEMPTS = 6;

/**
 * Standard two-pass Wordle scoring: exact matches first, then yellows
 * respecting the remaining letter counts in the target.
 * Returns an array of 'green' | 'yellow' | 'gray', one per letter of guess.
 */
function scoreGuess(guess, target) {
  const g = guess.toUpperCase().split('');
  const t = target.toUpperCase().split('');
  const result = new Array(WORD_LENGTH).fill('gray');
  const usedInTarget = new Array(WORD_LENGTH).fill(false);

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (g[i] === t[i]) {
      result[i] = 'green';
      usedInTarget[i] = true;
    }
  }

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === 'green') continue;
    const matchIndex = t.findIndex((ch, j) => ch === g[i] && !usedInTarget[j]);
    if (matchIndex !== -1) {
      result[i] = 'yellow';
      usedInTarget[matchIndex] = true;
    }
  }

  return result;
}

function isValidGuess(word) {
  return typeof word === 'string' && /^[a-zA-Z]{5}$/.test(word);
}

module.exports = { scoreGuess, isValidGuess, WORD_LENGTH, MAX_ATTEMPTS };
