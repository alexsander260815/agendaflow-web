import { ShieldOff } from "lucide-react";

export default function AcessoRestrito() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 p-10 text-center">
      <ShieldOff size={32} className="text-muted" />
      <p className="font-medium">Acesso restrito</p>
      <p className="text-sm text-muted">Essa área é exclusiva do proprietário do salão.</p>
    </div>
  );
}
