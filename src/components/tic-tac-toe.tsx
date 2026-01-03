"use client";

import { useState, useMemo, useEffect } from 'react';
import { X, Circle, RefreshCw, User, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useUser, useFirestore } from '@/firebase';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Player = 'X' | 'O';
type Board = (Player | null)[];
type GameMode = 'pvp' | 'pvc';

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

function findBestMove(squares: Board): number {
    // Check for a winning move
    for (let i = 0; i < squares.length; i++) {
        if (!squares[i]) {
            const tempBoard = squares.slice();
            tempBoard[i] = 'O';
            if (calculateWinner(tempBoard).winner === 'O') {
                return i;
            }
        }
    }
    // Check to block opponent's winning move
    for (let i = 0; i < squares.length; i++) {
        if (!squares[i]) {
            const tempBoard = squares.slice();
            tempBoard[i] = 'X';
            if (calculateWinner(tempBoard).winner === 'X') {
                return i;
            }
        }
    }
    // Take the center if available
    if (!squares[4]) return 4;

    // Take a random available corner
    const corners = [0, 2, 6, 8];
    const availableCorners = corners.filter(i => !squares[i]);
    if (availableCorners.length > 0) {
        return availableCorners[Math.floor(Math.random() * availableCorners.length)];
    }
    // Take any available cell
    const availableCells = squares.map((_, i) => i).filter(i => !squares[i]);
    if(availableCells.length > 0) {
        return availableCells[Math.floor(Math.random() * availableCells.length)];
    }
    return -1; // Should not happen
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
    const [scores, setScores] = useState({ X: 0, O: 0 });
    const [playerNames, setPlayerNames] = useState({ X: "Player X", O: "Player O" });
    const [gameMode, setGameMode] = useState<GameMode>('pvp');
    const { user } = useUser();
    const firestore = useFirestore();

    const { winner, line: winningLine } = useMemo(() => calculateWinner(board), [board]);
    const isDraw = !winner && board.every(Boolean);

    function handleRestart(newRound = false) {
        setBoard(Array(9).fill(null));
        setIsXNext(true);
        if(!newRound) {
            setScores({X: 0, O: 0});
        }
    }
    
    async function saveGameRecord() {
        if (!user || gameMode !== 'pvp') return;

        const gameRecord = {
            player1Id: user.uid,
            player2Id: 'player2', // In PvP this could be another user's ID
            winnerId: winner ? (winner === 'X' ? user.uid : 'player2') : null,
            moves: board.join(''),
            timestamp: new Date().toISOString()
        };

        const gameRecordsRef = collection(firestore, `users/${user.uid}/game_records`);
        await addDocumentNonBlocking(gameRecordsRef, gameRecord);
    }

    useEffect(() => {
        if (winner) {
            setScores(prevScores => ({
                ...prevScores,
                [winner]: prevScores[winner] + 1
            }));
            
            if (gameMode === 'pvp') {
                saveGameRecord();
            }

            const timer = setTimeout(() => {
                handleRestart(true);
            }, 2000);

            return () => clearTimeout(timer);
        } else if (isDraw) {
            if (gameMode === 'pvp') {
                saveGameRecord();
            }
        }
    }, [winner, isDraw]);
    
    useEffect(() => {
        if (gameMode === 'pvc' && !isXNext && !winner && !isDraw) {
            const timer = setTimeout(() => {
                const bestMove = findBestMove(board);
                if (bestMove !== -1) {
                    handleCellClick(bestMove);
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [isXNext, board, gameMode, winner, isDraw]);

    function handleCellClick(i: number) {
        if (board[i] || winner) {
            return;
        }

        // Prevent player from clicking during computer's turn
        if (gameMode === 'pvc' && !isXNext) {
            return;
        }

        const nextBoard = board.slice();
        nextBoard[i] = isXNext ? 'X' : 'O';
        setBoard(nextBoard);
        setIsXNext(!isXNext);
    }
    
    function handleNameChange(player: Player, name: string) {
        setPlayerNames(prevNames => ({
            ...prevNames,
            [player]: name
        }));
    }

    const handleModeChange = (mode: string) => {
        setGameMode(mode as GameMode);
        handleRestart(false);
        if(mode === 'pvc') {
            setPlayerNames({ X: "You", O: "Computer" });
        } else {
            setPlayerNames({ X: "Player X", O: "Player O" });
        }
    }

    let status;
    if (winner) {
        const winnerName = gameMode === 'pvc' && winner === 'O' ? 'Computer' : playerNames[winner];
        status = `${winnerName} wins!`;
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

    return (
        <Card className="w-full max-w-md shadow-2xl shadow-primary/10 border-primary/20">
            <CardHeader className="text-center pb-2">
                <CardTitle className="text-3xl font-bold tracking-tight text-primary font-headline">Tic Tac Toe Duel</CardTitle>
                <div className="flex justify-center pt-4">
                     <Tabs value={gameMode} onValueChange={handleModeChange} className="w-[400px]">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="pvp"><User className="mr-2"/> Player vs Player</TabsTrigger>
                            <TabsTrigger value="pvc"><Bot className="mr-2"/> Player vs Computer</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
                 <div className="flex justify-center pt-4">
                    <Button onClick={() => handleRestart()} variant="outline" size="sm">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        New Game
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex justify-between items-center mb-4 px-2">
                    <div className="flex items-center gap-2">
                        <X className="h-5 w-5 text-primary" strokeWidth={3} />
                         <Input 
                            className="w-32 h-8"
                            value={playerNames.X} 
                            onChange={(e) => handleNameChange('X', e.target.value)}
                            disabled={gameMode === 'pvc'}
                         />
                    </div>
                     <div className="flex items-center gap-2">
                        <Input 
                            className="w-32 h-8 text-right"
                            value={playerNames.O}
                            onChange={(e) => handleNameChange('O', e.target.value)}
                            disabled={gameMode === 'pvc'}
                        />
                        <Circle className="h-5 w-5 text-destructive" strokeWidth={3} />
                    </div>
                </div>
                 <div className="flex justify-between items-center mb-4 px-2 text-2xl font-bold">
                    <div className="text-primary">{scores.X}</div>
                    <div className="text-sm font-medium text-muted-foreground">Score</div>
                    <div className="text-destructive">{scores.O}</div>
                </div>
                <CardDescription className="pt-2 text-lg">
                    <div className="flex h-8 items-center justify-center gap-2">
                        <span>{status}</span>
                        {!winner && !isDraw && <div className="animate-pulse">{currentPlayerIcon}</div>}
                    </div>
                </CardDescription>

                <div className="flex justify-center pt-4">
                    <div className="grid grid-cols-3 rounded-lg overflow-hidden border">
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
                </div>
            </CardContent>
            {(isDraw && !winner) && (
                <CardFooter>
                    <Button onClick={() => handleRestart(true)} className="w-full text-lg">Play Again</Button>
                </CardFooter>
            )}
        </Card>
    );
}
