import { useEffect, useState } from "react";
import { hederaAccountId, hashscanAddr, shortAddr } from "../lib/memegraph";

/**
 * Shows an account the Hedera-native way: the 0.0.x account id, resolved
 * from the EVM address (instantly for long-zero addresses, via mirror node
 * for aliases). Falls back to the shortened EVM form while resolving.
 */
export default function CreatorId({
  addr,
  link = true,
}: {
  addr: string;
  link?: boolean;
}) {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setId(null);
    hederaAccountId(addr)
      .then((v) => alive && setId(v))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [addr]);

  const label = id ?? shortAddr(addr);
  if (!link) return <>{label}</>;
  return (
    <a href={hashscanAddr(addr)} target="_blank" rel="noreferrer">
      {label}
    </a>
  );
}
