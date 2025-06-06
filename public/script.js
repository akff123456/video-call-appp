const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startButton = document.getElementById('startButton');
const hangupButton = document.getElementById('hangupButton');
const shareLinkDiv = document.getElementById('shareLink');

let localStream;
let peerConnection;
let ws;
let roomId;

// Берём ID комнаты из URL, например /call/1234 -> '1234'
const pathParts = window.location.pathname.split('/');
roomId = pathParts[pathParts.length - 1];

if (!roomId) {
    alert('Ошибка: ID комнаты не найден в URL');
}

// WebSocket по WSS, чтобы не было ошибки mixed content
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.host}`;
ws = new WebSocket(wsUrl);

ws.onopen = () => {
    console.log('WebSocket соединение установлено');
    ws.send(JSON.stringify({ type: 'join', room: roomId }));
};

ws.onmessage = async (event) => {
    const data = JSON.parse(event.data);

    if (!peerConnection) return;

    switch (data.type) {
        case 'offer':
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: 'answer', answer: answer, room: roomId }));
            break;
        case 'answer':
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            break;
        case 'candidate':
            if (data.candidate) {
                try {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (e) {
                    console.error('Ошибка добавления ICE кандидата:', e);
                }
            }
            break;
    }
};

ws.onerror = (err) => {
    console.error('WebSocket ошибка:', err);
};

startButton.onclick = async () => {
    startButton.disabled = true;
    hangupButton.disabled = false;

    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    peerConnection = new RTCPeerConnection();

    // Отправка ICE кандидатов в другую сторону
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            ws.send(JSON.stringify({ type: 'candidate', candidate: event.candidate, room: roomId }));
        }
    };

    // Получение удалённого потока
    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    // Добавляем локальные треки в peer connection
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // Создаём оффер и отправляем
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: 'offer', offer: offer, room: roomId }));

    // Показываем ссылку, чтобы пригласить другого человека
    shareLinkDiv.innerHTML = `<p>Пригласить другого человека по ссылке: <a href="${window.location.href}" target="_blank">${window.location.href}</a></p>`;
};

hangupButton.onclick = () => {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    remoteVideo.srcObject = null;
    localVideo.srcObject = null;

    startButton.disabled = false;
    hangupButton.disabled = true;
    shareLinkDiv.innerHTML = '';
};
