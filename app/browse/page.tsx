import type { Metadata } from 'next';
import { Suspense } from 'react';

import BrowseShell from '@/components/browse-shell';
import { getPublishedPlaybookSummaries } from '@/lib/playbooks';

export const metadata: Metadata = {
  title: 'Browse Playbooks | Prowl Infra Hub',
  description: 'Search, filter, and download verified community infrastructure automation playbooks.',
};

export default async function BrowsePage() {
  const playbooks = await getPublishedPlaybookSummaries();

  return (
    <section className="browse-page container" aria-label="Browse playbooks">
      <div className="section-head">
        <div>
          <p className="eyebrow">Library</p>
          <h2>Browse verified community playbooks</h2>
        </div>
        <p>
          Every card below is verified and safe to adapt. Use filters, inspect raw YAML, and
          download directly for your infrastructure.
        </p>
      </div>

      <Suspense fallback={<p className="results-count">Loading playbooks...</p>}>
        <BrowseShell playbooks={playbooks} />
      </Suspense>
    </section>
  );
}
