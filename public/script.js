const roomId = window.location.pathname.split('/').pop();
const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const ws = new WebSocket(`ws://${location.host}`);

let localStream = null;
let remoteStream = null;
let peerConnection = null;

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startButton = document.getElementById('startButton');
const hangupButton = document.getElementById('hangupButton');
const shareLinkDiv = document.getElementById('shareLink');

ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'join', room: roomId }));

    // Показываем ссылку для приглашения
    const link = `${location.origin}/call/${roomId}`;
    shareLinkDiv.innerHTML = `🔗 Отправь эту ссылку другу для звонка:<br><b>${link}</b>`;
};

startButton.onclick = async () => {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    peerConnection = new RTCPeerConnection(configuration);

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            ws.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
        }
    };

    peerConnection.ontrack = event => {
        remoteStream = event.streams[0];
        remoteVideo.srcObject = remoteStream;
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    ws.send(JSON.stringify({ type: 'offer', offer }));
};

hangupButton.onclick = () => {
    // Останавливаем все треки локального потока
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localVideo.srcObject = null;
    }

    // Закрываем PeerConnection
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    // Закрываем WebSocket
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.send(JSON.stringify({ type: 'hangup' }));
        ws.close();
    }

    // Очищаем удалённое видео
    remoteVideo.srcObject = null;

    // Очистка ссылки, чтобы не звонили после завершения
    shareLinkDiv.innerHTML = '';
};

ws.onmessage = async (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'offer') {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;

        peerConnection = new RTCPeerConnection(configuration);

        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                ws.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
            }
        };

        peerConnection.ontrack = event => {
            remoteStream = event.streams[0];
            remoteVideo.srcObject = remoteStream;
        };

        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        ws.send(JSON.stringify({ type: 'answer', answer }));
    }

    if (data.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    }

    if (data.type === 'candidate') {
        if (peerConnection) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    }

    if (data.type === 'hangup') {
        // Если другой участник завершил звонок, очищаем всё
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        localVideo.srcObject = null;
        remoteVideo.srcObject = null;
        shareLinkDiv.innerHTML = 'Собеседник завершил звонок.';
    }
};
