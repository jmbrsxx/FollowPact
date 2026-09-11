import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export default function PolicyShell({ label, title, intro, children }: { label: string; title: string; intro: string; children: ReactNode }) {
  return <><header className="policy-header"><div className="shell"><Link className="brand" href="/"><Image src="/followpact-logo.png" alt="" width={30} height={30} /><span>FollowPact</span></Link><Link className="back-link" href="/">← Back to the product</Link></div></header><main className="policy-main"><p className="eyebrow">{label}</p><h1>{title}</h1><p className="policy-intro">{intro}</p>{children}</main></>;
}
