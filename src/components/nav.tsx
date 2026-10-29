import Link from "next/link";

const ITEMS = [
  { href: "/", label: "Home" },
  { href: "/pm", label: "AI Program Manager", badge: true },
  { href: "/startups", label: "Startups" },
  { href: "/mentors", label: "Mentors" },
];

function Links({ badge }: { badge: number }) {
  return (
    <ul className="flex flex-col gap-1">
      {ITEMS.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted"
          >
            <span>{item.label}</span>
            {item.badge && badge > 0 ? (
              <span
                data-testid="pm-badge"
                className="rounded-full bg-[var(--signal)] px-2 py-0.5 text-xs font-semibold text-white"
              >
                {badge}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Nav({ badge, productName }: { badge: number; productName: string }) {
  return (
    <>
      <nav aria-label="Main" className="hidden w-60 shrink-0 border-r bg-muted/30 p-4 md:block">
        <p className="mb-6 px-3 font-mono text-lg font-semibold">
          {productName}
          <span className="text-[var(--signal)]">/</span>
        </p>
        <Links badge={badge} />
      </nav>
      <details className="border-b px-4 py-3 md:hidden">
        <summary className="cursor-pointer font-mono font-semibold">
          {productName}
          <span className="text-[var(--signal)]">/</span> menu{badge > 0 ? ` (${badge})` : ""}
        </summary>
        <div className="mt-2">
          <Links badge={badge} />
        </div>
      </details>
    </>
  );
}
