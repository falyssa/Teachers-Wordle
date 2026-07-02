export class WordleGrid {
  constructor(container, { rows = 6, cols = 5 } = {}) {
    this.container = container;
    this.rows = rows;
    this.cols = cols;
    this.tiles = [];
    this.currentRow = 0;
    this.currentCol = 0;
    this.locked = false;
    this._build();
  }

  _build() {
    this.container.innerHTML = '';
    this.container.classList.add('wordle-grid');
    for (let r = 0; r < this.rows; r++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'wordle-row';
      const rowTiles = [];
      for (let c = 0; c < this.cols; c++) {
        const tile = document.createElement('div');
        tile.className = 'wordle-tile';
        rowEl.appendChild(tile);
        rowTiles.push(tile);
      }
      this.container.appendChild(rowEl);
      this.tiles.push(rowTiles);
    }
  }

  reset() {
    this.currentRow = 0;
    this.currentCol = 0;
    this.locked = false;
    this.tiles.flat().forEach((t) => {
      t.textContent = '';
      t.className = 'wordle-tile';
    });
  }

  typeLetter(letter) {
    if (this.locked || this.currentRow >= this.rows || this.currentCol >= this.cols) return;
    const tile = this.tiles[this.currentRow][this.currentCol];
    tile.textContent = letter.toUpperCase();
    tile.classList.add('filled');
    this.currentCol++;
  }

  backspace() {
    if (this.locked || this.currentCol <= 0) return;
    this.currentCol--;
    const tile = this.tiles[this.currentRow][this.currentCol];
    tile.textContent = '';
    tile.classList.remove('filled');
  }

  currentGuess() {
    if (this.currentRow >= this.rows) return '';
    return this.tiles[this.currentRow].map((t) => t.textContent).join('');
  }

  isRowFull() {
    return this.currentCol === this.cols;
  }

  commitRow(colors) {
    const rowTiles = this.tiles[this.currentRow];
    colors.forEach((color, i) => {
      setTimeout(() => tile_flip(rowTiles[i], color), i * 150);
    });
    this.currentRow++;
    this.currentCol = 0;
    if (this.currentRow >= this.rows) this.locked = true;
  }

  lock() {
    this.locked = true;
  }
}

function tile_flip(tile, color) {
  tile.classList.add('flip', color);
}

const KEY_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK'],
];

const COLOR_RANK = { gray: 1, yellow: 2, green: 3 };

export function buildKeyboard(container, onKeyPress) {
  container.innerHTML = '';
  container.classList.add('keyboard');
  const keyElements = {};
  for (const row of KEY_ROWS) {
    const rowEl = document.createElement('div');
    rowEl.className = 'keyboard-row';
    for (const key of row) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'key' + (key.length > 1 ? ' wide' : '');
      btn.textContent = key === 'BACK' ? '⌫' : key;
      btn.addEventListener('click', () => onKeyPress(key));
      rowEl.appendChild(btn);
      if (key.length === 1) keyElements[key] = btn;
    }
    container.appendChild(rowEl);
  }
  return {
    resetColors() {
      Object.values(keyElements).forEach((btn) => btn.classList.remove('green', 'yellow', 'gray'));
    },
    applyResult(guess, colors) {
      guess.split('').forEach((letter, i) => {
        const btn = keyElements[letter.toUpperCase()];
        if (!btn) return;
        const newColor = colors[i];
        const current = ['green', 'yellow', 'gray'].find((c) => btn.classList.contains(c));
        if (!current || COLOR_RANK[newColor] > COLOR_RANK[current]) {
          btn.classList.remove('green', 'yellow', 'gray');
          btn.classList.add(newColor);
        }
      });
    },
  };
}

export function listenPhysicalKeyboard(onKeyPress) {
  const handler = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Enter') onKeyPress('ENTER');
    else if (e.key === 'Backspace') onKeyPress('BACK');
    else if (/^[a-zA-Z]$/.test(e.key)) onKeyPress(e.key.toUpperCase());
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}
