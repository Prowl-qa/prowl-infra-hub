import type { PlaybookSummary } from '@/lib/playbooks';
import { toDisplayDate } from '@/lib/format';

interface PlaybookCardProps {
  playbook: PlaybookSummary;
  showTags?: boolean;
  onPreview?: (playbook: PlaybookSummary) => void | Promise<void>;
  onPreviewError?: (error: unknown, playbook: PlaybookSummary) => void;
}

export default function PlaybookCard({ playbook, showTags = true, onPreview, onPreviewError }: PlaybookCardProps) {
  const tags = (playbook.tags || []).filter((tag) => tag.trim().length > 0 && !tag.trim().startsWith('#'));

  return (
    <article className="playbook-card">
      <div className="badge-row">
        {playbook.isVerified && <span className="verified-badge">Verified</span>}
        {playbook.tested ? (
          <span className="meta-pill meta-pill-tested">Execution Tested</span>
        ) : (
          <span className="meta-pill meta-pill-validated">Schema Validated</span>
        )}
      </div>
      <h3>{playbook.title}</h3>
      <p>{playbook.description || 'Reusable infrastructure automation template.'}</p>

      <div className="meta-row">
        <span className="meta-pill meta-pill-tool">{playbook.tool}</span>
        <span className={`meta-pill meta-pill-risk-${playbook.riskLevel}`}>{playbook.riskLevel} risk</span>
        {playbook.cloudProvider !== 'agnostic' && (
          <span className="meta-pill meta-pill-cloud">{playbook.cloudProvider}</span>
        )}
        {playbook.isNew && <span className="meta-pill meta-pill-new">New</span>}
      </div>

      <div className="meta-row">
        <span className="meta-pill">{playbook.categoryLabel}</span>
        <span className="meta-pill">{playbook.taskCount} tasks</span>
        {playbook.osFamily !== 'agnostic' && (
          <span className="meta-pill">{playbook.osFamily}</span>
        )}
        <span className="meta-pill">Updated {toDisplayDate(playbook.updatedAt)}</span>
      </div>

      {showTags && tags.length > 0 && (
        <div className="meta-row">
          {tags.map((tag) => (
            <span key={tag} className="meta-pill meta-pill-tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      {playbook.complianceTags.length > 0 && (
        <div className="meta-row">
          {playbook.complianceTags.map((tag) => (
            <span key={tag} className="meta-pill meta-pill-tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      {playbook.testedOn.length > 0 && (
        <div className="meta-row">
          <span className="meta-pill meta-pill-tested-on">
            Tested on: {playbook.testedOn.map((t) => `${t.os} ${t.arch}`).join(', ')}
          </span>
        </div>
      )}

      <div className="playbook-actions">
        {onPreview && (
          <button
            type="button"
            className="button button-ghost"
            onClick={async () => {
              try {
                await onPreview(playbook);
              } catch (error) {
                onPreviewError?.(error, playbook);
              }
            }}
          >
            Preview YAML
          </button>
        )}
        <a
          className="button button-primary"
          href={`/api/playbooks/file?path=${encodeURIComponent(playbook.filePath)}`}
          download={playbook.filePath.split('/').pop() || 'playbook.yml'}
        >
          Download
        </a>
      </div>
    </article>
  );
}
