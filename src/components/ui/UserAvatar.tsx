import { useState } from "react";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function UserAvatar({
  name,
  image,
  size = 24,
}: {
  name: string;
  image?: string | null;
  size?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const fontSize = Math.round(size * 0.42);

  return (
    <span
      className="flex items-center justify-center rounded-full overflow-hidden flex-shrink-0"
      style={{ width: size, height: size, background: "var(--border)" }}
      title={name}
    >
      {image && !imgFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span
          style={{
            fontSize,
            fontWeight: 500,
            color: "var(--text-muted)",
            lineHeight: 1,
          }}
        >
          {initials(name)}
        </span>
      )}
    </span>
  );
}
