const { v4: uuidv4 } = require('uuid');
const WildChessGame = require('./WildChessGame');

class GameManager {
    constructor() {
        this.rooms = new Map();
        this.waitingPlayers = [];
        this.playerRooms = new Map(); // Track which room each player is in
    }

    findGame(socket, playerData) {
        const player = {
            id: socket.id,
            socket: socket,
            name: playerData.name || `Player${Math.floor(Math.random() * 1000)}`,
            rating: playerData.rating || 1200
        };

        // Check if there's a waiting player
        if (this.waitingPlayers.length > 0) {
            const opponent = this.waitingPlayers.shift();
            this.createGameRoom([opponent, player]);
        } else {
            this.waitingPlayers.push(player);
            socket.emit('waitingForOpponent');
        }
    }

    createPrivateRoom(socket, playerData) {
        const player = {
            id: socket.id,
            socket: socket,
            name: playerData.name || `Player${Math.floor(Math.random() * 1000)}`,
            rating: playerData.rating || 1200
        };

        const roomId = this.generateRoomId();
        const room = {
            id: roomId,
            players: [player],
            spectators: [],
            game: null,
            isPrivate: true,
            createdAt: new Date()
        };

        this.rooms.set(roomId, room);
        this.playerRooms.set(socket.id, roomId);
        
        socket.join(roomId);
        socket.emit('roomCreated', { roomId, player: this.sanitizePlayer(player) });
    }

    joinRoom(socket, roomId, playerData) {
        const room = this.rooms.get(roomId);
        
        if (!room) {
            socket.emit('error', 'Room not found');
            return;
        }

        if (room.players.length >= 2) {
            // Join as spectator
            this.addSpectator(socket, roomId);
            return;
        }

        const player = {
            id: socket.id,
            socket: socket,
            name: playerData.name || `Player${Math.floor(Math.random() * 1000)}`,
            rating: playerData.rating || 1200
        };

        room.players.push(player);
        this.playerRooms.set(socket.id, roomId);
        
        socket.join(roomId);

        if (room.players.length === 2) {
            // Start the game
            this.startGame(room);
        }

        // Notify all players in room
        socket.to(roomId).emit('playerJoined', this.sanitizePlayer(player));
        socket.emit('roomJoined', {
            roomId,
            players: room.players.map(p => this.sanitizePlayer(p)),
            isReady: room.players.length === 2
        });
    }

    createGameRoom(players) {
        const roomId = this.generateRoomId();
        const room = {
            id: roomId,
            players: players,
            spectators: [],
            game: null,
            isPrivate: false,
            createdAt: new Date()
        };

        this.rooms.set(roomId, room);
        
        // Add players to room
        players.forEach(player => {
            this.playerRooms.set(player.id, roomId);
            player.socket.join(roomId);
        });

        this.startGame(room);
    }

    startGame(room) {
        // Randomly assign colors
        const [player1, player2] = room.players;
        const whitePlayer = Math.random() < 0.5 ? player1 : player2;
        const blackPlayer = whitePlayer === player1 ? player2 : player1;

        whitePlayer.color = 'white';
        blackPlayer.color = 'black';

        room.game = new WildChessGame(room.id, whitePlayer, blackPlayer);

        // Notify players
        room.players.forEach(player => {
            player.socket.emit('gameStarted', {
                roomId: room.id,
                yourColor: player.color,
                opponent: this.sanitizePlayer(player.color === 'white' ? blackPlayer : whitePlayer),
                gameState: room.game.getPublicState()
            });
        });

        // Notify spectators
        room.spectators.forEach(spectator => {
            spectator.socket.emit('gameStarted', {
                roomId: room.id,
                players: {
                    white: this.sanitizePlayer(whitePlayer),
                    black: this.sanitizePlayer(blackPlayer)
                },
                gameState: room.game.getPublicState(),
                isSpectator: true
            });
        });
    }

