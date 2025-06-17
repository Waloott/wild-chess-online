// Chess board visualization and interaction
class ChessBoard {
    constructor() {
        this.boardElement = document.getElementById('chessboard');
    }
    
    initialize() {
        this.boardElement.innerHTML = '';
        
        for (let rank = 7; rank >= 0; rank--) {
            for (let file = 0; file < 8; file++) {
                const square = document.createElement('div');
                square.className = `square ${(rank + file) % 2 === 0 ? 'black' : 'white'}`;
                square.dataset.rank = rank;
                square.dataset.file = file;
                square.onclick = () => game.handleSquareClick(rank, file);
                
                // Add coordinates
                if (file === 0) {
                    const rankLabel = document.createElement('div');
                    rankLabel.className = 'coordinates coord-rank';
                    rankLabel.textContent = rank + 1;
                    square.appendChild(rankLabel);
                }
                if (rank === 0) {
                    const fileLabel = document.createElement('div');
                    fileLabel.className = 'coordinates coord-file';
                    fileLabel.textContent = String.fromCharCode(97 + file);
                    square.appendChild(fileLabel);
                }
                
                this.boardElement.appendChild(square);
            }
        }
    }
    
    update(board) {
        const squares = document.querySelectorAll('.square');
        squares.forEach(square => {
            const rank = parseInt(square.dataset.rank);
            const file = parseInt(square.dataset.file);
            const piece = board[rank][file];
            
            // Clear previous piece
            const existingPiece = square.querySelector('.piece-symbol');
            if (existingPiece) existingPiece.remove();
            
            // Add piece if exists
            if (piece) {
                const pieceElement = document.createElement('span');
                pieceElement.className = 'piece-symbol';
                pieceElement.textContent = PIECE_SYMBOLS[piece.color][piece.type];
                square.appendChild(pieceElement);
            }
            
            // Remove all highlighting classes
            square.classList.remove('selected', 'possible-move', 'last-move', 'piece-moved', 'empty-square');
        });
    }
    
    highlightSelected(selectedSquare, board, pieceLogic, currentPlayer) {
        if (!selectedSquare) return;
        
        const [rank, file] = selectedSquare;
        const square = document.querySelector(`[data-rank="${rank}"][data-file="${file}"]`);
        square.classList.add('selected');
        
        // Highlight possible moves
        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                if (pieceLogic.isValidMove(board, rank, file, r, f, currentPlayer)) {
                    const targetSquare = document.querySelector(`[data-rank="${r}"][data-file="${f}"]`);
                    targetSquare.classList.add('possible-move');
                }
            }
        }
    }
    
    highlightLastMove(lastMove) {
        if (!lastMove) return;
        
        const fromSquare = document.querySelector(`[data-rank="${lastMove.from.rank}"][data-file="${lastMove.from.file}"]`);
        const toSquare = document.querySelector(`[data-rank="${lastMove.to.rank}"][data-file="${lastMove.to.file}"]`);
        
        if (fromSquare) fromSquare.classList.add('last-move');
        if (toSquare) {
            toSquare.classList.add('last-move');
            toSquare.classList.add('piece-moved');
        }
    }
    
    getSquarePosition(rank, file) {
        return document.querySelector(`[data-rank="${rank}"][data-file="${file}"]`);
    }
    
    animateMove(fromRank, fromFile, toRank, toFile, callback) {
        const fromSquare = this.getSquarePosition(fromRank, fromFile);
        const toSquare = this.getSquarePosition(toRank, toFile);
        
        if (fromSquare && toSquare) {
            const piece = fromSquare.querySelector('.piece-symbol');
            if (piece) {
                // Simple animation - in a full implementation you might use more sophisticated animations
                piece.style.transition = 'all 0.3s ease';
                setTimeout(() => {
                    if (callback) callback();
                }, 300);
            }
        } else if (callback) {
            callback();
        }
    }
}