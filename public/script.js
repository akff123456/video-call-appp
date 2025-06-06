let localStream;
let remoteStream;
let peerConnection;
const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const socket = new WebSocket(`ws://${location.host}`);

const roomId = window.location.pathname.split('/').pop();

socket.addEventListener('open', () => {
    if (roomId) {
        socket.send(JSON.stringify({ type: 'join', room: roomId }));
        showShareLink();
    }
});

function showShareLink() {
    const shareLinkDiv = document.getElementById('shareLink');
    shareLinkDiv.innerHTML = `🔗 Отправь эту ссылку другу для звонка:<br><b>${window.location.href}</b>`;
}

document.getElementById('startButton').onclick = async () => {
    try {
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

        document.getElementById('startButton').disabled = true;
        document.getElementById('hangupButton').disabled = false;
    } catch (err) {
        alert('Ошибка доступа к камере/микрофону: ' + err.message);
    }
};

document.getElementById('hangupButton').onclick = () => {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
        document.getElementById('localVideo').srcObject = null;
    }
    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        remoteStream = null;
        document.getElementById('remoteVideo').srcObject = null;
    }

    socket.send(JSON.stringify({ type: 'hangup' }));

    document.getElementById('startButton').disabled = false;
    document.getElementById('hangupButton').disabled = true;
};

socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'offer') {
        try {
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

            document.getElementById('startButton').disabled = true;
            document.getElementById('hangupButton').disabled = false;

            showShareLink();
        } catch (err) {
            alert('Ошибка доступа к камере/микрофону: ' + err.message);
        }
    }

    if (data.type === 'answer') {
        if (peerConnection) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
    }

    if (data.type === 'candidate') {
        if (peerConnection) {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (e) {
                console.error('Ошибка добавления ICE кандидата:', e);
            }
        }
    }

    if (data.type === 'hangup') {
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
            document.getElementById('localVideo').srcObject = null;
        }
        if (remoteStream) {
            remoteStream.getTracks().forEach(track => track.stop());
            remoteStream = null;
            document.getElementById('remoteVideo').srcObject = null;
        }
        document.getElementById('startButton').disabled = false;
        document.getElementById('hangupButton').disabled = true;
    }
};
