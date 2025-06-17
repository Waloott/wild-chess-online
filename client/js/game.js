// Main game controller
class WildChess {
    constructor() {
        this.gameState = {
            board: Array(8).fill().map(() => Array(8).fill(null)),
            currentPlayer: 'white',
            selectedSquare: null,
            gamePhase: 'setup', // 'setup', 'playing', 'ended'
            capturedPieces: { white: [], black: [] },
            setupStep: 0, // 0: not started, 1: cards drawn, 2: manual placement, 3: manual piece placement
            drawnCards: { pawn: [], piece: [] },
            moveHistory: [],
            lastMove: null,
            manualPlacement: null // Will hold placement state during manual setup
        };
        
        this.board = new ChessBoard();
        this.cardSystem = new CardSystem();
        this.pieceLogic = new PieceLogic();
        
        this.init();
    }
    
    init() {
        this.board.initialize();
        this.updateDisplay();
    }
    
    startNewGame() {
        this.gameState = {
            board: Array(8).fill().map(() => Array(8).fill(null)),
            currentPlayer: 'white',
            selectedSquare: null,
            gamePhase: 'setup',
            capturedPieces: { white: [], black: [] },
            setupStep: 1,
            drawnCards: { pawn: [], piece: [] },
            moveHistory: [],
            lastMove: null,
            manualPlacement: null
        };
        
        document.getElementById('generateBtn').disabled = false;
        document.getElementById('phaseIndicator').textContent = 'Setup Phase - Generate random piece positions';
        document.getElementById('phaseIndicator').className = 'phase-indicator setup-phase-indicator';
        document.getElementById('setupPhase').style.display = 'block';
        
        this.board.update(this.gameState.board);
        this.updateDisplay();
    }
    
    generateSetup() {
        // Check if this is an online game
        if (typeof onlineGame !== 'undefined' && onlineGame.roomId) {
            onlineGame.generateSetup();
            return;
        }
        
        // Local game setup
        const setup = this.cardSystem.generateRandomSetup();
        this.gameState.drawnCards = setup.cards;
        this.gameState.board = setup.board;
        
        this.displayCards();
        
        this.gameState.setupStep = 2;
        document.getElementById('generateBtn').disabled = true;
        document.getElementById('finishSetupBtn').style.display = 'inline-block';
        document.getElementById('phaseIndicator').textContent = 'Setup Phase - Place kings and queens manually';
        
        this.board.update(this.gameState.board);
    }
    
    finishSetup() {
        // Check if this is an online game
        if (typeof onlineGame !== 'undefined' && onlineGame.roomId) {
            onlineGame.finishSetup();
            return;
        }
        
        // Local game finish setup
        // Start manual placement phase
        this.gameState.setupStep = 3;
        this.gameState.manualPlacement = {
            currentPiece: 'white-queen',
            piecesToPlace: ['white-queen', 'black-queen', 'white-king', 'black-king'],
            currentIndex: 0
        };
        
        document.getElementById('finishSetupBtn').style.display = 'none';
        document.getElementById('phaseIndicator').textContent = 'Place White Queen - Click on an empty square';
        
        this.board.update(this.gameState.board);
        this.highlightEmptySquares();
    }
    
    completeManualSetup() {
        // All pieces placed, start the game
        this.gameState.gamePhase = 'playing';
        this.gameState.manualPlacement = null;
        document.getElementById('setupPhase').style.display = 'none';
        document.getElementById('phaseIndicator').className = 'phase-indicator game-phase-indicator';
        document.getElementById('phaseIndicator').textContent = 'Game in Progress';
        document.getElementById('undoBtn').disabled = false;
        
        // Clear empty square highlighting
        this.clearEmptySquareHighlights();
        
        this.board.update(this.gameState.board);
        this.updateDisplay();
    }
    
    clearEmptySquareHighlights() {
        document.querySelectorAll('.square').forEach(square => {
            square.classList.remove('empty-square');
        });
    }
    
