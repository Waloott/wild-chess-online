const CardSystem = require('./CardSystem');

class WildChessGame {
    constructor(roomId, whitePlayer, blackPlayer) {
        this.roomId = roomId;
        this.players = {
            white: whitePlayer,
            black: blackPlayer
        };
        
        this.gameState = {
            board: Array(8).fill().map(() => Array(8).fill(null)),
            currentPlayer: 'white',
            gamePhase: 'setup', // 'setup', 'playing', 'ended'
            setupStep: 1, // 1: cards drawn, 2: manual placement, 3: finished
            drawnCards: { pawn: [], piece: [] },
            moveHistory: [],
            lastMove: null,
            manualPlacement: null,
            capturedPieces: { white: [], black: [] }
        };
        
        this.cardSystem = new CardSystem();
        this.createdAt = new Date();
    }

    generateSetup() {
        const setup = this.cardSystem.generateRandomSetup();
        this.gameState.board = setup.board;
        this.gameState.drawnCards = setup.cards;
        this.gameState.setupStep = 2;

        return {
            board: this.gameState.board,
            cards: this.gameState.drawnCards,
            setupStep: this.gameState.setupStep
        };
    }

    startManualPlacement() {
        this.gameState.setupStep = 3;
        this.gameState.manualPlacement = {
            currentPiece: 'white-queen',
            piecesToPlace: ['white-queen', 'black-queen', 'white-king', 'black-king'],
            currentIndex: 0
        };

        return {
            success: true,
            data: {
                manualPlacement: this.gameState.manualPlacement,
                setupStep: this.gameState.setupStep
            }
        };
    }

    placePiece(playerId, rank, file) {
        if (this.gameState.gamePhase !== 'setup' || this.gameState.setupStep !== 3) {
            return { success: false, error: 'Not in manual placement phase' };
        }

        if (!this.gameState.manualPlacement) {
            // Start manual placement if not already started
            const result = this.startManualPlacement();
            if (!result.success) return result;
        }

        // Check if square is empty
        if (this.gameState.board[rank][file]) {
            return { success: false, error: 'Square is occupied' };
        }

        const placement = this.gameState.manualPlacement;
        const currentPiece = placement.piecesToPlace[placement.currentIndex];
        const [color, type] = currentPiece.split('-');

        // Verify it's the correct player's turn to place
        const currentPlayer = this.players[color];
        if (currentPlayer.id !== playerId) {
            return { success: false, error: 'Not your turn to place piece' };
        }

        // Place the piece
        this.gameState.board[rank][file] = { type, color };

        // Move to next piece
        placement.currentIndex++;

        const isComplete = placement.currentIndex >= placement.piecesToPlace.length;

        return {
            success: true,
            data: {
                rank,
                file,
                piece: { type, color },
                nextPiece: isComplete ? null : placement.piecesToPlace[placement.currentIndex],
                isComplete,
                board: this.gameState.board
            }
        };
    }

    finishSetup() {
        if (this.gameState.gamePhase !== 'setup') {
            return { success: false, error: 'Game is not in setup phase' };
        }

        // Verify all pieces are placed
        if (!this.gameState.manualPlacement || 
            this.gameState.manualPlacement.currentIndex < this.gameState.manualPlacement.piecesToPlace.length) {
            return { success: false, error: 'Not all pieces have been placed' };
        }

        this.gameState.gamePhase = 'playing';
        this.gameState.manualPlacement = null;

        return {
            success: true,
            data: {
                gamePhase: this.gameState.gamePhase,
                board: this.gameState.board,
                currentPlayer: this.gameState.currentPlayer
            }
        };
    }

    makeMove(playerId, moveData) {
        if (this.gameState.gamePhase !== 'playing') {
            return { success: false, error: 'Game is not in playing phase' };
        }

        const currentPlayer = this.players[this.gameState.currentPlayer];
        if (currentPlayer.id !== playerId) {
            return { success: false, error: 'Not your turn' };
        }

        const { fromRank, fromFile, toRank, toFile } = moveData;

        // Validate move
        if (!this.isValidMove(fromRank, fromFile, toRank, toFile)) {
            return { success: false, error: 'Invalid move' };
        }

        // Execute move
        const piece = this.gameState.board[fromRank][fromFile];
        const capturedPiece = this.gameState.board[toRank][toFile];

        // Record move
        const move = {
            from: { rank: fromRank, file: fromFile },
            to: { rank: toRank, file: toFile },
            piece: { ...piece },
            capturedPiece: capturedPiece ? { ...capturedPiece } : null,
            player: this.gameState.currentPlayer,
            timestamp: new Date()
        };

        this.gameState.moveHistory.push(move);
        this.gameState.lastMove = { 
            from: { rank: fromRank, file: fromFile }, 
            to: { rank: toRank, file: toFile } 
        };

        // Handle capture
        if (capturedPiece) {
            this.gameState.capturedPieces[this.gameState.currentPlayer].push(capturedPiece);
        }

        // Make move
        this.gameState.board[toRank][toFile] = piece;
        this.gameState.board[fromRank][fromFile] = null;

        // Handle pawn promotion
        this.handlePawnPromotion(toRank, toFile);

        // Switch players
        this.gameState.currentPlayer = this.gameState.currentPlayer === 'white' ? 'black' : 'white';

        // Check for game end
        const gameEnd = this.checkGameEnd();

        return {
            success: true,
            data: {
                move,
                board: this.gameState.board,
                currentPlayer: this.gameState.currentPlayer,
                capturedPieces: this.gameState.capturedPieces,
                lastMove: this.gameState.lastMove,
                gameEnd: gameEnd
            }
        };
    }

