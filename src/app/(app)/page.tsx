"use client";

import dynamic from 'next/dynamic';

const TicTacToeGame = dynamic(() => import('@/components/tic-tac-toe'), { ssr: false });

export default function GamePage() {
  return (
    <main className="flex flex-col items-center justify-center">
      <div className="w-full max-w-md">
        <TicTacToeGame />
      </div>
    </main>
  );
}
