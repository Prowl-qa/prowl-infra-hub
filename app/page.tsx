import Image from 'next/image';
import Link from 'next/link';

import PlaybookCard from '@/components/playbook-card';
import SubmitForm from '@/components/submit-form';
import { FEATURED_PLAYBOOK_IDS } from '@/lib/featured';
import { getPublishedPlaybookSummaries, type PlaybookSummary } from '@/lib/playbooks';
import { fetchStatsFromService } from '@/lib/stats-client';

async function fetchFeaturedPlaybooks(allPlaybooks: PlaybookSummary[]): Promise<PlaybookSummary[]> {
  try {
    const { getFeaturedPlaybooks } = await import('@/lib/db/queries');
    const featured = await getFeaturedPlaybooks();
    if (featured.length > 0) return featured;
  } catch {
    // DB unavailable — fall back to hardcoded list
  }
  return FEATURED_PLAYBOOK_IDS
    .map((id) => allPlaybooks.find((p) => p.filePath === id))
    .filter((p): p is PlaybookSummary => p != null);
}

// TODO(PQIH-022): re-enable Total downloads metric once Beelink stats are
// scoped per-hub. The Beelink counter is currently global, so prowl-hub and
// prowl-infra-hub both surface the same number. Function is kept here for
// quick re-enable when scoping lands.
async function fetchTotalDownloads(): Promise<string> {
  const result = await fetchStatsFromService({
    timeoutMs: 3000,
    revalidate: 300,
  });
  if (!result.ok) {
    return '-';
  }

  const data = result.data as { totals?: { allTime?: unknown } };
  const count = Number(data?.totals?.allTime);
  if (!Number.isFinite(count)) {
    return '-';
  }

  return count.toLocaleString('en-US');
}

void fetchTotalDownloads;

export default async function HomePage() {
  const playbooks = await getPublishedPlaybookSummaries();

  const featuredPlaybooks = await fetchFeaturedPlaybooks(playbooks);

  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <p className="eyebrow">Community infrastructure patterns</p>
          <h1>Find and share reusable infrastructure automation playbooks.</h1>
          <p className="lede">
            Prowl Infra Hub publishes only verified templates. Contributors submit playbooks through pull
            requests, and templates become visible only after maintainer approval.
          </p>
          <div className="hero-actions">
            <Link href="/browse" className="button button-primary">
              Explore verified playbooks
            </Link>
            <a href="#submit" className="button button-ghost">
              Submit through PR
            </a>
          </div>
        </div>

        <aside className="hero-code" aria-label="Example playbook code">
          <div className="code-head">
            <span>ssh-hardening.yml</span>
            <span className="tag">verified</span>
          </div>
          <pre>
            <code>{`name: ssh-hardening
tool: ansible
risk_level: medium
playbook: |
  - hosts: "{{ inventory_group }}"
    become: true
    tasks:
      - name: Disable root login
        lineinfile:
          path: /etc/ssh/sshd_config
          regexp: "^PermitRootLogin"
          line: "PermitRootLogin no"`}
            </code>
          </pre>
          <p className="code-note">Curated Ansible playbooks, ready for your infrastructure.</p>
          <Image
            src="/assets/brand/mascot-hero.png"
            alt=""
            width={150}
            height={150}
            className="hero-mascot"
            aria-hidden="true"
          />
        </aside>
      </section>

      <section className="metrics container" aria-label="Catalog statistics">
        <article>
          <p>{playbooks.length}</p>
          <span>Verified playbooks</span>
        </article>
        <article>
          <p>{new Set(playbooks.map((p) => p.category)).size}</p>
          <span>Categories covered</span>
        </article>
        {/* Total downloads metric temporarily hidden — see PQIH-022. */}
      </section>

      <section className="featured container">
        <div className="section-head">
          <div>
            <p className="eyebrow">Featured</p>
            <h2>Curated community playbooks</h2>
          </div>
          <p>
            Hand-picked templates spanning security, provisioning, monitoring, and more.
            Each one is verified and ready to adapt for your infrastructure.
          </p>
        </div>

        <div className="featured-grid">
          {featuredPlaybooks.map((playbook) => (
            <PlaybookCard key={playbook.id} playbook={playbook} showTags={false} />
          ))}
        </div>

        <div className="featured-cta">
          <Link href="/browse" className="button button-primary">
            Browse all {playbooks.length} verified playbooks
          </Link>
        </div>
      </section>

      <SubmitForm />

      <section id="quality" className="quality container">
        <article>
          <h3>Verified-only publishing</h3>
          <p>Templates become visible only after PR review and maintainer merge.</p>
        </article>
        <article>
          <h3>Security review</h3>
          <p>Checks flag dangerous commands, credential patterns, hardcoded IPs, and injection attempts.</p>
        </article>
        <article>
          <h3>Risk-level classification</h3>
          <p>Every playbook is tagged with a risk level so teams can assess impact before deployment.</p>
        </article>
      </section>
    </>
  );
}
