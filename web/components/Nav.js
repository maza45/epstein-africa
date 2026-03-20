import Link from "next/link";

export default function Nav() {
  return (
    <nav className="site-nav">
      <Link href="/">Emails</Link>
      <Link href="/people">Persons</Link>
      <Link href="/stories">Stories</Link>
      <Link href="/graph">Graph</Link>
      <Link href="/about">About</Link>
    </nav>
  );
}
