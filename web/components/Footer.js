export default function Footer() {
  return (
    <footer className="site-footer">
      <p>
        Public interest journalism. Free, ad-free, open source.
      </p>
      <div className="footer-links">
        <a href="https://github.com/Iskanenani/epstein-africa" target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a href="/rss.xml">RSS</a>
        <a href="/api/export?format=csv">Download CSV</a>
      </div>
    </footer>
  );
}
