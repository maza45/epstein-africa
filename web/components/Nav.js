import Link from "next/link";
import { useRouter } from "next/router";
import { DEFAULT_LOCALE, NAV_LABELS, getLocalizedPath, normalizeLocale, stripLocalePrefix } from "../lib/i18n";

const LINKS = [
  { href: "/", key: "home" },
  { href: "/stories", key: "stories" },
  { href: "/archive", key: "archive" },
  { href: "/people", key: "people" },
  { href: "/graph", key: "graph" },
  { href: "/map", key: "map" },
  { href: "/about", key: "about" },
];

export default function Nav({ pagePath, frAvailable = false }) {
  const router = useRouter();
  const locale = normalizeLocale(router.locale);
  const labels = NAV_LABELS[locale];
  const currentPath = pagePath || stripLocalePrefix(router.asPath.split("#")[0].split("?")[0] || "/");
  const switcherLabel = locale === "fr" ? "Sélecteur de langue" : "Language switcher";

  return (
    <nav className="site-nav">
      <div className="site-nav-links">
        {LINKS.map(({ href, key }) => {
        const active =
          href === "/"
            ? router.pathname === "/"
            : router.pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            locale={locale}
            className={active ? "nav-active" : undefined}
          >
            {labels[key]}
          </Link>
        );
        })}
      </div>
      <div className="lang-switch" aria-label={switcherLabel}>
        <Link
          href={getLocalizedPath(currentPath, DEFAULT_LOCALE)}
          locale={false}
          className={locale === "en" ? "lang-link nav-active" : "lang-link"}
        >
          EN
        </Link>
        {frAvailable ? (
          <Link
            href={getLocalizedPath(currentPath, "fr")}
            locale={false}
            className={locale === "fr" ? "lang-link nav-active" : "lang-link"}
          >
            FR
          </Link>
        ) : (
          <span className="lang-link lang-disabled" aria-disabled="true">
            FR
          </span>
        )}
      </div>
    </nav>
  );
}
