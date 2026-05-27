require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const helmet = require('helmet');
const compression = require('compression');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// [추가] Redis 어댑터 설정 (다중 인스턴스/클러스터 모드에서 Socket.io 동기화용)
if (process.env.REDIS_URL) {
  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();
  
  Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    console.log('Socket.io Redis adapter connected');
  }).catch(err => {
    console.error('Redis adapter connection error:', err);
  });
}

// 1. 보안 설정: HTTP 헤더 보호
app.use(helmet({
  contentSecurityPolicy: false, 
}));

// 2. 성능 설정: 응답 압축 (Gzip)
app.use(compression());

// [추가] 헬스체크 엔드포인트: 컨테이너 상태 확인용
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.use(express.json());
app.use(express.static('public'));

// 3. 보안 설정: 관리자용 API 키 검증 미들웨어
const adminAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (process.env.ADMIN_API_KEY && apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
  }
  next();
};

// [추가] 특정 방 공지 라우터 (보안 강화)
app.post('/send-to-room', adminAuth, (req, res) => {
  const { roomName, message } = req.body;
  if (!roomName || !message) return res.status(400).json({ error: '데이터 부족' });
  io.to(roomName).emit('chat message', { system: true, msg: `[방 공지] ${message}` });
  res.json({ success: true });
});

// [추가] 전체 서버 공지 라우터 (보안 강화)
app.post('/announce', adminAuth, (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: '메시지 없음' });
  io.emit('chat message', { system: true, msg: `[전체 공지] ${message}` });
  res.json({ success: true });
});

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);
  let currentRoom = null;
  let username = socket.id.substring(0, 5); 

  io.emit('user count', io.engine.clientsCount);

  socket.on('set nickname', (name) => {
    username = name;
  });

  socket.on('join room', (roomName) => {
    if (currentRoom) {
      socket.leave(currentRoom);
    }
    socket.join(roomName);
    currentRoom = roomName;
    
    socket.emit('chat message', { system: true, msg: `${roomName} 방에 접속했습니다.` });
    socket.broadcast.to(roomName).emit('chat message', { system: true, msg: `${username}님이 입장했습니다.` });
  });
  
  socket.on('chat message', (msg) => {
    const messageData = { username: username, msg: msg, time: new Date().toLocaleTimeString() };
    if (currentRoom) {
      io.to(currentRoom).emit('chat message', messageData);
    } else {
      io.emit('chat message', messageData);
    }
  });

  socket.on('typing', () => {
    if (currentRoom) {
      socket.broadcast.to(currentRoom).emit('typing', { username: username });
    }
  });

  socket.on('stop typing', () => {
    if (currentRoom) {
      socket.broadcast.to(currentRoom).emit('stop typing');
    }
  });

  socket.on('disconnect', () => {
    if (currentRoom) {
      socket.broadcast.to(currentRoom).emit('chat message', { system: true, msg: `${username}님이 퇴장했습니다.` });
    }
    io.emit('user count', io.engine.clientsCount);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

// 4. 안정성: Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
