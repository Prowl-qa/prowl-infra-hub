/**
 * Featured playbooks are now driven by the `is_featured` column in the database.
 * Use `getFeaturedPlaybooks()` from `@/lib/db/queries` instead of this list.
 *
 * This file is kept for backward compatibility with any imports that reference it.
 */
export const FEATURED_PLAYBOOK_IDS = [
  'patching/rolling-os-update.yml',
  'security/ssh-hardening.yml',
  'monitoring/install-node-exporter.yml',
  'provisioning/aws-vpc-setup.yml',
  'containers/k8s-namespace-setup.yml',
  'backup/database-backup-s3.yml',
];
