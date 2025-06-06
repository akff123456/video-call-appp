let localStream;
let remoteStream;
let peerConnection;
const roomId = window.location.pathname.split('/').pop();
const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const socket = new WebSocket(`wss://${location.host}`);

socket.addEventListener('open', () => {
    socket.send(JSON.stringify({ type: 'join', room: roomId }));
});

document.getElementById('startButton').onclick = async () => {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('localVideo').srcObject = localStream;

    peerConnection = new RTCPeerConnection(configuration);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
        }
    };

    peerConnection.ontrack = event => {
        remoteStream = event.streams[0];
        document.getElementById('remoteVideo').srcObject = remoteStream;
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.send(JSON.stringify({ type: 'offer', offer }));
};

document.getElementById('hangupButton').onclick = () => {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
        socket.send(JSON.stringify({ type: 'hangup' }));
    }
};

socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'offer') {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('localVideo').srcObject = localStream;

        peerConnection = new RTCPeerConnection(configuration);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                socket.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
            }
        };

        peerConnection.ontrack = event => {
            remoteStream = event.streams[0];
            document.getElementById('remoteVideo').srcObject = remoteStream;
        };

        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.send(JSON.stringify({ type: 'answer', answer }));
    }

    if (data.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    }

    if (data.type === 'candidate') {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }

    if (data.type === 'hangup') {
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
    }
};

// Показываем ссылку
if (window.location.pathname.startsWith('/call/')) {
    document.getElementById('shareLink').innerHTML =
        `🔗 Поделись этой ссылкой: <b>${window.location.href}</b>`;
}
