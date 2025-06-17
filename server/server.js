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

function shuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function positionToCoords(pos) {
    const file = pos.charCodeAt(0) - 65; // A=0, B=1, etc.
    const rank = parseInt(pos[1]) - 1;
    return { rank, file };
}

function generateWildChessSetup() {
    const files = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    
    // Small deck (16 cards) - for ranks 1 and 8
    const smallDeck = [];
    for (let file of files) {
        smallDeck.push(file + '1');
        smallDeck.push(file + '8');
    }
    
    // Large deck (48 cards) - for ranks 2-7
    const largeDeck = [];
    for (let rank = 2; rank <= 7; rank++) {
        for (let file of files) {
            largeDeck.push(file + rank);
        }
    }
    
    const shuffledLarge = shuffle(largeDeck);
    const shuffledSmall = shuffle(smallDeck);
    
    // Draw 8 cards for pawns (4 for each player)
    const pawnCards = shuffledLarge.slice(0, 8);
    
    // Combine remaining large cards with small deck, shuffle, draw 6 for pieces
    const remainingCards = [...shuffledLarge.slice(8), ...shuffledSmall];
    const shuffledRemaining = shuffle(remainingCards);
    const pieceCards = shuffledRemaining.slice(0, 6);
    
    // Create empty board
    const board = createEmptyBoard();
    
    // Place pawns (4 for each player)
    for (let i = 0; i < pawnCards.length; i++) {
        const pos = positionToCoords(pawnCards[i]);
        const color = i < 4 ? 'white' : 'black';
        
        // Validate pawn placement (should be in ranks 2-7)
        if (pos.rank >= 1 && pos.rank <= 6) {
            board[pos.rank][pos.file] = { type: 'pawn', color: color };
        }
    }
    
    // Place pieces (bishops, knights, rooks - 2 each per player)
    const pieces = ['bishop', 'knight', 'rook', 'bishop', 'knight', 'rook'];
    for (let i = 0; i < pieceCards.length && i < pieces.length; i++) {
        const pos = positionToCoords(pieceCards[i]);
        const color = i < 3 ? 'white' : 'black';
        const pieceType = pieces[i % 3];
        
        // Check if position is empty
        if (!board[pos.rank][pos.file]) {
            board[pos.rank][pos.file] = { type: pieceType, color: color };
        }
    }
    
    // Find empty squares for kings and queens
    const emptySquares = [];
    for (let rank = 0; rank < 8; rank++) {
        for (let file = 0; file < 8; file++) {
            if (!board[rank][file]) {
                emptySquares.push({ rank, file });
            }
        }
    }
    
    // Randomly place queens and kings
    const shuffledEmpty = shuffle(emptySquares);
    if (shuffledEmpty.length >= 4) {
        board[shuffledEmpty[0].rank][shuffledEmpty[0].file] = { type: 'queen', color: 'white' };
        board[shuffledEmpty[1].rank][shuffledEmpty[1].file] = { type: 'queen', color: 'black' };
        board[shuffledEmpty[2].rank][shuffledEmpty[2].file] = { type: 'king', color: 'white' };
        board[shuffledEmpty[3].rank][shuffledEmpty[3].file] = { type: 'king', color: 'black' };
    }
    
    return {
        board: board,
        cards: {
            pawn: pawnCards,
            piece: pieceCards
        }
    };
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
            gamePhase: 'waiting',
            wildChessSetup: null
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

    // Generate Wild Chess setup
    socket.on('generateWildSetup', (roomId) => {
        const room = rooms.get(roomId);
        if (!room) {
            socket.emit('error', 'Room not found');
            return;
        }

        // Only allow if both players are present
        if (room.players.length !== 2) {
            socket.emit('error', 'Need both players to generate setup');
            return;
        }

        const setup = generateWildChessSetup();
        room.board = setup.board;
        room.wildChessSetup = setup.cards;
        room.gamePhase = 'playing';
        room.currentPlayer = 'white';

        // Broadcast to both players
        io.to(roomId).emit('wildSetupGenerated', {
            board: room.board,
            cards: room.wildChessSetup,
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

        // Generate Wild Chess setup
        const setup = generateWildChessSetup();

        const room = {
            id: roomId,
            players: players,
            board: setup.board,
            currentPlayer: 'white',
            gamePhase: 'playing',
            wildChessSetup: setup.cards
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
                gamePhase: room.gamePhase,
                wildChessSetup: room.wildChessSetup
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

        // Generate Wild Chess setup
        const setup = generateWildChessSetup();
        room.board = setup.board;
        room.wildChessSetup = setup.cards;
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
                gamePhase: room.gamePhase,
                wildChessSetup: room.wildChessSetup
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