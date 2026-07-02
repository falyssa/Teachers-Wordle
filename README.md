# Teacher's Wordle

A live, teacher-hosted Wordle-style game for classroom spelling practice and tests. The teacher sets the word(s); students join from their own device and guess Wordle-style, with real-time color feedback so the teacher can see mistakes as they happen.

## Live Demo

**[falyssas-teachers-wordle.onrender.com](https://falyssas-teachers-wordle.onrender.com/)**

Hosted on Render's free tier, so if nobody's used it in a while, the first load can take up to a minute to spin back up — just give it a moment. It'll be instant for everyone else after that.

## Quick Start

**1. Requirements** — [Node.js](https://nodejs.org/) (LTS version). This installs both `node` and `npm`. If you're not sure whether you have it, open a terminal and run `node -v` — if that prints a version number, you're set.

**2. Get the code**

```
git clone https://github.com/falyssa/Teachers-Wordle.git
cd Teachers-Wordle
```

(Or just download the ZIP from GitHub and unzip it, if you don't use git.)

**3. Install and run**

```
npm install
npm start
```

The terminal will print two URLs:

```
Teacher's Wordle running:
  Local:   http://localhost:3000
  Network: http://192.168.x.x:3000  (share this with students on the same WiFi)
```

**4. Open it in your browser**

- On the **teacher's computer**, open the `Local` URL and click "Teacher". A 4-letter room code will appear — that's what your class will use to join.
- On **student devices** (same WiFi network as the teacher's computer), open the `Network` URL, click "Student", enter a name and the room code, and you're in.

## Using it

**Practice / Live mode** — type a 5-letter word and click "Start Round". Students get a private 6-row Wordle grid and guess independently; the teacher dashboard shows each student's live progress (attempts used, solved, last guess's colors). "Reveal Word to Class" ends the round for everyone.

**Test mode** — paste in an ordered list of words (one per line) in the "Test mode" box and click "Start Test". Students only ever see a prompt like *"Word 2 of 10 — listen to your teacher and spell it"* — the word itself is never sent to their browser, so the teacher says it aloud as in a normal spelling test. Use "Next Word" to advance the class, and "Finish Test" to see a per-student results summary (which words were correct, how many attempts each took).

## How it works

- `server/index.js` — Express serves the static frontend; Socket.io handles all real-time events (join room, set word, submit guess, etc).
- `server/rooms.js` — in-memory room/session state (no database yet — state resets when the server restarts).
- `server/wordle.js` — the actual Wordle scoring algorithm (green/yellow/gray). Scoring happens server-side only, so the secret word is never shipped to student browsers.
- `public/` — plain HTML/CSS/JS frontend (ES modules, no build step). `public/js/grid.js` is the shared Wordle grid + on-screen keyboard used by both the teacher and student pages.

## Future Work (Ideas/Updates)

- Teacher accounts and persistent classrooms (students join a standing class, not just a one-off room code)
- Saved word lists / past test results (currently everything is in-memory and lost on server restart)
- Optional text-to-speech word playback for test mode, as an alternative to the teacher speaking aloud