    generateSetup(socket, roomId) {
        const room = this.rooms.get(roomId);
        if (!room || !room.game) {
            socket.emit('error', 'Invalid room or game');
            return;
        }

        // Only allow the white player to generate setup
        const player = room.players.find(p => p.id === socket.id);
        if (!player || player.color !== 'white') {
            socket.emit('error', 'Only white player can generate setup');
            return;
        }

        const setupData = room.game.generateSetup();
        
        // Broadcast to all players and spectators
        room.players.forEach(p => {
            p.socket.emit('setupGenerated', setupData);
        });
        
        room.spectators.forEach(s => {
            s.socket.emit('setupGenerated', setupData);
        });
    }

    placePiece(socket, roomId, rank, file) {
        const room = this.rooms.get(roomId);
        if (!room || !room.game) {
            socket.emit('error', 'Invalid room or game');
            return;
        }

        const player = room.players.find(p => p.id === socket.id);
        if (!player) {
            socket.emit('error', 'Player not found in room');
            return;
        }

        const result = room.game.placePiece(player.id, rank, file);
        
        if (result.success) {
            // Broadcast piece placement to all
            room.players.forEach(p => {
                p.socket.emit('piecePlaced', result.data);
            });
            
            room.spectators.forEach(s => {
                s.socket.emit('piecePlaced', result.data);
            });
        } else {
            socket.emit('error', result.error);
        }
    }

    finishSetup(socket, roomId) {
        const room = this.rooms.get(roomId);
        if (!room || !room.game) {
            socket.emit('error', 'Invalid room or game');
            return;
        }

        const result = room.game.finishSetup();
        
        if (result.success) {
            // Broadcast game start to all
            room.players.forEach(p => {
                p.socket.emit('setupFinished', room.game.getPublicState());
            });
            
            room.spectators.forEach(s => {
                s.socket.emit('setupFinished', room.game.getPublicState());
            });
        } else {
            socket.emit('error', result.error);
        }
    }

    makeMove(socket, roomId, moveData) {
        const room = this.rooms.get(roomId);
        if (!room || !room.game) {
            socket.emit('error', 'Invalid room or game');
            return;
        }

        const player = room.players.find(p => p.id === socket.id);
        if (!player) {
            socket.emit('error', 'Player not found in room');
            return;
        }

        const result = room.game.makeMove(player.id, moveData);
        
        if (result.success) {
            // Broadcast move to all players and spectators
            room.players.forEach(p => {
                p.socket.emit('moveMade', result.data);
            });
            
            room.spectators.forEach(s => {
                s.socket.emit('moveMade', result.data);
            });

            // Check for game end
            if (result.data.gameEnd) {
                this.handleGameEnd(room, result.data.gameEnd);
            }
        } else {
            socket.emit('error', result.error);
        }
    }

    handleGameEnd(room, gameEndData) {
        // Broadcast game end to all
        room.players.forEach(p => {
            p.socket.emit('gameEnded', gameEndData);
        });
        
        room.spectators.forEach(s => {
            s.socket.emit('gameEnded', gameEndData);
        });

        // Clean up room after delay
        setTimeout(() => {
            this.cleanupRoom(room.id);
        }, 30000); // 30 seconds
    }

    addSpectator(socket, roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            socket.emit('error', 'Room not found');
            return;
        }

        const spectator = {
            id: socket.id,
            socket: socket,
            name: `Spectator${Math.floor(Math.random() * 1000)}`
        };

        room.spectators.push(spectator);
        socket.join(roomId);

        socket.emit('spectatingGame', {
            roomId,
            players: room.players.map(p => this.sanitizePlayer(p)),
            gameState: room.game ? room.game.getPublicState() : null
        });

