"use client";

import { useState, useMemo } from 'react';
import { X, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Player = 'X' | 'O';
type Board = (Player | null)[];

function calculateWinner(squares: Board): { winner: Player | null; line: number[] | null } {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
        [0, 4, 8], [2, 4, 6]             // diagonals
    ];
    for (let i = 0; i < lines.length; i++) {
        const [a, b, c] = lines[i];
        if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
            return { winner: squares[a], line: lines[i] };
        }
    }
    return { winner: null, line: null };
}

const Cell = ({ value, onClick, isWinning, index }: { value: Player | null, onClick: () => void, isWinning: boolean, index: number }) => {
    const row = Math.floor(index / 3);
    const col = index % 3;
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex h-24 w-24 items-center justify-center transition-colors duration-300 md:h-28 md:w-28",
                col < 2 && "border-r",
                row < 2 && "border-b",
                "border-primary/20",
                isWinning ? "bg-accent/30" : "bg-card hover:bg-primary/5",
                "disabled:cursor-not-allowed"
            )}
            disabled={!!value}
            aria-label={`Cell ${index}`}
        >
            {value === 'X' && <X className="h-12 w-12 text-primary md:h-16 md:w-16" strokeWidth={3} />}
            {value === 'O' && <Circle className="h-12 w-12 text-destructive md:h-16 md:w-16" strokeWidth={3} />}
        </button>
    );
};


export default function TicTacToeGame() {
    const [board, setBoard] = useState<Board>(Array(9).fill(null));
    const [isXNext, setIsXNext] = useState(true);

    const { winner, line: winningLine } = useMemo(() => calculateWinner(board), [board]);
    const isDraw = !winner && board.every(Boolean);

    function handleCellClick(i: number) {
        if (board[i] || winner) {
            return;
        }
        const nextBoard = board.slice();
        nextBoard[i] = isXNext ? 'X' : 'O';
        setBoard(nextBoard);
        setIsXNext(!isXNext);
    }
    
    function handleRestart() {
        setBoard(Array(9).fill(null));
        setIsXNext(true);
    }

    let status;
    if (winner) {
        status = "Winner:";
    } else if (isDraw) {
        status = "It's a Draw!";
    } else {
        status = "Next player:";
    }

    const currentPlayerIcon = isXNext ? (
        <X className="h-6 w-6 text-primary" strokeWidth={3} />
    ) : (
        <Circle className="h-6 w-6 text-destructive" strokeWidth={3} />
    );

    const winnerIcon = winner === 'X' ? (
        <X className="h-8 w-8 text-primary" strokeWidth={3} />
    ) : winner === 'O' ? (
        <Circle className="h-8 w-8 text-destructive" strokeWidth={3} />
    ) : null;


    return (
        <Card className="w-full max-w-md shadow-2xl shadow-primary/10 border-primary/20">
            <CardHeader className="text-center">
                <CardTitle className="text-3xl font-bold tracking-tight text-primary font-headline">Tic Tac Toe Duel</CardTitle>
                <CardDescription className="pt-2 text-lg">
                    <div className="flex h-8 items-center justify-center gap-2">
                        <span>{status}</span>
                        {winner && winnerIcon}
                        {!winner && !isDraw && <div className="animate-pulse">{currentPlayerIcon}</div>}
                    </div>
                </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
                <div className="grid grid-cols-3">
                    {board.map((value, i) => (
                        <Cell
                            key={i}
                            index={i}
                            value={value}
                            onClick={() => handleCellClick(i)}
                            isWinning={winningLine?.includes(i) ?? false}
                        />
                    ))}
                </div>
            </CardContent>
            {(winner || isDraw) && (
                <CardFooter>
                    <Button onClick={handleRestart} className="w-full text-lg">Play Again</Button>
                </CardFooter>
            )}
        </Card>
    );
}
