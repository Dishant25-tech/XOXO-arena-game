import TicTacToeGame from "@/components/tic-tac-toe";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 md:p-8">
      <TicTacToeGame />
    </main>
  );
}
