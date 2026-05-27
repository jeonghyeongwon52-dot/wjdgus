const socket = io();

const messages = document.getElementById('messages');
const form = document.getElementById('form');
const input = document.getElementById('input');
const roomInput = document.getElementById('room-input');
const joinBtn = document.getElementById('join-btn');
const nicknameInput = document.getElementById('nickname-input');
const setNicknameBtn = document.getElementById('set-nickname-btn');
const userCountDisplay = document.getElementById('user-count');
const typingIndicator = document.getElementById('typing-indicator');

let typing = false;
let timeout = undefined;

// 1. 닉네임 설정
setNicknameBtn.addEventListener('click', () => {
  const name = nicknameInput.value;
  if (name) {
    socket.emit('set nickname', name);
    alert(`닉네임이 "${name}"으로 설정되었습니다.`);
  }
});

// 2. 방 접속
joinBtn.addEventListener('click', () => {
  const roomName = roomInput.value;
  if (roomName) {
    socket.emit('join room', roomName);
    messages.innerHTML = ''; 
  }
});

// 3. 메시지 전송
form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (input.value) {
    socket.emit('chat message', input.value);
    input.value = '';
    typing = false;
    socket.emit('stop typing');
  }
});

// 4. 타이핑 감지
input.addEventListener('input', () => {
  if (!typing) {
    typing = true;
    socket.emit('typing');
  }
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    typing = false;
    socket.emit('stop typing');
  }, 1000);
});

// --- 소켓 이벤트 리스너 ---

// 메시지 수신
socket.on('chat message', (data) => {
  const item = document.createElement('li');
  if (data.system) {
    item.style.color = 'gray';
    item.style.fontStyle = 'italic';
    item.textContent = data.msg;
  } else {
    item.innerHTML = `<strong>${data.username}</strong> [${data.time}]: ${data.msg}`;
  }
  messages.appendChild(item);
  window.scrollTo(0, document.body.scrollHeight);
});

// 타이핑 상태 수신
socket.on('typing', (data) => {
  typingIndicator.textContent = `${data.username}님이 입력 중입니다...`;
});

socket.on('stop typing', () => {
  typingIndicator.textContent = '';
});

// 접속자 수 수신
socket.on('user count', (count) => {
  userCountDisplay.textContent = `현재 접속자: ${count}명`;
});