        // Notify others
        socket.to(roomId).emit('spectatorJoined', this.sanitizePlayer(spectator));
    }

    handleDisconnection(socket) {
        // Remove from waiting players
        this.waitingPlayers = this.waitingPlayers.filter(p => p.id !== socket.id);

        const roomId = this.playerRooms.get(socket.id);
        if (roomId) {
            const room = this.rooms.get(roomId);
            if (room) {
                // Handle player disconnection
                const playerIndex = room.players.findIndex(p => p.id === socket.id);
                if (playerIndex !== -1) {
                    const player = room.players[playerIndex];
                    
                    // Mark player as disconnected but keep in room for potential reconnection
                    player.disconnected = true;
                    player.disconnectedAt = new Date();

                    // Notify other players
                    socket.to(roomId).emit('playerDisconnected', this.sanitizePlayer(player));

                    // Auto-resign after 5 minutes if not reconnected
                    setTimeout(() => {
                        if (player.disconnected && room.game && room.game.gamePhase === 'playing') {
                            this.resignGame(socket, roomId, true); // auto-resign
                        }
                    }, 5 * 60 * 1000);
                }

                // Handle spectator disconnection
                room.spectators = room.spectators.filter(s => s.id !== socket.id);
            }
        }

        this.playerRooms.delete(socket.id);
    }

    resignGame(socket, roomId, isAutoResign = false) {
        const room = this.rooms.get(roomId);
        if (!room || !room.game) return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        const result = room.game.resign(player.id);
        
        if (result.success) {
            const gameEndData = {
                type: 'resignation',
                winner: player.color === 'white' ? 'black' : 'white',
                resignedPlayer: player.color,
                isAutoResign
            };

            this.handleGameEnd(room, gameEndData);
        }
    }

    requestDraw(socket, roomId) {
        const room = this.rooms.get(roomId);
        if (!room || !room.game) return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        const opponent = room.players.find(p => p.id !== socket.id);
        if (opponent) {
            opponent.socket.emit('drawRequested', { from: this.sanitizePlayer(player) });
        }
    }

    respondDraw(socket, roomId, accept) {
        const room = this.rooms.get(roomId);
        if (!room || !room.game) return;

        if (accept) {
            const gameEndData = {
                type: 'draw',
                reason: 'agreement'
            };
            this.handleGameEnd(room, gameEndData);
        } else {
            socket.to(roomId).emit('drawDeclined');
        }
    }

    sendChatMessage(socket, roomId, message) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        const spectator = room.spectators.find(s => s.id === socket.id);
        
        const sender = player || spectator;
        if (!sender) return;

        const chatData = {
            sender: this.sanitizePlayer(sender),
            message: message.trim(),
            timestamp: new Date()
        };

        // Broadcast to all in room
        socket.to(roomId).emit('chatMessage', chatData);
        socket.emit('chatMessage', chatData);
    }

    cleanupRoom(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        // Remove player mappings
        room.players.forEach(player => {
            this.playerRooms.delete(player.id);
        });

        // Remove room
        this.rooms.delete(roomId);
        console.log(`Room ${roomId} cleaned up`);
    }

    getPublicRooms() {
        const publicRooms = [];
        this.rooms.forEach(room => {
            if (!room.isPrivate) {
                publicRooms.push({
                    id: room.id,
                    players: room.players.length,
                    spectators: room.spectators.length,
                    gamePhase: room.game ? room.game.gamePhase : 'waiting',
                    createdAt: room.createdAt
                });
            }
        });
        return publicRooms;
    }

    getRoom(roomId) {
        return this.rooms.get(roomId);
    }

    getPlayerCount() {
        let count = 0;
        this.rooms.forEach(room => {
            count += room.players.length + room.spectators.length;
        });
        return count + this.waitingPlayers.length;
    }

    getRoomCount() {
        return this.rooms.size;
    }

    generateRoomId() {
        return uuidv4().split('-')[0].toUpperCase();
    }

    sanitizePlayer(player) {
        return {
            id: player.id,
            name: player.name,
            color: player.color,
            rating: player.rating,
            disconnected: player.disconnected || false
        };
    }

    sendGameState(socket, roomId) {
        const room = this.rooms.get(roomId);
        if (!room || !room.game) {
            socket.emit('error', 'Room or game not found');
            return;
        }

        socket.emit('gameState', room.game.getPublicState());
    }
}

module.exports = GameManager;