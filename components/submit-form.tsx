'use client';

import { FormEvent, useState } from 'react';

const GITHUB_NEW_FILE_URL = 'https://github.com/Prowl-qa/prowl-infra-hub/new/main';

type SubmitState = {
  kind: 'success' | 'error';
  message: string;
} | null;

const PLAYBOOK_CATEGORY_OPTIONS = [
  { value: 'patching', label: 'Patching' },
  { value: 'provisioning', label: 'Provisioning' },
  { value: 'security', label: 'Security' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'containers', label: 'Containers' },
  { value: 'networking', label: 'Networking' },
  { value: 'backup', label: 'Backup' },
  { value: 'configuration', label: 'Configuration' },
  { value: 'ci-cd', label: 'CI/CD' },
] as const;

const ALLOWED_PLAYBOOK_CATEGORIES = new Set<string>(PLAYBOOK_CATEGORY_OPTIONS.map((option) => option.value));

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function SubmitForm() {
  const [submitState, setSubmitState] = useState<SubmitState>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    if (!form.checkValidity()) {
      form.reportValidity();
      setSubmitState({
        kind: 'error',
        message: 'Complete all required fields before opening a pull request.',
      });
      return;
    }

    const formData = new FormData(form);
    const playbookName = String(formData.get('name') ?? '');
    const playbookDescription = String(formData.get('description') ?? '');
    const playbookCategory = String(formData.get('category') ?? '');
    const playbookYaml = String(formData.get('yaml') ?? '');

    const playbookSlug = slugify(playbookName);
    if (!playbookSlug) {
      setSubmitState({ kind: 'error', message: 'Playbook name must include letters or numbers.' });
      return;
    }

    const validatedCategory = playbookCategory.trim();
    if (!ALLOWED_PLAYBOOK_CATEGORIES.has(validatedCategory)) {
      setSubmitState({
        kind: 'error',
        message: 'Invalid category; choose a supported category.',
      });
      return;
    }

    const suggestedFilePath = `${validatedCategory}/${playbookSlug}.yml`;
    const commitMessage = `feat(playbook): add ${playbookSlug} template`;

    const params = new URLSearchParams({
      filename: suggestedFilePath,
      value: playbookYaml,
      message: commitMessage,
      description: `Add verified community playbook template: ${playbookDescription}`,
    });

    window.open(`${GITHUB_NEW_FILE_URL}?${params.toString()}`, '_blank', 'noopener,noreferrer');

    setSubmitState({
      kind: 'success',
      message:
        'GitHub opened. Commit this file on a branch and create a PR. It will appear in the Hub only after approval and merge.',
    });
    form.reset();
  }

  return (
    <section id="submit" className="submit container">
      <div className="section-head">
        <div>
          <p className="eyebrow">Contribute</p>
          <h2>Submit a playbook through pull request</h2>
        </div>
        <p>
          Submission opens GitHub with a prefilled playbook file. Only merged PRs are published,
          which keeps the live catalog verified-only.
        </p>
      </div>

      <form className="submit-form" onSubmit={handleSubmit} noValidate>
        <label>
          Playbook name
          <input name="name" required placeholder="ex: rolling-os-update" />
        </label>

        <label>
          Category
          <select name="category" required>
            <option value="">Select category</option>
            {PLAYBOOK_CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Short description
          <input name="description" required placeholder="What does this playbook automate?" />
        </label>

        <label>
          Playbook YAML
          <textarea
            name="yaml"
            rows={10}
            required
            placeholder="Paste your playbook YAML here..."
          ></textarea>
        </label>

        <fieldset>
          <legend>Required before PR</legend>
          <label>
            <input type="checkbox" required /> Uses generic variables (no hardcoded hosts or credentials)
          </label>
          <label>
            <input type="checkbox" required /> Contains no secrets, API keys, or private IPs
          </label>
          <label>
            <input type="checkbox" required /> Includes comments and customization notes
          </label>
          <label>
            <input type="checkbox" required /> Destructive operations are guarded with conditions
          </label>
        </fieldset>

        <button className="button button-primary" type="submit">
          Open Pull Request Flow
        </button>

        <p className={`submit-message ${submitState?.kind === 'error' ? 'is-error' : ''}`} aria-live="polite">
          {submitState?.message ?? ''}
        </p>
      </form>
    </section>
  );
}
