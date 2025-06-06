const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const socket = new WebSocket(`${protocol}//${window.location.host}`);

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startButton = document.getElementById('startButton');
const hangupButton = document.getElementById('hangupButton');
const shareLinkDiv = document.getElementById('shareLink');

let localStream = null;
let peerConnection = null;
let roomId = null;

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
};

startButton.onclick = async () => {
  roomId = window.location.pathname.split('/').pop();
  if (!roomId || roomId === '') {
    alert('Ошибка: ID комнаты не найден в URL');
    return;
  }

  startButton.disabled = true;
  hangupButton.disabled = false;

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  createPeerConnection();

  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  if (window.location.search.includes('caller=true')) {
    // Создаём предложение
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.send(JSON.stringify({ type: 'offer', offer: offer, room: roomId }));
  }
};

hangupButton.onclick = () => {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
    localVideo.srcObject = null;
  }
  remoteVideo.srcObject = null;
  startButton.disabled = false;
  hangupButton.disabled = true;
  socket.send(JSON.stringify({ type: 'hangup', room: roomId }));
};

// Функция создания RTCPeerConnection и обработчиков
function createPeerConnection() {
  peerConnection = new RTCPeerConnection(configuration);

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.send(JSON.stringify({ type: 'candidate', candidate: event.candidate, room: roomId }));
    }
  };

  peerConnection.ontrack = event => {
    remoteVideo.srcObject = event.streams[0];
  };
}

// WebSocket сообщения
socket.onopen = () => {
  // Сообщаем серверу, что присоединяемся к комнате
  roomId = window.location.pathname.split('/').pop();
  if (roomId) {
    socket.send(JSON.stringify({ type: 'join', room: roomId }));
    shareLinkDiv.innerHTML = `<p>Поделитесь ссылкой с собеседником:<br><a href="${window.location.href}?caller=true">${window.location.href}?caller=true</a></p>`;
  }
};

socket.onmessage = async event => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'offer':
      if (!peerConnection) createPeerConnection();
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.send(JSON.stringify({ type: 'answer', answer: answer, room: roomId }));
      break;

    case 'answer':
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      break;

    case 'candidate':
      if (data.candidate) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error('Ошибка добавления ICE кандидата', e);
        }
      }
      break;

    case 'hangup':
      if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
      }
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
        localVideo.srcObject = null;
      }
      remoteVideo.srcObject = null;
      startButton.disabled = false;
      hangupButton.disabled = true;
      break;

    default:
      break;
  }
};

socket.onclose = () => {
  console.log('WebSocket соединение закрыто');
  if (peerConnection) peerConnection.close();
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  startButton.disabled = false;
  hangupButton.disabled = true;
};
