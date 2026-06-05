import Image from 'next/image';
import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-shell">
        <div className="footer-brand">
          <div className="footer-brand-head">
            <Image src="/assets/brand/mascot.png" alt="" width={36} height={36} />
            <div>
              <span className="footer-brand-name">Prowl Infra Hub</span>
              <p>Community infrastructure automation library for Prowl.</p>
              <p>Only verified playbooks are listed in this catalog.</p>
            </div>
          </div>

          <div className="footer-social">
            <a
              href="https://x.com/prowlqa"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow Prowl on X"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href="https://github.com/prowl-tools/prowl-infra-hub"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Prowl Infra Hub on GitHub"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </a>
            <a href="mailto:info@prowl.tools" aria-label="Email Prowl">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </a>
          </div>
        </div>

        <nav className="footer-nav" aria-label="Footer">
          <div className="footer-col">
            <h4>Hub</h4>
            <ul>
              <li>
                <Link href="/browse">Browse playbooks</Link>
              </li>
              <li>
                <Link href="/#submit">Submit playbook</Link>
              </li>
              <li>
                <Link href="/#quality">Quality and safety</Link>
              </li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Product</h4>
            <ul>
              <li>
                <a href="https://docs.prowl.tools" target="_blank" rel="noopener noreferrer">
                  Docs
                </a>
              </li>
              <li>
                <a href="https://docs.prowl.tools/getting-started" target="_blank" rel="noopener noreferrer">
                  Getting started
                </a>
              </li>
              <li>
                <a
                  href="https://www.npmjs.com/package/prowl-infra"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  npm
                </a>
              </li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Community</h4>
            <ul>
              <li>
                <a href="https://prowl.tools" target="_blank" rel="noopener noreferrer">
                  Main site
                </a>
              </li>
              <li>
                <a href="https://hub.prowl.tools" target="_blank" rel="noopener noreferrer">
                  Prowl Hub
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/prowl-tools/prowl-infra-hub"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </div>
        </nav>
      </div>

      <div className="container footer-legal">
        <p>&copy; {new Date().getFullYear()} Genkei Labs</p>
      </div>
    </footer>
  );
}
