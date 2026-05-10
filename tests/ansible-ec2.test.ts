import assert from 'node:assert/strict';
import test from 'node:test';

import { redactOutput } from '../cli/drivers/ansible-ec2.ts';

test('redactOutput masks common secret patterns from Molecule output', () => {
  const output = [
    'aws_access_key_id=AKIAIOSFODNN7EXAMPLE',
    'aws_secret_access_key=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    'password: hunter2',
    'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret',
    '-----BEGIN OPENSSH PRIVATE KEY-----',
    'b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAA=',
    '-----END OPENSSH PRIVATE KEY-----',
  ].join('\n');

  const redacted = redactOutput(output);

  assert.equal(redacted.includes('AKIAIOSFODNN7EXAMPLE'), false);
  assert.equal(redacted.includes('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'), false);
  assert.equal(redacted.includes('hunter2'), false);
  assert.equal(redacted.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret'), false);
  assert.equal(redacted.includes('b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAA='), false);
  assert.match(redacted, /\[REDACTED_AWS_ACCESS_KEY_ID\]/);
  assert.match(redacted, /aws_secret_access_key=\[REDACTED\]/);
  assert.match(redacted, /password: \[REDACTED\]/);
  assert.match(redacted, /Authorization: Bearer \[REDACTED\]/);
  assert.match(redacted, /\[REDACTED_PRIVATE_KEY\]/);
});
