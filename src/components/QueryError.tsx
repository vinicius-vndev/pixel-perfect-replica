import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="space-y-3 py-4">
      <p className="text-destructive">Não foi possível carregar os dados. Verifique sua conexão e tente novamente.</p>
      <Button variant="outline" onClick={onRetry}><RefreshCw /> Tentar novamente</Button>
    </div>
  );
}