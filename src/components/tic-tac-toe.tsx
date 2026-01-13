"use client";

import { useState, useMemo, useEffect } from 'react';
import { X, Circle, RefreshCw, User, Bot, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

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


const Cell = ({ value, onClick, isWinning, index, disabled }: { value: Player | null, onClick: () => void, isWinning: boolean, index: number, disabled?: boolean }) => {
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
            disabled={!!value || disabled}
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
    const [lastWinner, setLastWinner] = useState<Player | null>(null);
    const [scores, setScores] = useState({ X: 0, O: 0 });
    const [playerNames, setPlayerNames] = useState({ X: "Player X", O: "Player O" });
    const [gameMode, setGameMode] = useState<GameMode>('pvp');
    const [seriesWinner, setSeriesWinner] = useState<Player | null>(null);
    const { user } = useUser();
    const firestore = useFirestore();

    const { winner, line: winningLine } = useMemo(() => calculateWinner(board), [board]);
    const isDraw = !winner && board.every(Boolean);

    function handleRestart(newRound = false) {
        setBoard(Array(9).fill(null));
        if (newRound) {
            if (gameMode === 'pvc') {
                setIsXNext(prev => !prev);
            } else {
                 // Winner starts the next round in PvP. If draw, alternate.
                setIsXNext(lastWinner ? lastWinner === 'X' : !isXNext);
            }
        } else {
            setIsXNext(true);
            setScores({X: 0, O: 0});
            setLastWinner(null);
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
        addDocumentNonBlocking(gameRecordsRef, gameRecord);
    }
    
    useEffect(() => {
        if (scores.X >= 5) {
            setSeriesWinner('X');
        } else if (scores.O >= 5) {
            setSeriesWinner('O');
        }
    }, [scores]);

    useEffect(() => {
        if (winner) {
            setLastWinner(winner);
            setScores(prevScores => ({
                ...prevScores,
                [winner]: prevScores[winner] + 1
            }));
            
            if (gameMode === 'pvp') {
                saveGameRecord();
            }

            const timer = setTimeout(() => {
                if (scores.X < 5 && scores.O < 5) {
                    handleRestart(true);
                }
            }, 2000);

            return () => clearTimeout(timer);
        } else if (isDraw) {
            setLastWinner(null); // No winner in a draw
            if (gameMode === 'pvp') {
                saveGameRecord();
            }
             const timer = setTimeout(() => {
                 if (scores.X < 5 && scores.O < 5) {
                    handleRestart(true);
                 }
            }, 2000);

            return () => clearTimeout(timer);
        }
    }, [winner, isDraw, gameMode]);
    
    useEffect(() => {
        if (gameMode === 'pvc' && !isXNext && !winner && !isDraw) {
            const timer = setTimeout(() => {
                const bestMove = findBestMove(board);
                if (bestMove !== -1) {
                    const nextBoard = board.slice();
                    nextBoard[bestMove] = 'O';
                    setBoard(nextBoard);
                    setIsXNext(true);
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [isXNext, board, gameMode, winner, isDraw]);

    function handleCellClick(i: number) {
        if (board[i] || winner || seriesWinner) {
            return;
        }

        if (gameMode === 'pvc' && !isXNext) {
            return; // Prevent player from moving on computer's turn
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
        } else if (mode === 'pvp') {
            setPlayerNames({ X: "Player X", O: "Player O" });
        }
    }
    
    const closeSeriesWinnerDialog = () => {
        setSeriesWinner(null);
        handleRestart(false);
    }


    let status;
    if (winner) {
        const winnerName = gameMode === 'pvc' && winner === 'O' ? 'Computer' : playerNames[winner];
        status = `${winnerName} wins!`;
    } else if (isDraw) {
        status = "It's a Draw!";
    } else {
        const nextPlayerName = isXNext ? playerNames.X : playerNames.O;
        status = `Next: ${nextPlayerName}`;
    }

    const currentPlayerIcon = isXNext ? (
        <X className="h-6 w-6 text-primary" strokeWidth={3} />
    ) : (
        <Circle className="h-6 w-6 text-destructive" strokeWidth={3} />
    );

    return (
        <>
            <AlertDialog open={!!seriesWinner} onOpenChange={(open) => !open && closeSeriesWinnerDialog()}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <div className="flex justify-center items-center h-16">
                        <PartyPopper className="w-12 h-12 text-yellow-400" />
                    </div>
                    <AlertDialogTitle className="text-center text-2xl">
                        {seriesWinner ? `${playerNames[seriesWinner]} wins the series!` : ''}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-center">
                        Congratulations! A new series will begin.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogAction onClick={closeSeriesWinnerDialog}>
                        Play Again
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Card className="w-full max-w-md shadow-2xl shadow-primary/10 border-primary/20">
                <CardHeader className="text-center pb-2">
                    <CardTitle className="text-3xl font-bold tracking-tight text-primary font-headline">XOXO Arena</CardTitle>
                    <div className="flex justify-center pt-4">
                        <Tabs value={gameMode} onValueChange={handleModeChange} className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="pvp"><User className="mr-2 h-4 w-4"/> Player vs Player</TabsTrigger>
                                <TabsTrigger value="pvc"><Bot className="mr-2 h-4 w-4"/> Player vs Computer</TabsTrigger>
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
                    <div className="flex justify-between items-center mb-4 px-2 gap-4">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <X className="h-5 w-5 text-primary flex-shrink-0" strokeWidth={3} />
                            <Input 
                                className="w-full h-8 flex-1"
                                value={playerNames.X} 
                                onChange={(e) => handleNameChange('X', e.target.value)}
                                disabled={gameMode === 'pvc'}
                            />
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Input 
                                className="w-full h-8 flex-1 text-right"
                                value={playerNames.O}
                                onChange={(e) => handleNameChange('O', e.target.value)}
                                disabled={gameMode === 'pvc'}
                            />
                            <Circle className="h-5 w-5 text-destructive flex-shrink-0" strokeWidth={3} />
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
                {winner && (
                    <CardFooter>
                        <Button onClick={() => handleRestart(true)} className="w-full text-lg">Play Again</Button>
                    </CardFooter>
                )}
                {(isDraw && !winner) && (
                    <CardFooter>
                        <Button onClick={() => handleRestart(true)} className="w-full text-lg">Play Again</Button>
                    </CardFooter>
                )}
            </Card>
        </>
    );
}
