// Card system for Wild Chess setup
class CardSystem {
    constructor() {
        this.files = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    }
    
    generateCardDecks() {
        // Small deck (8 cards) - for ranks 1 and 8
        const smallDeck = [];
        for (let file of this.files) {
            smallDeck.push(file + '1');
            smallDeck.push(file + '8');
        }
        
        // Large deck (48 cards) - for ranks 2-7
        const largeDeck = [];
        for (let rank = 2; rank <= 7; rank++) {
            for (let file of this.files) {
                largeDeck.push(file + rank);
            }
        }
        
        return { small: smallDeck, large: largeDeck };
    }
    
    shuffle(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    positionToCoords(pos) {
        const file = pos.charCodeAt(0) - 65; // A=0, B=1, etc.
        const rank = parseInt(pos[1]) - 1;
        return { rank, file };
    }
    
    generateRandomSetup() {
        const decks = this.generateCardDecks();
        const shuffledLarge = this.shuffle(decks.large);
        const shuffledSmall = this.shuffle(decks.small);
        
        // Draw 8 cards for pawns (4 for each player)
        const pawnCards = shuffledLarge.slice(0, 8);
        
        // Combine remaining large cards with small deck, shuffle, draw 6 for pieces
        const remainingCards = [...shuffledLarge.slice(8), ...shuffledSmall];
        const shuffledRemaining = this.shuffle(remainingCards);
        const pieceCards = shuffledRemaining.slice(0, 6);
        
        // Create empty board
        const board = Array(8).fill().map(() => Array(8).fill(null));
        
        // Place pawns
        this.placePawnsFromCards(board, pawnCards);
        
        // Place pieces
        this.placePiecesFromCards(board, pieceCards);
        
        return {
            board: board,
            cards: {
                pawn: pawnCards,
                piece: pieceCards
            }
        };
    }
    
    placePawnsFromCards(board, cards) {
        for (let i = 0; i < cards.length; i++) {
            const pos = this.positionToCoords(cards[i]);
            const color = i < 4 ? 'white' : 'black';
            
            // Validate pawn placement (should be in ranks 2-7)
            if (pos.rank >= 1 && pos.rank <= 6) {
                board[pos.rank][pos.file] = { type: 'pawn', color: color };
            }
        }
    }
    
    placePiecesFromCards(board, cards) {
        // According to Wild Chess rules: bishops, knights, rooks (2 each)
        const pieces = ['bishop', 'knight', 'rook', 'bishop', 'knight', 'rook'];
        
        for (let i = 0; i < cards.length && i < pieces.length; i++) {
            const pos = this.positionToCoords(cards[i]);
            const color = i < 3 ? 'white' : 'black';
            const pieceType = pieces[i % 3];
            
            // Check if position is empty
            if (!board[pos.rank][pos.file]) {
                board[pos.rank][pos.file] = { type: pieceType, color: color };
            }
        }
    }
    
    validateSetup(board) {
        const whitePieces = { king: 0, queen: 0, rook: 0, bishop: 0, knight: 0, pawn: 0 };
        const blackPieces = { king: 0, queen: 0, rook: 0, bishop: 0, knight: 0, pawn: 0 };
        
        // Count pieces
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                const piece = board[rank][file];
                if (piece) {
                    if (piece.color === 'white') {
                        whitePieces[piece.type]++;
                    } else {
                        blackPieces[piece.type]++;
                    }
                }
            }
        }
        
        // Validate piece counts (before kings and queens are placed)
        const errors = [];
        
        // Each side should have 2 bishops, 2 knights, 2 rooks
        if (whitePieces.bishop !== 2) errors.push('White should have 2 bishops');
        if (blackPieces.bishop !== 2) errors.push('Black should have 2 bishops');
        if (whitePieces.knight !== 2) errors.push('White should have 2 knights');
        if (blackPieces.knight !== 2) errors.push('Black should have 2 knights');
        if (whitePieces.rook !== 2) errors.push('White should have 2 rooks');
        if (blackPieces.rook !== 2) errors.push('Black should have 2 rooks');
        
        // Should have 4 pawns each (in Wild Chess variant)
        if (whitePieces.pawn !== 4) errors.push('White should have 4 pawns');
        if (blackPieces.pawn !== 4) errors.push('Black should have 4 pawns');
        
        return {
            isValid: errors.length === 0,
            errors: errors,
            whitePieces: whitePieces,
            blackPieces: blackPieces
        };
    }
    
    // Alternative setup method for custom card selection
    customSetup(pawnPositions, piecePositions) {
        const board = Array(8).fill().map(() => Array(8).fill(null));
        
        // Place pawns from custom positions
        if (pawnPositions && pawnPositions.length === 8) {
            this.placePawnsFromCards(board, pawnPositions);
        }
        
        // Place pieces from custom positions
        if (piecePositions && piecePositions.length === 6) {
            this.placePiecesFromCards(board, piecePositions);
        }
        
        return board;
    }
    
    // Get available positions for manual king/queen placement
    getAvailablePositions(board) {
        const available = [];
        
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                if (!board[rank][file]) {
                    available.push({
                        rank: rank,
                        file: file,
                        notation: String.fromCharCode(65 + file) + (rank + 1)
                    });
                }
            }
        }
        
        return available;
    }
    
    // Convert coordinates back to chess notation
    coordsToNotation(rank, file) {
        return String.fromCharCode(65 + file) + (rank + 1);
    }
    
    // Generate a completely random valid setup (for testing)
    generateTestSetup() {
        const board = Array(8).fill().map(() => Array(8).fill(null));
        
        // Place pieces randomly for testing
        const allPositions = [];
        for (let rank = 0; rank < 8; rank++) {
            for (let file = 0; file < 8; file++) {
                allPositions.push({ rank, file });
            }
        }
        
        const shuffledPositions = this.shuffle(allPositions);
        let posIndex = 0;
        
        // Place white pieces
        const whitePieces = ['king', 'queen', 'rook', 'rook', 'bishop', 'bishop', 'knight', 'knight', 'pawn', 'pawn', 'pawn', 'pawn'];
        for (let piece of whitePieces) {
            const pos = shuffledPositions[posIndex++];
            board[pos.rank][pos.file] = { type: piece, color: 'white' };
        }
        
        // Place black pieces
        const blackPieces = ['king', 'queen', 'rook', 'rook', 'bishop', 'bishop', 'knight', 'knight', 'pawn', 'pawn', 'pawn', 'pawn'];
        for (let piece of blackPieces) {
            const pos = shuffledPositions[posIndex++];
            board[pos.rank][pos.file] = { type: piece, color: 'black' };
        }
        
        return board;
    }
}