const os = require('os');
const path = require('path');
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { createRoom, getRoom, removeRoom } = require('./rooms');
const { isValidGuess } = require('./wordle');

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.static(path.join(__dirname, '..', 'public')));

const httpServer = createServer(app);
const io = new Server(httpServer);

function promptFor(room) {
  if (room.mode === 'practice') return 'Guess the 5-letter word!';
  if (room.mode === 'test') {
    return `Word ${room.currentWordIndex + 1} of ${room.testWords.length} — listen to your teacher and spell it.`;
  }
  return 'Waiting for your teacher to start...';
}

function roundStatePayload(room) {
  return {
    mode: room.mode,
    wordIndex: room.currentWordIndex,
    totalWords: room.testWords.length,
    prompt: promptFor(room),
  };
}

function sendRosterUpdate(room) {
  io.to(room.teacherSocketId).emit('roster-update', {
    roster: room.getRoster(),
    ...roundStatePayload(room),
  });
}

io.on('connection', (socket) => {
  socket.on('create-room', () => {
    const room = createRoom(socket.id);
    socket.data.role = 'teacher';
    socket.data.roomCode = room.code;
    socket.join(room.code);
    socket.emit('room-created', { code: room.code });
    sendRosterUpdate(room);
  });

  socket.on('join-room', ({ name, code }) => {
    const room = getRoom(code);
    if (!room) {
      socket.emit('error', { message: `Room "${code || ''}" not found.` });
      return;
    }
    const cleanName = (name || 'Student').toString().trim().slice(0, 30) || 'Student';
    socket.data.role = 'student';
    socket.data.roomCode = room.code;
    socket.data.name = cleanName;
    socket.join(room.code);
    room.addStudent(socket.id, cleanName);
    socket.emit('room-joined', { code: room.code, name: cleanName });
    socket.emit('room-state', roundStatePayload(room));
    sendRosterUpdate(room);
  });

  socket.on('set-word', ({ word }) => {
    const room = requireTeacherRoom(socket);
    if (!room) return;
    if (!isValidGuess(word)) {
      socket.emit('error', { message: 'Word must be exactly 5 letters.' });
      return;
    }
    room.setWord(word);
    io.to(room.code).except(room.teacherSocketId).emit('round-start', roundStatePayload(room));
    sendRosterUpdate(room);
  });

  socket.on('start-test', ({ words }) => {
    const room = requireTeacherRoom(socket);
    if (!room) return;
    const list = Array.isArray(words) ? words.map((w) => (w || '').trim()) : [];
    if (list.length === 0 || !list.every(isValidGuess)) {
      socket.emit('error', { message: 'All test words must be exactly 5 letters, one per line.' });
      return;
    }
    room.startTest(list);
    io.to(room.code).except(room.teacherSocketId).emit('round-start', roundStatePayload(room));
    sendRosterUpdate(room);
  });

  socket.on('next-word', () => {
    const room = requireTeacherRoom(socket);
    if (!room || room.mode !== 'test') return;
    const advanced = room.nextWord();
    if (advanced) {
      io.to(room.code).except(room.teacherSocketId).emit('round-start', roundStatePayload(room));
      sendRosterUpdate(room);
    }
  });

  socket.on('end-test', () => {
    const room = requireTeacherRoom(socket);
    if (!room || room.mode !== 'test') return;
    socket.emit('test-complete', { summary: room.getTestSummary(), wordDifficulty: room.getWordDifficulty() });
    io.to(room.code).except(room.teacherSocketId).emit('test-finished');
  });

  socket.on('reveal-word', () => {
    const room = requireTeacherRoom(socket);
    if (!room) return;
    const word = room.currentSecretWord();
    if (word) {
      io.to(room.code).except(room.teacherSocketId).emit('word-revealed', { word });
    }
  });

  socket.on('submit-guess', ({ word }) => {
    const room = getRoom(socket.data.roomCode);
    if (!room || socket.data.role !== 'student') return;
    const result = room.submitGuess(socket.id, word);
    if (result.error) {
      socket.emit('error', { message: result.error });
      return;
    }
    socket.emit('guess-result', result);
    sendRosterUpdate(room);
  });

  socket.on('disconnect', () => {
    const room = getRoom(socket.data.roomCode);
    if (!room) return;
    if (socket.data.role === 'teacher') {
      io.to(room.code).except(room.teacherSocketId).emit('room-closed');
      removeRoom(room.code);
    } else if (socket.data.role === 'student') {
      room.removeStudent(socket.id);
      sendRosterUpdate(room);
    }
  });
});

function requireTeacherRoom(socket) {
  const room = getRoom(socket.data.roomCode);
  if (!room || socket.data.role !== 'teacher' || room.teacherSocketId !== socket.id) {
    socket.emit('error', { message: 'You are not hosting a room.' });
    return null;
  }
  return room;
}

function localNetworkAddress() {
  const nets = os.networkInterfaces();
  for (const iface of Object.values(nets)) {
    for (const net of iface || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

httpServer.listen(PORT, () => {
  const lan = localNetworkAddress();
  console.log(`Teacher's Wordle running:`);
  console.log(`  Local:   http://localhost:${PORT}`);
  if (lan) console.log(`  Network: http://${lan}:${PORT}  (share this with students on the same WiFi)`);
});
