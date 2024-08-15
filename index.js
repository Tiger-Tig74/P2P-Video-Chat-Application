const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Serve static files from the 'public' directory
app.use('/', express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.IO connections
let connectedPeers = {};

io.on('connection', function (socket) {
    // Handle 'createOrJoin' event
    socket.on('createOrJoin', function (roomName) {
        const room = io.sockets.adapter.rooms.get(roomName) || { size: 0 };
        if (room.size === 0) {
            socket.join(roomName);
            connectedPeers[roomName] = socket.id;
            socket.emit('created', roomName);
        } else if (room.size === 1) {
            socket.join(roomName);
            connectedPeers[roomName] = socket.id;
            socket.emit('joined', roomName);
            io.to(roomName).emit('ready');
        } else {
            socket.emit('full', roomName);
        }
    });

    // Handle 'offer' event
    socket.on('offer', function (offer) {
        socket.to(Object.keys(socket.rooms)[1]).emit('offer', offer);
    });

    // Handle 'answer' event
    socket.on('answer', function (answer) {
        socket.to(Object.keys(socket.rooms)[0]).emit('answer', answer);
    });

    // Handle 'candidate' event
    socket.on('candidate', function (candidate) {
        socket.to(Object.keys(socket.rooms)[1]).emit('candidate', candidate);
    });

    // Handle disconnect event
    socket.on('disconnect', function () {
        Object.keys(io.sockets.adapter.rooms).forEach(roomName => {
            if (connectedPeers[roomName] === socket.id) {
                delete connectedPeers[roomName];
                io.to(roomName).emit('disconnected');
            }
        });
    });
});

server.listen(PORT, function () {
    console.log(`Server is running on http://localhost:${PORT}`);
});
