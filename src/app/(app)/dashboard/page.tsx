"use client";

import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    const gameRecordsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return collection(firestore, `users/${user.uid}/game_records`);
    }, [user, firestore]);

    const { data: gameRecords, isLoading } = useCollection(gameRecordsQuery);

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Here are your recent game records.</p>
            
            <Card>
                <CardHeader>
                    <CardTitle>Game History</CardTitle>
                    <CardDescription>A log of all your player vs. player games.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Opponent</TableHead>
                                <TableHead>Result</TableHead>
                                <TableHead>Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center">Loading game records...</TableCell>
                                </TableRow>
                            )}
                            {!isLoading && gameRecords?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center">No games played yet. Go play a PvP match!</TableCell>
                                </TableRow>
                            )}
                            {gameRecords?.map((record) => (
                                <TableRow key={record.id}>
                                    <TableCell>{record.player2Id === 'player2' ? "Player 2" : record.player2Id}</TableCell>
                                    <TableCell>
                                        {record.winnerId === null ? (
                                            <Badge variant="secondary">Draw</Badge>
                                        ) : record.winnerId === user?.uid ? (
                                            <Badge variant="default">Win</Badge>
                                        ) : (
                                            <Badge variant="destructive">Loss</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {new Date(record.timestamp).toLocaleDateString()}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

        </div>
    );
}
