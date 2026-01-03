"use client";

import { useState, useMemo, useEffect } from 'react';
import { X, Circle, RefreshCw, User, Bot, PartyPopper, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection, doc, query, where, limit, setDoc, updateDoc } from 'firebase/firestore';
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
import { Badge } from './ui/badge';

type Player = 'X' | 'O';
type Board = (Player | null)[];
type GameMode = 'pvp' | 'pvc' | 'online';

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

const OnlineGame = () => {
    const firestore = useFirestore();
    const { user } = useUser();
    const [activeGameId, setActiveGameId] = useState<string | null>(null);

    const gamesCollectionRef = useMemoFirebase(() => collection(firestore, 'games'), [firestore]);
    
    // Query for waiting games
    const waitingGamesQuery = useMemoFirebase(() => 
        query(gamesCollectionRef, where('status', '==', 'waiting'), limit(10)),
        [gamesCollectionRef]
    );
    const { data: waitingGames, isLoading: isLoadingWaiting } = useCollection(waitingGamesQuery);

    // Document reference for the active game
    const activeGameRef = useMemoFirebase(() => 
        activeGameId ? doc(firestore, 'games', activeGameId) : null,
        [firestore, activeGameId]
    );
    const { data: activeGame, isLoading: isLoadingGame } = useDoc(activeGameRef);

    const createGame = async () => {
        if (!user || !firestore) return;
        const newGame = {
            player1Id: user.uid,
            player2Id: null,
            board: Array(9).fill(null).join(''),
            nextPlayer: user.uid,
            status: 'waiting',
            winner: null,
            createdAt: new Date().toISOString(),
        };
        const docRef = await addDocumentNonBlocking(gamesCollectionRef, newGame);
        if (docRef) {
          setActiveGameId(docRef.id);
        }
    };

    const joinGame = (gameId: string) => {
        if (!user || !firestore) return;
        const gameRef = doc(firestore, 'games', gameId);
        updateDocumentNonBlocking(gameRef, {
            player2Id: user.uid,
            status: 'active'
        });
        setActiveGameId(gameId);
    };
    
    const handleOnlineCellClick = (index: number) => {
        if (!user || !activeGame || !activeGameId) return;

        const board = activeGame.board.split('');
        const { winner } = calculateWinner(board as Board);

        if (board[index] || winner || activeGame.nextPlayer !== user.uid) {
            return;
        }

        const playerSymbol = activeGame.player1Id === user.uid ? 'X' : 'O';
        board[index] = playerSymbol;

        const newWinnerResult = calculateWinner(board as Board);
        const isDraw = !newWinnerResult.winner && board.every(Boolean);

        const nextPlayer = activeGame.nextPlayer === activeGame.player1Id 
            ? activeGame.player2Id 
            : activeGame.player1Id;

        let newStatus = 'active';
        let winnerId = null;
        if(newWinnerResult.winner) {
            newStatus = 'finished';
            winnerId = newWinnerResult.winner === 'X' ? activeGame.player1Id : activeGame.player2Id;
        } else if (isDraw) {
            newStatus = 'finished';
            winnerId = 'draw';
        }

        const gameRef = doc(firestore, 'games', activeGameId);
        updateDocumentNonBlocking(gameRef, {
            board: board.join(''),
            nextPlayer: nextPlayer,
            status: newStatus,
            winner: winnerId
        });
    }

    const leaveGame = () => {
      if(activeGame?.status !== 'finished') {
        const gameRef = doc(firestore, 'games', activeGameId!);
        updateDocumentNonBlocking(gameRef, {
            status: 'finished',
            winner: activeGame?.nextPlayer === activeGame?.player1Id ? activeGame?.player2Id : activeGame?.player1Id
        });
      }
      setActiveGameId(null);
    }
    
    if (activeGameId && activeGame) {
        const board = activeGame.board.split('') as Board;
        const { winner, line: winningLine } = calculateWinner(board);
        const isDraw = !winner && board.every(Boolean);
        const playerSymbol = user?.uid === activeGame.player1Id ? 'X' : 'O';
        const opponentId = user?.uid === activeGame.player1Id ? activeGame.player2Id : activeGame.player1Id;

        let statusText;
        if (activeGame.status === 'waiting') {
            statusText = 'Waiting for an opponent...';
        } else if (activeGame.status === 'active') {
            statusText = activeGame.nextPlayer === user?.uid ? "Your turn" : "Opponent's turn";
        } else if (activeGame.status === 'finished') {
            if (activeGame.winner === 'draw') {
                statusText = "It's a draw!";
            } else if (activeGame.winner === user?.uid) {
                statusText = 'You win!';
            } else {
                statusText = 'You lose!';
            }
        }

        return (
            <div className="flex flex-col items-center gap-4">
                 <div className="flex justify-between w-full items-center">
                    <div>You are Player <Badge>{playerSymbol}</Badge></div>
                    <div>Opponent: <Badge variant="secondary">{opponentId ? 'Player ' + (playerSymbol === 'X' ? 'O' : 'X') : '...'}</Badge></div>
                </div>
                <CardDescription className="pt-2 text-lg h-8">{statusText}</CardDescription>
                <div className="grid grid-cols-3 rounded-lg overflow-hidden border">
                    {board.map((value, i) => (
                        <Cell
                            key={i}
                            index={i}
                            value={value}
                            onClick={() => handleOnlineCellClick(i)}
                            isWinning={winningLine?.includes(i) ?? false}
                            disabled={activeGame.nextPlayer !== user?.uid || winner || isDraw}
                        />
                    ))}
                </div>
                <Button onClick={leaveGame} className="w-full">
                    {activeGame.status === 'finished' ? 'Go to Lobby' : 'Forfeit & Leave'}
                </Button>
            </div>
        );
    }
    
    return (
        <div className='flex flex-col gap-4 items-center'>
            <h2 className='text-xl font-semibold'>Lobby</h2>
            <p className="text-muted-foreground">Join a game or create a new one.</p>
            <Button onClick={createGame} className='w-full'>Create New Game</Button>
            <div className='w-full border-t my-2'></div>
            <h3 className='font-semibold'>Available Games</h3>
            {isLoadingWaiting && <p>Searching for games...</p>}
            {!isLoadingWaiting && (!waitingGames || waitingGames.length === 0) && (
                <p className='text-muted-foreground text-sm'>No open games found. Create one!</p>
            )}
            <div className='flex flex-col gap-2 w-full'>
                {waitingGames?.map(game => (
                    <Card key={game.id} className='p-4 flex justify-between items-center'>
                        <div>Game by Player {game.player1Id.substring(0,5)}...</div>
                        <Button size="sm" onClick={() => joinGame(game.id)}>Join</Button>
                    </Card>
                ))}
            </div>
        </div>
    )
}


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
        if (gameMode === 'online') return;
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
                    <CardTitle className="text-3xl font-bold tracking-tight text-primary font-headline">Tic Tac Toe Duel</CardTitle>
                    <div className="flex justify-center pt-4">
                        <Tabs value={gameMode} onValueChange={handleModeChange} className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="pvp"><User className="mr-2"/> Player vs Player</TabsTrigger>
                                <TabsTrigger value="pvc"><Bot className="mr-2"/> Player vs Computer</TabsTrigger>
                                <TabsTrigger value="online"><Globe className="mr-2"/> Online</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                    {gameMode !== 'online' && (
                         <div className="flex justify-center pt-4">
                            <Button onClick={() => handleRestart()} variant="outline" size="sm">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                New Game
                            </Button>
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                {gameMode === 'online' ? (
                        <OnlineGame />
                    ) : (
                        <>
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
                        </>
                    )}
                </CardContent>
                {gameMode !== 'online' && winner && (
                    <CardFooter>
                        <Button onClick={() => handleRestart(true)} className="w-full text-lg">Play Again</Button>
                    </CardFooter>
                )}
                {gameMode !== 'online' && (isDraw && !winner) && (
                    <CardFooter>
                        <Button onClick={() => handleRestart(true)} className="w-full text-lg">Play Again</Button>
                    </CardFooter>
                )}
            </Card>
        </>
    );
}
