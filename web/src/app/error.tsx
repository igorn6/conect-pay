"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-950 text-white p-6 text-center z-[9999] absolute top-0 left-0">
      <h2 className="text-2xl font-bold text-red-500 mb-4">Ops! Ocorreu um erro no sistema</h2>
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg max-w-2xl font-mono text-sm break-all mb-6 text-left overflow-auto max-h-[50vh]">
        <strong>Erro:</strong> {error.message || "Erro desconhecido"}
        <br/><br/>
        <strong>Stack:</strong><br/>
        {error.stack}
      </div>
      <button
        onClick={() => reset()}
        className="px-6 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors"
      >
        Tentar novamente
      </button>
    </div>
  );
}
