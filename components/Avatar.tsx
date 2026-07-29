import { corAvatar, iniciais } from "@/lib/avatar";

interface AvatarProps {
  nome: string;
  fotoUrl?: string | null;
  className?: string;
  textClassName?: string;
  shape?: "circle" | "square";
}

export default function Avatar({
  nome,
  fotoUrl,
  className = "h-10 w-10 text-sm",
  textClassName,
  shape = "circle",
}: AvatarProps) {
  const arredondamento = shape === "square" ? "rounded-2xl" : "rounded-full";

  if (fotoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fotoUrl}
        alt={nome}
        className={`shrink-0 object-cover ${arredondamento} ${className}`}
      />
    );
  }

  const avatar = corAvatar(nome);
  return (
    <div
      className={`flex shrink-0 items-center justify-center font-semibold ${arredondamento} ${textClassName ?? ""} ${className}`}
      style={{ background: avatar.bg, color: avatar.fg }}
    >
      {iniciais(nome)}
    </div>
  );
}
