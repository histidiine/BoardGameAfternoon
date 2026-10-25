"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, Px } from "@/components/Icons";

const ITEMS = [
  { href: "/", label: "The shelf", icon: <Icon name="shelf" /> },
  { href: "/favorites", label: "My favorites", icon: <Px name="heart" on /> },
  { href: "/next", label: "Next table", icon: <Px name="star" on /> },
  { href: "/past", label: "Past tables", icon: <Icon name="ticket" /> },
];

function isCurrent(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/games");
  return pathname === href || pathname.startsWith(href + "/");
}

export function Nav({ admin, variant }: { admin: boolean; variant: "top" | "tabs" }) {
  const pathname = usePathname();
  const items = variant === "top" && admin ? [...ITEMS, { href: "/admin", label: "Admin", icon: <Icon name="key" /> }] : ITEMS;
  return (
    <nav className={variant === "top" ? "nav" : "tabbar"} aria-label="Main">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={isCurrent(pathname, i.href) ? "page" : undefined}>
          {i.icon}
          <span>{i.label}</span>
        </Link>
      ))}
    </nav>
  );
}
