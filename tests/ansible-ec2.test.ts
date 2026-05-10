import assert from 'node:assert/strict';
import test from 'node:test';

import { redactOutput } from '../cli/drivers/ansible-ec2.ts';

test('redactOutput masks common secret patterns from Molecule output', () => {
  const awsAccessKeyId = ['AKIA', 'IOSFODNN7EXAMPLE'].join('');
  const awsSecretAccessKey = ['wJalrXUtnFEMI/', 'K7MDENG/bPxRfiCY', 'EXAMPLEKEY'].join('');
  const password = ['hunt', 'er2'].join('');
  const bearerToken = ['eyJhbGciOiJIUzI1NiIs', 'InR5cCI6IkpXVCJ9', '.secret'].join('');
  const privateKeyBegin = ['-----BEGIN OPENSSH ', 'PRIVATE KEY-----'].join('');
  const privateKeyBody = ['b3BlbnNzaC1rZXkt', 'djEAAAAABG5vbmUAAAA='].join('');
  const privateKeyEnd = ['-----END OPENSSH ', 'PRIVATE KEY-----'].join('');
  const quotedPassword = ['hunt', 'er 2'].join('');
  const escapedQuotePassword = ['abc', '\\"', 'def'].join('');

  const output = [
    `aws_access_key_id=${awsAccessKeyId}`,
    `aws_secret_access_key=${awsSecretAccessKey}`,
    `password: ${password}`,
    `password: "${quotedPassword}"`,
    `password: "${escapedQuotePassword}"`,
    `Authorization: Bearer ${bearerToken}`,
    privateKeyBegin,
    privateKeyBody,
    privateKeyEnd,
  ].join('\n');

  const redacted = redactOutput(output);

  assert.equal(redacted.includes(awsAccessKeyId), false);
  assert.equal(redacted.includes(awsSecretAccessKey), false);
  assert.equal(redacted.includes(password), false);
  assert.equal(redacted.includes(quotedPassword), false);
  assert.equal(redacted.includes(escapedQuotePassword), false);
  assert.equal(redacted.includes(bearerToken), false);
  assert.equal(redacted.includes(privateKeyBody), false);
  assert.match(redacted, /\[REDACTED_AWS_ACCESS_KEY_ID\]/);
  assert.match(redacted, /aws_secret_access_key=\[REDACTED\]/);
  assert.equal(redacted.match(/password: \[REDACTED\]/g)?.length, 3);
  assert.match(redacted, /Authorization: Bearer \[REDACTED\]/);
  assert.match(redacted, /\[REDACTED_PRIVATE_KEY\]/);
});
