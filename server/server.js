const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const GameManager = require('./game/GameManager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Game manager instance
const gameManager = new GameManager();

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Join game queue or create new game
    socket.on('findGame', (playerData) => {
        console.log(`Player ${socket.id} looking for game`);
        gameManager.findGame(socket, playerData);
    });

    // Join specific room
    socket.on('joinRoom', (roomId, playerData) => {
        console.log(`Player ${socket.id} joining room ${roomId}`);
        gameManager.joinRoom(socket, roomId, playerData);
    });

    // Create private room
    socket.on('createRoom', (playerData) => {
        console.log(`Player ${socket.id} creating private room`);
        gameManager.createPrivateRoom(socket, playerData);
    });

    // Generate game setup
    socket.on('generateSetup', (roomId) => {
        gameManager.generateSetup(socket, roomId);
    });

    // Manual piece placement
    socket.on('placePiece', (roomId, rank, file) => {
        gameManager.placePiece(socket, roomId, rank, file);
    });

    // Start game after setup
    socket.on('finishSetup', (roomId) => {
        gameManager.finishSetup(socket, roomId);
    });

    // Make move
    socket.on('makeMove', (roomId, moveData) => {
        gameManager.makeMove(socket, roomId, moveData);
    });

    // Game actions
    socket.on('resignGame', (roomId) => {
        gameManager.resignGame(socket, roomId);
    });

    socket.on('requestDraw', (roomId) => {
        gameManager.requestDraw(socket, roomId);
    });

    socket.on('respondDraw', (roomId, accept) => {
        gameManager.respondDraw(socket, roomId, accept);
    });

    // Chat messages
    socket.on('chatMessage', (roomId, message) => {
        gameManager.sendChatMessage(socket, roomId, message);
    });

    // Spectator functionality
    socket.on('spectateGame', (roomId) => {
        gameManager.addSpectator(socket, roomId);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        gameManager.handleDisconnection(socket);
    });

    // Reconnection
    socket.on('reconnect', (roomId, playerId) => {
        console.log(`Player ${socket.id} attempting to reconnect to room ${roomId}`);
        gameManager.handleReconnection(socket, roomId, playerId);
    });

    // Get room list
    socket.on('getRoomList', () => {
        socket.emit('roomList', gameManager.getPublicRooms());
    });

    // Get game state (for reconnections)
    socket.on('getGameState', (roomId) => {
        gameManager.sendGameState(socket, roomId);
    });
});

// API endpoints for room management
app.get('/api/rooms', (req, res) => {
    res.json(gameManager.getPublicRooms());
});

app.get('/api/rooms/:roomId', (req, res) => {
    const room = gameManager.getRoom(req.params.roomId);
    if (room) {
        res.json({
            roomId: room.id,
            players: room.players.length,
            spectators: room.spectators.length,
            gamePhase: room.game ? room.game.gamePhase : 'waiting',
            isPrivate: room.isPrivate
        });
    } else {
        res.status(404).json({ error: 'Room not found' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        players: gameManager.getPlayerCount(),
        rooms: gameManager.getRoomCount()
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
server.listen(PORT, () => {
    console.log(`Wild Chess server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to play`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

module.exports = { app, server, io };