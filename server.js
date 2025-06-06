const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

const rooms = new Map();

wss.on('connection', (ws) => {
    let currentRoom = null;

    ws.on('message', (msg) => {
        const data = JSON.parse(msg);

        if (data.type === 'join') {
            currentRoom = data.room;
            if (!rooms.has(currentRoom)) {
                rooms.set(currentRoom, []);
            }
            rooms.get(currentRoom).push(ws);
            return;
        }

        if (currentRoom) {
            for (const client of rooms.get(currentRoom)) {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            }
        }
    });

    ws.on('close', () => {
        if (currentRoom && rooms.has(currentRoom)) {
            const filtered = rooms.get(currentRoom).filter(c => c !== ws);
            rooms.set(currentRoom, filtered);
        }
    });
});

app.get('/', (req, res) => {
    res.send(`
        <html>
        <head><title>Видеозвонок</title></head>
        <body style="text-align:center; font-family:sans-serif; margin-top:50px;">
            <h1>Добро пожаловать</h1>
            <a href="/call"><button style="font-size:20px;padding:10px 20px;">Создать звонок</button></a>
        </body>
        </html>
    `);
});

app.get('/call', (req, res) => {
    const roomId = uuidv4();
    res.redirect(`/call/${roomId}`);
});

app.get('/call/:room', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`🚀 Сервер запущен: http://localhost:${PORT}`);
});
