const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, '../client')));

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Simple game state
let rooms = new Map();
let waitingPlayers = [];

// Helper functions
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createEmptyBoard() {
    return Array(8).fill().map(() => Array(8).fill(null));
}

function setupStandardChess() {
    const board = createEmptyBoard();
    
    // Place pieces in standard chess setup for simplicity
    const pieces = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
    
    // White pieces
    for (let i = 0; i < 8; i++) {
        board[0][i] = { type: pieces[i], color: 'white' };
        board[1][i] = { type: 'pawn', color: 'white' };
    }
    
    // Black pieces
    for (let i = 0; i < 8; i++) {
        board[7][i] = { type: pieces[i], color: 'black' };
        board[6][i] = { type: 'pawn', color: 'black' };
    }
    
    return board;
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Find game
    socket.on('findGame', (playerData) => {
        const player = {
            id: socket.id,
            socket: socket,
            name: playerData.name || `Player${Math.floor(Math.random() * 1000)}`
        };

        // Check if there's a waiting player
        if (waitingPlayers.length > 0) {
            const opponent = waitingPlayers.shift();
            createGame([opponent, player]);
        } else {
            waitingPlayers.push(player);
            socket.emit('waitingForOpponent');
        }
    });

    // Create private room
    socket.on('createRoom', (playerData) => {
        const player = {
            id: socket.id,
            socket: socket,
            name: playerData.name || `Player${Math.floor(Math.random() * 1000)}`
        };

        const roomId = generateRoomId();
        const room = {
            id: roomId,
            players: [player],
            game: null,
            board: createEmptyBoard(),
            currentPlayer: 'white',
            gamePhase: 'waiting'
        };

        rooms.set(roomId, room);
        socket.join(roomId);
        socket.emit('roomCreated', { roomId, player: sanitizePlayer(player) });
    });

    // Join room
    socket.on('joinRoom', (roomId, playerData) => {
        const room = rooms.get(roomId);
        
        if (!room) {
            socket.emit('error', 'Room not found');
            return;
        }

        if (room.players.length >= 2) {
            socket.emit('error', 'Room is full');
            return;
        }

        const player = {
            id: socket.id,
            socket: socket,
            name: playerData.name || `Player${Math.floor(Math.random() * 1000)}`
        };

        room.players.push(player);
        socket.join(roomId);

        if (room.players.length === 2) {
            startGame(room);
        }

        socket.to(roomId).emit('playerJoined', sanitizePlayer(player));
        socket.emit('roomJoined', {
            roomId,
            players: room.players.map(p => sanitizePlayer(p)),
            isReady: room.players.length === 2
        });
    });

    // Make move
    socket.on('makeMove', (roomId, moveData) => {
        const room = rooms.get(roomId);
        if (!room || room.gamePhase !== 'playing') {
            socket.emit('error', 'Invalid room or game not in progress');
            return;
        }

        const player = room.players.find(p => p.id === socket.id);
        if (!player || player.color !== room.currentPlayer) {
            socket.emit('error', 'Not your turn');
            return;
        }

        const { fromRank, fromFile, toRank, toFile } = moveData;

        // Basic move validation
        const piece = room.board[fromRank][fromFile];
        if (!piece || piece.color !== player.color) {
            socket.emit('error', 'Invalid piece');
            return;
        }

        // Make the move (simplified - no complex validation)
        const capturedPiece = room.board[toRank][toFile];
        room.board[toRank][toFile] = piece;
        room.board[fromRank][fromFile] = null;

        // Switch players
        room.currentPlayer = room.currentPlayer === 'white' ? 'black' : 'white';

        // Broadcast move to both players
        const moveResult = {
            move: { fromRank, fromFile, toRank, toFile },
            board: room.board,
            currentPlayer: room.currentPlayer,
            capturedPiece
        };

        io.to(roomId).emit('moveMade', moveResult);
    });

    // Start standard game (skip Wild Chess setup for now)
    socket.on('startStandardGame', (roomId) => {
        const room = rooms.get(roomId);
        if (!room) {
            socket.emit('error', 'Room not found');
            return;
        }

        room.board = setupStandardChess();
        room.gamePhase = 'playing';
        room.currentPlayer = 'white';

        io.to(roomId).emit('gameStarted', {
            board: room.board,
            currentPlayer: room.currentPlayer,
            gamePhase: room.gamePhase
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        
        // Remove from waiting players
        waitingPlayers = waitingPlayers.filter(p => p.id !== socket.id);

        // Handle room disconnections
        rooms.forEach((room, roomId) => {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                socket.to(roomId).emit('playerDisconnected', sanitizePlayer(room.players[playerIndex]));
                
                // For now, just end the game if someone disconnects
                rooms.delete(roomId);
            }
        });
    });

    function createGame(players) {
        const roomId = generateRoomId();
        
        // Randomly assign colors
        const whitePlayer = Math.random() < 0.5 ? players[0] : players[1];
        const blackPlayer = whitePlayer === players[0] ? players[1] : players[0];

        whitePlayer.color = 'white';
        blackPlayer.color = 'black';

        const room = {
            id: roomId,
            players: players,
            board: setupStandardChess(),
            currentPlayer: 'white',
            gamePhase: 'playing'
        };

        rooms.set(roomId, room);
        
        // Add players to room
        players.forEach(player => {
            player.socket.join(roomId);
        });

        // Notify players
        players.forEach(player => {
            player.socket.emit('gameStarted', {
                roomId: roomId,
                yourColor: player.color,
                opponent: sanitizePlayer(player.color === 'white' ? blackPlayer : whitePlayer),
                board: room.board,
                currentPlayer: room.currentPlayer,
                gamePhase: room.gamePhase
            });
        });
    }

    function startGame(room) {
        // Randomly assign colors
        const [player1, player2] = room.players;
        const whitePlayer = Math.random() < 0.5 ? player1 : player2;
        const blackPlayer = whitePlayer === player1 ? player2 : player1;

        whitePlayer.color = 'white';
        blackPlayer.color = 'black';

        room.board = setupStandardChess();
        room.currentPlayer = 'white';
        room.gamePhase = 'playing';

        // Notify players
        room.players.forEach(player => {
            player.socket.emit('gameStarted', {
                roomId: room.id,
                yourColor: player.color,
                opponent: sanitizePlayer(player.color === 'white' ? blackPlayer : whitePlayer),
                board: room.board,
                currentPlayer: room.currentPlayer,
                gamePhase: room.gamePhase
            });
        });
    }

    function sanitizePlayer(player) {
        return {
            id: player.id,
            name: player.name,
            color: player.color
        };
    }
});

// Start server
server.listen(PORT, () => {
    console.log(`Wild Chess server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to play`);
});

module.exports = { app, server, io };