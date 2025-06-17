// Online multiplayer functionality
class OnlineGame {
    constructor() {
        this.socket = null;
        this.roomId = null;
        this.playerId = null;
        this.playerColor = null;
        this.isSpectator = false;
        this.gameState = null;
        this.isConnected = false;
        
        this.init();
    }
    
    init() {
        this.createMenuUI();
        this.connectToServer();
    }
    
    connectToServer() {
        // Connect to server (adjust URL for production)
        this.socket = io(window.location.origin);
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.isConnected = true;
            this.playerId = this.socket.id;
            this.updateConnectionStatus('Connected');
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.isConnected = false;
            this.updateConnectionStatus('Disconnected');
        });
        
        this.setupSocketListeners();
    }
    
    setupSocketListeners() {
        // Game events
        this.socket.on('gameStarted', (data) => {
            this.handleGameStarted(data);
        });
        
        this.socket.on('setupGenerated', (data) => {
            this.handleSetupGenerated(data);
        });
        
        this.socket.on('piecePlaced', (data) => {
            this.handlePiecePlaced(data);
        });
        
        this.socket.on('setupFinished', (data) => {
            this.handleSetupFinished(data);
        });
        
        this.socket.on('moveMade', (data) => {
            this.handleMoveMade(data);
        });
        
        this.socket.on('gameEnded', (data) => {
            this.handleGameEnded(data);
        });
        
        // Room events
        this.socket.on('waitingForOpponent', () => {
            this.showMessage('Waiting for opponent...');
        });
        
        this.socket.on('roomCreated', (data) => {
            this.roomId = data.roomId;
            this.showMessage(`Room created: ${data.roomId}. Share this code with your opponent!`);
        });
        
        this.socket.on('roomJoined', (data) => {
            this.roomId = data.roomId;
            this.showMessage(`Joined room: ${data.roomId}`);
            if (data.isReady) {
                this.showMessage('Both players ready. Game will start soon!');
            }
        });
        
        this.socket.on('playerJoined', (data) => {
            this.showMessage(`${data.name} joined the game`);
        });
        
        this.socket.on('playerDisconnected', (data) => {
            this.showMessage(`${data.name} disconnected`);
        });
        
        // Draw and resignation
        this.socket.on('drawRequested', (data) => {
            this.handleDrawRequest(data);
        });
        
        this.socket.on('drawDeclined', () => {
            this.showMessage('Draw offer declined');
        });
        
        // Chat
        this.socket.on('chatMessage', (data) => {
            this.handleChatMessage(data);
        });
        
        // Spectator
        this.socket.on('spectatingGame', (data) => {
            this.handleSpectatingGame(data);
        });
        
        // Errors
        this.socket.on('error', (error) => {
            this.showError(error);
        });
    }
    
    createMenuUI() {
        const container = document.querySelector('.container');
        const menuHTML = `
            <div id="mainMenu" class="main-menu">
                <h2>Wild Chess Online</h2>
                <div class="connection-status" id="connectionStatus">Connecting...</div>
                
                <div class="player-setup">
                    <input type="text" id="playerName" placeholder="Enter your name" maxlength="20">
                </div>
                
                <div class="menu-buttons">
                    <button onclick="onlineGame.findRandomGame()" id="findGameBtn">Find Random Game</button>
                    <button onclick="onlineGame.createPrivateRoom()" id="createRoomBtn">Create Private Room</button>
                    <button onclick="onlineGame.showJoinRoom()" id="joinRoomBtn">Join Room</button>
                    <button onclick="onlineGame.showSpectateOptions()" id="spectateBtn">Spectate Game</button>
                </div>
                
                <div id="joinRoomDiv" class="join-room" style="display: none;">
                    <input type="text" id="roomCodeInput" placeholder="Enter room code" maxlength="8">
                    <button onclick="onlineGame.joinRoom()">Join</button>
                    <button onclick="onlineGame.hideJoinRoom()">Cancel</button>
                </div>
                
                <div id="gameMessages" class="game-messages"></div>
            </div>
            
            <div id="gameUI" class="game-ui" style="display: none;">
                <div class="game-header">
                    <div class="game-info">
                        <span id="roomInfo">Room: </span>
                        <span id="playerInfo">You are: </span>
                    </div>
                    <div class="game-actions">
                        <button onclick="onlineGame.resignGame()" id="resignBtn">Resign</button>
                        <button onclick="onlineGame.offerDraw()" id="drawBtn">Offer Draw</button>
                        <button onclick="onlineGame.leaveGame()" id="leaveBtn">Leave Game</button>
                    </div>
                </div>
                
                <div class="chat-container">
                    <div id="chatMessages" class="chat-messages"></div>
                    <div class="chat-input">
                        <input type="text" id="chatInput" placeholder="Type a message..." maxlength="200">
                        <button onclick="onlineGame.sendChatMessage()">Send</button>
                    </div>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('afterbegin', menuHTML);
        
        // Add enter key listeners
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendChatMessage();
        });
        
        document.getElementById('roomCodeInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });
    }
    
    findRandomGame() {
        const playerName = document.getElementById('playerName').value.trim();
        if (!playerName) {
            this.showError('Please enter your name');
            return;
        }
        
        this.socket.emit('findGame', { name: playerName });
        this.showMessage('Looking for a game...');
    }
    
    createPrivateRoom() {
        const playerName = document.getElementById('playerName').value.trim();
        if (!playerName) {
            this.showError('Please enter your name');
            return;
        }
        
        this.socket.emit('createRoom', { name: playerName });
    }
    
    showJoinRoom() {
        document.getElementById('joinRoomDiv').style.display = 'block';
    }
    
    hideJoinRoom() {
        document.getElementById('joinRoomDiv').style.display = 'none';
    }
    
    joinRoom() {
        const playerName = document.getElementById('playerName').value.trim();
        const roomCode = document.getElementById('roomCodeInput').value.trim().toUpperCase();
        
        if (!playerName) {
            this.showError('Please enter your name');
            return;
        }
        
        if (!roomCode) {
            this.showError('Please enter room code');
            return;
        }
        
        this.socket.emit('joinRoom', roomCode, { name: playerName });
        this.hideJoinRoom();
    }
    
    showSpectateOptions() {
        // TODO: Implement spectate game list
        this.showMessage('Spectate feature coming soon!');
    }
    
    handleGameStarted(data) {
        this.roomId = data.roomId;
        this.playerColor = data.yourColor;
        this.isSpectator = data.isSpectator || false;
        this.gameState = data.gameState;
        
        // Hide menu, show game
        document.getElementById('mainMenu').style.display = 'none';
        document.getElementById('gameUI').style.display = 'block';
        
        // Update UI
        document.getElementById('roomInfo').textContent = `Room: ${this.roomId}`;
        if (!this.isSpectator) {
            document.getElementById('playerInfo').textContent = `You are: ${this.playerColor}`;
        } else {
            document.getElementById('playerInfo').textContent = 'Spectating';
        }
        
        // Initialize game board
        if (typeof game !== 'undefined') {
            game.gameState = this.convertGameState(data.gameState);
            game.board.update(game.gameState.board);
            game.updateDisplay();
        }
        
        this.showMessage(`Game started! ${this.isSpectator ? 'You are spectating.' : `You are playing as ${this.playerColor}.`}`);
    }
    
    handleSetupGenerated(data) {
        if (typeof game !== 'undefined') {
            game.gameState.board = data.board;
            game.gameState.drawnCards = data.cards;
            game.gameState.setupStep = data.setupStep;
            
            game.displayCards();
            game.board.update(game.gameState.board);
            
            document.getElementById('finishSetupBtn').style.display = 'inline-block';
            document.getElementById('phaseIndicator').textContent = 'Setup generated! Place kings and queens.';
        }
    }
    
    handlePiecePlaced(data) {
        if (typeof game !== 'undefined') {
            game.gameState.board = data.board;
            game.board.update(game.gameState.board);
            
            if (data.nextPiece && !this.isSpectator) {
                const [color, type] = data.nextPiece.split('-');
                const pieceNames = { 'queen': 'Queen', 'king': 'King' };
                const colorNames = { 'white': 'White', 'black': 'Black' };
                
                if (color === this.playerColor) {
                    document.getElementById('phaseIndicator').textContent = 
                        `Your turn: Place ${colorNames[color]} ${pieceNames[type]}`;
                    game.highlightEmptySquares();
                } else {
                    document.getElementById('phaseIndicator').textContent = 
                        `Opponent placing ${colorNames[color]} ${pieceNames[type]}...`;
                    game.clearEmptySquareHighlights();
                }
            }
            
            if (data.isComplete) {
                document.getElementById('phaseIndicator').textContent = 'All pieces placed! Game starting...';
                game.clearEmptySquareHighlights();
            }
        }
    }
    
    handleSetupFinished(data) {
        if (typeof game !== 'undefined') {
            game.gameState.gamePhase = 'playing';
            game.gameState.board = data.board;
            game.gameState.currentPlayer = data.currentPlayer;
            game.gameState.manualPlacement = null;
            
            document.getElementById('setupPhase').style.display = 'none';
            document.getElementById('phaseIndicator').className = 'phase-indicator game-phase-indicator';
            document.getElementById('phaseIndicator').textContent = 'Game in Progress';
            
            game.board.update(game.gameState.board);
            game.clearEmptySquareHighlights();
            game.updateDisplay();
        }
        
        this.showMessage('Game started! Good luck!');
    }
    
    handleMoveMade(data) {
        if (typeof game !== 'undefined') {
            game.gameState.board = data.board;
            game.gameState.currentPlayer = data.currentPlayer;
            game.gameState.capturedPieces = data.capturedPieces;
            game.gameState.lastMove = data.lastMove;
            game.gameState.moveHistory.push(data.move);
            
            game.board.update(game.gameState.board);
            game.board.highlightLastMove(data.lastMove);
            game.updateDisplay();
        }
        
        if (data.gameEnd) {
            this.handleGameEnded(data.gameEnd);
        }
    }
    
    handleGameEnded(data) {
        let message = '';
        switch (data.type) {
            case 'checkmate':
                message = `Checkmate! ${data.winner.charAt(0).toUpperCase() + data.winner.slice(1)} wins!`;
                break;
            case 'resignation':
                message = `${data.resignedPlayer.charAt(0).toUpperCase() + data.resignedPlayer.slice(1)} resigned. ${data.winner.charAt(0).toUpperCase() + data.winner.slice(1)} wins!`;
                break;
            case 'stalemate':
                message = 'Stalemate! The game is a draw.';
                break;
            case 'draw':
                message = 'Game drawn by agreement.';
                break;
            default:
                message = 'Game ended.';
        }
        
        this.showMessage(message);
        document.getElementById('phaseIndicator').textContent = message;
        
        // Disable game actions
        document.getElementById('resignBtn').disabled = true;
        document.getElementById('drawBtn').disabled = true;
    }
    
    handleDrawRequest(data) {
        const accept = confirm(`${data.from.name} is offering a draw. Do you accept?`);
        this.socket.emit('respondDraw', this.roomId, accept);
    }
    
    handleChatMessage(data) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        
        const time = new Date(data.timestamp).toLocaleTimeString();
        messageDiv.innerHTML = `
            <span class="chat-time">[${time}]</span>
            <span class="chat-sender">${data.sender.name}:</span>
            <span class="chat-text">${this.escapeHtml(data.message)}</span>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    handleSpectatingGame(data) {
        this.roomId = data.roomId;
        this.isSpectator = true;
        
        // Show game UI
        document.getElementById('mainMenu').style.display = 'none';
        document.getElementById('gameUI').style.display = 'block';
        
        // Update UI for spectator
        document.getElementById('roomInfo').textContent = `Room: ${this.roomId}`;
        document.getElementById('playerInfo').textContent = 'Spectating';
        document.getElementById('resignBtn').style.display = 'none';
        document.getElementById('drawBtn').style.display = 'none';
        
        if (data.gameState && typeof game !== 'undefined') {
            game.gameState = this.convertGameState(data.gameState);
            game.board.update(game.gameState.board);
            game.updateDisplay();
        }
    }
    
    // Game actions
    generateSetup() {
        if (this.playerColor === 'white') {
            this.socket.emit('generateSetup', this.roomId);
        }
    }
    
    placePiece(rank, file) {
        if (!this.isSpectator) {
            this.socket.emit('placePiece', this.roomId, rank, file);
        }
    }
    
    finishSetup() {
        this.socket.emit('finishSetup', this.roomId);
    }
    
    makeMove(fromRank, fromFile, toRank, toFile) {
        if (!this.isSpectator && this.playerColor === (typeof game !== 'undefined' ? game.gameState.currentPlayer : null)) {
            this.socket.emit('makeMove', this.roomId, {
                fromRank, fromFile, toRank, toFile
            });
        }
    }
    
    resignGame() {
        if (!this.isSpectator && confirm('Are you sure you want to resign?')) {
            this.socket.emit('resignGame', this.roomId);
        }
    }
    
    offerDraw() {
        if (!this.isSpectator) {
            this.socket.emit('requestDraw', this.roomId);
            this.showMessage('Draw offer sent to opponent');
        }
    }
    
    sendChatMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (message && this.roomId) {
            this.socket.emit('chatMessage', this.roomId, message);
            input.value = '';
        }
    }
    
    leaveGame() {
        if (confirm('Are you sure you want to leave the game?')) {
            this.socket.disconnect();
            location.reload();
        }
    }
    
    // Utility functions
    convertGameState(serverState) {
        return {
            board: serverState.board,
            currentPlayer: serverState.currentPlayer,
            selectedSquare: null,
            gamePhase: serverState.gamePhase,
            capturedPieces: serverState.capturedPieces,
            setupStep: serverState.setupStep,
            drawnCards: serverState.drawnCards,
            moveHistory: [],
            lastMove: serverState.lastMove,
            manualPlacement: serverState.manualPlacement
        };
    }
    
    updateConnectionStatus(status) {
        const statusEl = document.getElementById('connectionStatus');
        if (statusEl) {
            statusEl.textContent = status;
            statusEl.className = `connection-status ${status.toLowerCase()}`;
        }
    }
    
    showMessage(message) {
        const messagesDiv = document.getElementById('gameMessages');
        if (messagesDiv) {
            const messageEl = document.createElement('div');
            messageEl.className = 'message';
            messageEl.textContent = message;
            messagesDiv.appendChild(messageEl);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            
            // Remove old messages to prevent overflow
            while (messagesDiv.children.length > 10) {
                messagesDiv.removeChild(messagesDiv.firstChild);
            }
        }
        console.log('Game message:', message);
    }
    
    showError(error) {
        const messagesDiv = document.getElementById('gameMessages');
        if (messagesDiv) {
            const errorEl = document.createElement('div');
            errorEl.className = 'message error';
            errorEl.textContent = `Error: ${error}`;
            messagesDiv.appendChild(errorEl);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }
        console.error('Game error:', error);
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global online game instance
let onlineGame;

// Initialize online game when page loads
document.addEventListener('DOMContentLoaded', () => {
    onlineGame = new OnlineGame();
});