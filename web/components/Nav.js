import Link from "next/link";
import { useRouter } from "next/router";

const LINKS = [
  { href: "/", label: "Emails" },
  { href: "/people", label: "Persons" },
  { href: "/stories", label: "Stories" },
  { href: "/graph", label: "Graph" },
  { href: "/about", label: "About" },
];

export default function Nav() {
  const router = useRouter();

  return (
    <nav className="site-nav">
      {LINKS.map(({ href, label }) => {
        const active =
          href === "/"
            ? router.pathname === "/"
            : router.pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={active ? "nav-active" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