    handlePawnPromotion(rank, file) {
        const piece = this.gameState.board[rank][file];
        if (piece && piece.type === 'pawn') {
            if ((piece.color === 'white' && rank === 7) || (piece.color === 'black' && rank === 0)) {
                // Auto-promote to queen for simplicity
                this.gameState.board[rank][file] = { type: 'queen', color: piece.color };
            }
        }
    }

    checkGameEnd() {
        // Check if king is captured (simplified win condition)
        const whiteKing = this.findKing('white');
        const blackKing = this.findKing('black');

        if (!whiteKing) {
            this.gameState.gamePhase = 'ended';
            return { type: 'checkmate', winner: 'black', reason: 'King captured' };
        }

        if (!blackKing) {
            this.gameState.gamePhase = 'ended';
            return { type: 'checkmate', winner: 'white', reason: 'King captured' };
        }

        // Check for stalemate (no legal moves)
        if (this.hasNoLegalMoves(this.gameState.currentPlayer)) {
            this.gameState.gamePhase = 'ended';
            if (this.isInCheck(this.gameState.currentPlayer)) {
                const winner = this.gameState.currentPlayer === 'white' ? 'black' : 'white';
                return { type: 'checkmate', winner, reason: 'Checkmate' };
            } else {
                return { type: 'stalemate', reason: 'No legal moves' };
            }
        }

        return null;
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

    isValidMove(fromRank, fromFile, toRank, toFile) {
        // Basic validation
        const piece = this.gameState.board[fromRank][fromFile];
        const targetPiece = this.gameState.board[toRank][toFile];

        if (!piece) return false;
        if (piece.color !== this.gameState.currentPlayer) return false;
        if (targetPiece && targetPiece.color === piece.color) return false;
        if (fromRank === toRank && fromFile === toFile) return false;

        // Check bounds
        if (toRank < 0 || toRank > 7 || toFile < 0 || toFile > 7) return false;

        // Use piece-specific validation logic
        return this.validatePieceMove(piece, fromRank, fromFile, toRank, toFile, targetPiece);
    }

    validatePieceMove(piece, fromRank, fromFile, toRank, toFile, targetPiece) {
        const rankDiff = toRank - fromRank;
        const fileDiff = toFile - fromFile;
        const absRankDiff = Math.abs(rankDiff);
        const absFileDiff = Math.abs(fileDiff);

        switch (piece.type) {
            case 'pawn':
                return this.isValidPawnMove(piece, fromRank, fromFile, toRank, toFile, targetPiece, rankDiff, fileDiff, absFileDiff);
            case 'rook':
                return this.isValidRookMove(fromRank, fromFile, toRank, toFile, rankDiff, fileDiff);
            case 'bishop':
                return this.isValidBishopMove(fromRank, fromFile, toRank, toFile, absRankDiff, absFileDiff);
            case 'queen':
                return this.isValidQueenMove(fromRank, fromFile, toRank, toFile, rankDiff, fileDiff, absRankDiff, absFileDiff);
            case 'king':
                return absRankDiff <= 1 && absFileDiff <= 1;
            case 'knight':
                return (absRankDiff === 2 && absFileDiff === 1) || (absRankDiff === 1 && absFileDiff === 2);
            default:
                return false;
        }
    }

    isValidPawnMove(piece, fromRank, fromFile, toRank, toFile, targetPiece, rankDiff, fileDiff, absFileDiff) {
        const direction = piece.color === 'white' ? 1 : -1;
        
        if (fileDiff === 0) {
            // Forward move
            if (rankDiff === direction && !targetPiece) return true;
            // Two squares forward (considering Wild Chess pawn placement)
            if (rankDiff === 2 * direction && !targetPiece && 
                ((piece.color === 'white' && fromRank === 1) || 
                 (piece.color === 'black' && fromRank === 6))) {
                return !this.gameState.board[fromRank + direction][fromFile];
            }
        } else if (absFileDiff === 1 && rankDiff === direction && targetPiece) {
            // Diagonal capture
            return true;
        }
        
        return false;
    }

    isValidRookMove(fromRank, fromFile, toRank, toFile, rankDiff, fileDiff) {
        if (rankDiff !== 0 && fileDiff !== 0) return false;
        return this.isPathClear(fromRank, fromFile, toRank, toFile);
    }

    isValidBishopMove(fromRank, fromFile, toRank, toFile, absRankDiff, absFileDiff) {
        if (absRankDiff !== absFileDiff) return false;
        return this.isPathClear(fromRank, fromFile, toRank, toFile);
    }

    isValidQueenMove(fromRank, fromFile, toRank, toFile, rankDiff, fileDiff, absRankDiff, absFileDiff) {
        const isRookMove = (rankDiff === 0 || fileDiff === 0);
        const isBishopMove = (absRankDiff === absFileDiff);
        
        if (!isRookMove && !isBishopMove) return false;
        return this.isPathClear(fromRank, fromFile, toRank, toFile);
    }

    isPathClear(fromRank, fromFile, toRank, toFile) {
        const rankStep = toRank > fromRank ? 1 : toRank < fromRank ? -1 : 0;
        const fileStep = toFile > fromFile ? 1 : toFile < fromFile ? -1 : 0;
        
        let currentRank = fromRank + rankStep;
        let currentFile = fromFile + fileStep;
        
        while (currentRank !== toRank || currentFile !== toFile) {
            if (this.gameState.board[currentRank][currentFile]) return false;
            currentRank += rankStep;
            currentFile += fileStep;
        }
        
        return true;
    }

    isInCheck(color) {
        const king = this.findKing(color);
        if (!king) return false;

        const opponentColor = color === 'white' ? 'black' : 'white';

        // Check if any opponent piece can capture the king
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const piece = this.gameState.board[rank][file];
                if (piece && piece.color === opponentColor) {
                    if (this.validatePieceMove(piece, rank, file, king.rank, king.file, { type: 'king', color })) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    hasNoLegalMoves(color) {
        for (let fromRank = 0; fromRank < 8; fromRank++) {
            for (let fromFile = 0; fromFile < 8; fromFile++) {
                const piece = this.gameState.board[fromRank][fromFile];
                if (piece && piece.color === color) {
                    for (let toRank = 0; toRank < 8; toRank++) {
                        for (let toFile = 0; toFile < 8; toFile++) {
                            if (this.isValidMove(fromRank, fromFile, toRank, toFile)) {
                                // Test if move would leave king in check
                                const testBoard = this.makeTestMove(fromRank, fromFile, toRank, toFile);
                                if (!this.isInCheckOnBoard(testBoard, color)) {
                                    return false; // Found a legal move
                                }
                            }
                        }
                    }
                }
            }
        }
        return true; // No legal moves found
    }

    makeTestMove(fromRank, fromFile, toRank, toFile) {
        const testBoard = this.gameState.board.map(row => [...row]);
        testBoard[toRank][toFile] = testBoard[fromRank][fromFile];
        testBoard[fromRank][fromFile] = null;
        return testBoard;
    }

    isInCheckOnBoard(board, color) {
        // Find king on test board
        let king = null;
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const piece = board[rank][file];
                if (piece && piece.type === 'king' && piece.color === color) {
                    king = { rank, file };
                    break;
                }
            }
        }

        if (!king) return true; // No king = in check

        const opponentColor = color === 'white' ? 'black' : 'white';

        // Check if any opponent piece can capture the king
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const piece = board[rank][file];
                if (piece && piece.color === opponentColor) {
                    // Temporarily set board for validation
                    const originalBoard = this.gameState.board;
                    this.gameState.board = board;
                    const canCapture = this.validatePieceMove(piece, rank, file, king.rank, king.file, { type: 'king', color });
                    this.gameState.board = originalBoard;
                    
                    if (canCapture) return true;
                }
            }
        }

        return false;
    }

    resign(playerId) {
        if (this.gameState.gamePhase !== 'playing') {
            return { success: false, error: 'Game is not in progress' };
        }

        const player = Object.values(this.players).find(p => p.id === playerId);
        if (!player) {
            return { success: false, error: 'Player not found' };
        }

        this.gameState.gamePhase = 'ended';
        
        return {
            success: true,
            data: {
                type: 'resignation',
                winner: player.color === 'white' ? 'black' : 'white',
                resignedPlayer: player.color
            }
        };
    }

    getPublicState() {
        return {
            board: this.gameState.board,
            currentPlayer: this.gameState.currentPlayer,
            gamePhase: this.gameState.gamePhase,
            setupStep: this.gameState.setupStep,
            drawnCards: this.gameState.drawnCards,
            lastMove: this.gameState.lastMove,
            capturedPieces: this.gameState.capturedPieces,
            manualPlacement: this.gameState.manualPlacement,
            moveCount: this.gameState.moveHistory.length
        };
    }

    getFullState() {
        return {
            ...this.getPublicState(),
            moveHistory: this.gameState.moveHistory,
            players: this.players,
            createdAt: this.createdAt
        };
    }
}

module.exports = WildChessGame;