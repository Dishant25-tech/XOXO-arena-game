"use client";

import dynamic from 'next/dynamic';

const TicTacToeGame = dynamic(() => import('@/components/tic-tac-toe'), { ssr: false });

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 md:p-8">
      <div className="w-full max-w-md">
        <TicTacToeGame />
      </div>
    </main>
  );
}
