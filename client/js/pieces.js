// Piece symbols and movement logic
const PIECE_SYMBOLS = {
    'white': { 
        'king': '♔', 
        'queen': '♕', 
        'rook': '♖', 
        'bishop': '♗', 
        'knight': '♘', 
        'pawn': '♙' 
    },
    'black': { 
        'king': '♚', 
        'queen': '♛', 
        'rook': '♜', 
        'bishop': '♝', 
        'knight': '♞', 
        'pawn': '♟' 
    }
};

class PieceLogic {
    constructor() {
        // Initialize any piece-specific state if needed
    }
    
    isValidMove(board, fromRank, fromFile, toRank, toFile, currentPlayer) {
        const piece = board[fromRank][fromFile];
        const targetPiece = board[toRank][toFile];
        
        // Basic validation
        if (!piece) return false;
        if (piece.color !== currentPlayer) return false;
        if (targetPiece && targetPiece.color === piece.color) return false;
        if (fromRank === toRank && fromFile === toFile) return false;
        
        // Check bounds
        if (toRank < 0 || toRank > 7 || toFile < 0 || toFile > 7) return false;
        
        const rankDiff = toRank - fromRank;
        const fileDiff = toFile - fromFile;
        const absRankDiff = Math.abs(rankDiff);
        const absFileDiff = Math.abs(fileDiff);
        
        switch (piece.type) {
            case 'pawn':
                return this.isValidPawnMove(board, fromRank, fromFile, toRank, toFile, piece, targetPiece, rankDiff, fileDiff, absFileDiff);
            case 'rook':
                return this.isValidRookMove(board, fromRank, fromFile, toRank, toFile, rankDiff, fileDiff);
            case 'bishop':
                return this.isValidBishopMove(board, fromRank, fromFile, toRank, toFile, absRankDiff, absFileDiff);
            case 'queen':
                return this.isValidQueenMove(board, fromRank, fromFile, toRank, toFile, rankDiff, fileDiff, absRankDiff, absFileDiff);
            case 'king':
                return this.isValidKingMove(absRankDiff, absFileDiff);
            case 'knight':
                return this.isValidKnightMove(absRankDiff, absFileDiff);
            default:
                return false;
        }
    }
    
    isValidPawnMove(board, fromRank, fromFile, toRank, toFile, piece, targetPiece, rankDiff, fileDiff, absFileDiff) {
        const direction = piece.color === 'white' ? 1 : -1;
        const startRank = piece.color === 'white' ? 1 : 6;
        
        if (fileDiff === 0) {
            // Forward move
            if (rankDiff === direction && !targetPiece) {
                return true;
            }
            // Two squares forward from starting position
            if (rankDiff === 2 * direction && fromRank === startRank && !targetPiece && !board[fromRank + direction][fromFile]) {
                return true;
            }
        } else if (absFileDiff === 1 && rankDiff === direction && targetPiece) {
            // Diagonal capture
            return true;
        }
        
        // En passant would go here in full implementation
        return false;
    }
    
    isValidRookMove(board, fromRank, fromFile, toRank, toFile, rankDiff, fileDiff) {
        if (rankDiff !== 0 && fileDiff !== 0) return false;
        return this.isPathClear(board, fromRank, fromFile, toRank, toFile);
    }
    
    isValidBishopMove(board, fromRank, fromFile, toRank, toFile, absRankDiff, absFileDiff) {
        if (absRankDiff !== absFileDiff) return false;
        return this.isPathClear(board, fromRank, fromFile, toRank, toFile);
    }
    
    isValidQueenMove(board, fromRank, fromFile, toRank, toFile, rankDiff, fileDiff, absRankDiff, absFileDiff) {
        // Queen moves like rook or bishop
        const isRookMove = (rankDiff === 0 || fileDiff === 0);
        const isBishopMove = (absRankDiff === absFileDiff);
        
        if (!isRookMove && !isBishopMove) return false;
        return this.isPathClear(board, fromRank, fromFile, toRank, toFile);
    }
    
    isValidKingMove(absRankDiff, absFileDiff) {
        return absRankDiff <= 1 && absFileDiff <= 1;
    }
    
    isValidKnightMove(absRankDiff, absFileDiff) {
        return (absRankDiff === 2 && absFileDiff === 1) || (absRankDiff === 1 && absFileDiff === 2);
    }
    
    isPathClear(board, fromRank, fromFile, toRank, toFile) {
        const rankStep = toRank > fromRank ? 1 : toRank < fromRank ? -1 : 0;
        const fileStep = toFile > fromFile ? 1 : toFile < fromFile ? -1 : 0;
        
        let currentRank = fromRank + rankStep;
        let currentFile = fromFile + fileStep;
        
        while (currentRank !== toRank || currentFile !== toFile) {
            if (board[currentRank][currentFile]) return false;
            currentRank += rankStep;
            currentFile += fileStep;
        }
        
        return true;
    }
    
    // Check if a king is in check
    isInCheck(board, kingColor) {
        const king = this.findKing(board, kingColor);
        if (!king) return false;
        
        const opponentColor = kingColor === 'white' ? 'black' : 'white';
        
        // Check if any opponent piece can capture the king
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const piece = board[rank][file];
                if (piece && piece.color === opponentColor) {
                    if (this.isValidMove(board, rank, file, king.rank, king.file, opponentColor)) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
    
    findKing(board, color) {
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const piece = board[rank][file];
                if (piece && piece.type === 'king' && piece.color === color) {
                    return { rank, file };
                }
            }
        }
        return null;
    }
    
    // Get all legal moves for a player
    getLegalMoves(board, color) {
        const moves = [];
        
        for (let fromRank = 0; fromRank < 8; fromRank++) {
            for (let fromFile = 0; fromFile < 8; fromFile++) {
                const piece = board[fromRank][fromFile];
                if (piece && piece.color === color) {
                    for (let toRank = 0; toRank < 8; toRank++) {
                        for (let toFile = 0; toFile < 8; toFile++) {
                            if (this.isValidMove(board, fromRank, fromFile, toRank, toFile, color)) {
                                // Check if move would leave king in check
                                const testBoard = this.makeTestMove(board, fromRank, fromFile, toRank, toFile);
                                if (!this.isInCheck(testBoard, color)) {
                                    moves.push({
                                        from: { rank: fromRank, file: fromFile },
                                        to: { rank: toRank, file: toFile },
                                        piece: piece
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
        
        return moves;
    }
    
    // Create a test board for move validation
    makeTestMove(board, fromRank, fromFile, toRank, toFile) {
        const testBoard = board.map(row => [...row]);
        testBoard[toRank][toFile] = testBoard[fromRank][fromFile];
        testBoard[fromRank][fromFile] = null;
        return testBoard;
    }
    
    // Check for checkmate
    isCheckmate(board, color) {
        if (!this.isInCheck(board, color)) return false;
        return this.getLegalMoves(board, color).length === 0;
    }
    
    // Check for stalemate
    isStalemate(board, color) {
        if (this.isInCheck(board, color)) return false;
        return this.getLegalMoves(board, color).length === 0;
    }
    
    // Get piece value for evaluation (if needed for AI)
    getPieceValue(pieceType) {
        const values = {
            'pawn': 1,
            'knight': 3,
            'bishop': 3,
            'rook': 5,
            'queen': 9,
            'king': 100
        };
        return values[pieceType] || 0;
    }
}