    highlightEmptySquares() {
        // Remove previous highlights
        this.clearEmptySquareHighlights();
        
        // Highlight empty squares
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                if (!this.gameState.board[rank][file]) {
                    const square = document.querySelector(`[data-rank="${rank}"][data-file="${file}"]`);
                    square.classList.add('empty-square');
                }
            }
        }
    }
    
    handleSquareClick(rank, file) {
        // Handle online game piece placement
        if (typeof onlineGame !== 'undefined' && onlineGame.roomId) {
            if (this.gameState.gamePhase === 'setup' && this.gameState.setupStep === 3) {
                onlineGame.placePiece(rank, file);
                return;
            }
            
            if (this.gameState.gamePhase === 'playing') {
                // Handle online moves
                if (this.gameState.selectedSquare) {
                    const [selectedRank, selectedFile] = this.gameState.selectedSquare;
                    
                    if (rank === selectedRank && file === selectedFile) {
                        // Deselect
                        this.gameState.selectedSquare = null;
                    } else if (this.pieceLogic.isValidMove(
                        this.gameState.board, selectedRank, selectedFile, rank, file, this.gameState.currentPlayer
                    )) {
                        // Send move to server
                        onlineGame.makeMove(selectedRank, selectedFile, rank, file);
                        this.gameState.selectedSquare = null;
                    } else if (this.gameState.board[rank][file] && 
                               this.gameState.board[rank][file].color === onlineGame.playerColor) {
                        // Select new piece (only if it's your piece)
                        this.gameState.selectedSquare = [rank, file];
                    } else {
                        this.gameState.selectedSquare = null;
                    }
                } else if (this.gameState.board[rank][file] && 
                           this.gameState.board[rank][file].color === onlineGame.playerColor &&
                           this.gameState.currentPlayer === onlineGame.playerColor) {
                    // Select piece (only if it's your turn and your piece)
                    this.gameState.selectedSquare = [rank, file];
                }
                
                this.board.update(this.gameState.board);
                this.board.highlightSelected(this.gameState.selectedSquare, this.gameState.board, this.pieceLogic, this.gameState.currentPlayer);
                this.board.highlightLastMove(this.gameState.lastMove);
                this.updateDisplay();
                return;
            }
        }
        
        // Handle offline/local game
        // Handle manual placement during setup
        if (this.gameState.gamePhase === 'setup' && this.gameState.setupStep === 3) {
            return this.handleManualPlacement(rank, file);
        }
        
        if (this.gameState.gamePhase !== 'playing') return;
        
        const piece = this.gameState.board[rank][file];
        
        if (this.gameState.selectedSquare) {
            const [selectedRank, selectedFile] = this.gameState.selectedSquare;
            
            if (rank === selectedRank && file === selectedFile) {
                // Deselect
                this.gameState.selectedSquare = null;
            } else if (this.pieceLogic.isValidMove(
                this.gameState.board, selectedRank, selectedFile, rank, file, this.gameState.currentPlayer
            )) {
                // Make move
                this.makeMove(selectedRank, selectedFile, rank, file);
                this.gameState.selectedSquare = null;
            } else if (piece && piece.color === this.gameState.currentPlayer) {
                // Select new piece
                this.gameState.selectedSquare = [rank, file];
            } else {
                this.gameState.selectedSquare = null;
            }
        } else if (piece && piece.color === this.gameState.currentPlayer) {
            // Select piece
            this.gameState.selectedSquare = [rank, file];
        }
        
        this.board.update(this.gameState.board);
        this.board.highlightSelected(this.gameState.selectedSquare, this.gameState.board, this.pieceLogic, this.gameState.currentPlayer);
        this.board.highlightLastMove(this.gameState.lastMove);
        this.updateDisplay();
    }
    
    handleManualPlacement(rank, file) {
        // Check if square is empty
        if (this.gameState.board[rank][file]) {
            return; // Square is occupied
        }
        
        const placement = this.gameState.manualPlacement;
        const currentPiece = placement.piecesToPlace[placement.currentIndex];
        const [color, type] = currentPiece.split('-');
        
        // Place the piece
        this.gameState.board[rank][file] = { type, color };
        
        // Move to next piece
        placement.currentIndex++;
        
        if (placement.currentIndex >= placement.piecesToPlace.length) {
            // All pieces placed
            this.completeManualSetup();
        } else {
            // Update UI for next piece
            const nextPiece = placement.piecesToPlace[placement.currentIndex];
            const [nextColor, nextType] = nextPiece.split('-');
            const pieceNames = {
                'queen': 'Queen',
                'king': 'King'
            };
            const colorNames = {
                'white': 'White',
                'black': 'Black'
            };
            
            document.getElementById('phaseIndicator').textContent = 
                `Place ${colorNames[nextColor]} ${pieceNames[nextType]} - Click on an empty square`;
            
            this.board.update(this.gameState.board);
            this.highlightEmptySquares();
        }
    }
    
    makeMove(fromRank, fromFile, toRank, toFile) {
        const piece = this.gameState.board[fromRank][fromFile];
        const capturedPiece = this.gameState.board[toRank][toFile];
        
        // Record move for history
        const move = {
            from: { rank: fromRank, file: fromFile },
            to: { rank: toRank, file: toFile },
            piece: { ...piece },
            capturedPiece: capturedPiece ? { ...capturedPiece } : null,
            player: this.gameState.currentPlayer
        };
        
        this.gameState.moveHistory.push(move);
        this.gameState.lastMove = { from: { rank: fromRank, file: fromFile }, to: { rank: toRank, file: toFile } };
        
        if (capturedPiece) {
            this.gameState.capturedPieces[this.gameState.currentPlayer].push(capturedPiece);
        }
        
        this.gameState.board[toRank][toFile] = piece;
        this.gameState.board[fromRank][fromFile] = null;
        
        // Handle pawn promotion
        this.handlePawnPromotion(toRank, toFile);
        
        this.gameState.currentPlayer = this.gameState.currentPlayer === 'white' ? 'black' : 'white';
        
        // Check for game end conditions
        this.checkGameEnd();
    }
    
    handlePawnPromotion(rank, file) {
        const piece = this.gameState.board[rank][file];
        if (piece && piece.type === 'pawn') {
            if ((piece.color === 'white' && rank === 7) || (piece.color === 'black' && rank === 0)) {
                // For now, auto-promote to queen. In full implementation, show promotion dialog
                this.gameState.board[rank][file] = { type: 'queen', color: piece.color };
            }
        }
    }
    
    checkGameEnd() {
        // Basic check for no legal moves (simplified)
        // In full implementation, check for checkmate, stalemate
        const king = this.findKing(this.gameState.currentPlayer);
        if (!king) {
            this.gameState.gamePhase = 'ended';
            document.getElementById('phaseIndicator').textContent = `Game Over - ${this.gameState.currentPlayer === 'white' ? 'Black' : 'White'} wins!`;
            document.getElementById('phaseIndicator').className = 'phase-indicator';
        }
    }
    
    findKing(color) {
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const piece = this.gameState.board[rank][file];
                if (piece && piece.type === 'king' && piece.color === color) {
                    return { rank, file };
                }
            }
        }
        return null;
    }
    
    undoMove() {
        if (this.gameState.moveHistory.length === 0) return;
        
        const lastMove = this.gameState.moveHistory.pop();
        
        // Restore board position
        this.gameState.board[lastMove.from.rank][lastMove.from.file] = lastMove.piece;
        this.gameState.board[lastMove.to.rank][lastMove.to.file] = lastMove.capturedPiece;
        
        // Restore captured pieces
        if (lastMove.capturedPiece) {
            const capturedIndex = this.gameState.capturedPieces[lastMove.player].findIndex(
                piece => piece.type === lastMove.capturedPiece.type && piece.color === lastMove.capturedPiece.color
            );
            if (capturedIndex !== -1) {
                this.gameState.capturedPieces[lastMove.player].splice(capturedIndex, 1);
            }
        }
        
        // Switch back to previous player
        this.gameState.currentPlayer = lastMove.player;
        
        // Update last move
        this.gameState.lastMove = this.gameState.moveHistory.length > 0 ? 
            this.gameState.moveHistory[this.gameState.moveHistory.length - 1] : null;
        
        this.board.update(this.gameState.board);
        this.board.highlightLastMove(this.gameState.lastMove);
        this.updateDisplay();
        
        if (this.gameState.moveHistory.length === 0) {
            document.getElementById('undoBtn').disabled = true;
        }
    }
    
    displayCards() {
        document.getElementById('cardsDisplay').style.display = 'block';
        
        const pawnCardsDiv = document.getElementById('pawnCards');
        const pieceCardsDiv = document.getElementById('pieceCards');
        
        pawnCardsDiv.innerHTML = '';
        pieceCardsDiv.innerHTML = '';
        
        this.gameState.drawnCards.pawn.forEach((card, i) => {
            const cardDiv = document.createElement('div');
            cardDiv.className = `card ${i < 4 ? 'white-card' : 'red'}`;
            cardDiv.textContent = card;
            pawnCardsDiv.appendChild(cardDiv);
        });
        
        this.gameState.drawnCards.piece.forEach((card, i) => {
            const cardDiv = document.createElement('div');
            cardDiv.className = `card ${i < 3 ? 'white-card' : 'red'}`;
            cardDiv.textContent = card;
            pieceCardsDiv.appendChild(cardDiv);
        });
    }
    
    updateDisplay() {
        this.updateCurrentTurn();
        this.updateCapturedPieces();
    }
    
    updateCurrentTurn() {
        const turnDiv = document.getElementById('currentTurn');
        if (this.gameState.gamePhase === 'playing') {
            turnDiv.textContent = `${this.gameState.currentPlayer.charAt(0).toUpperCase() + this.gameState.currentPlayer.slice(1)} to move`;
            turnDiv.className = `current-turn ${this.gameState.currentPlayer}-turn`;
        }
    }
    
    updateCapturedPieces() {
        const whiteCaptured = document.getElementById('whiteCaptured');
        const blackCaptured = document.getElementById('blackCaptured');
        
        whiteCaptured.innerHTML = '';
        blackCaptured.innerHTML = '';
        
        this.gameState.capturedPieces.white.forEach(piece => {
            const pieceSpan = document.createElement('span');
            pieceSpan.textContent = PIECE_SYMBOLS[piece.color][piece.type];
            whiteCaptured.appendChild(pieceSpan);
        });
        
        this.gameState.capturedPieces.black.forEach(piece => {
            const pieceSpan = document.createElement('span');
            pieceSpan.textContent = PIECE_SYMBOLS[piece.color][piece.type];
            blackCaptured.appendChild(pieceSpan);
        });
    }
}

// Global game instance
let game;

// Global functions called by HTML
function startNewGame() {
    game.startNewGame();
}

function generateSetup() {
    game.generateSetup();
}

function finishSetup() {
    game.finishSetup();
}

function newGame() {
    game.startNewGame();
}

function undoMove() {
    game.undoMove();
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    game = new WildChess();
});