import Link from 'next/link';
import Image from 'next/image';

export default function SiteHeader() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="site-header">
        <div className="container nav-shell">
          <Link href="/" className="brand" aria-label="Prowl Infra Hub home">
            <Image src="/assets/brand/mascot.png" alt="" width={34} height={34} />
            <span>Prowl Infra Hub</span>
          </Link>

          <nav className="primary-nav" aria-label="Primary">
            <Link href="/browse">Browse playbooks</Link>
            <Link href="/#submit">Submit playbook</Link>
            <Link href="/#quality">Quality and safety</Link>
          </nav>
        </div>
      </header>
    </>
  );
}
