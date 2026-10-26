import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudTestConfig } from './lib/cloud-target.mjs';
import { deploymentOptions, validateProjectLink } from './lib/deployment-target.mjs';

const env = {
  GLUCOSE_RUN_CLOUD_TESTS: '1', SUPABASE_URL: 'https://test-project.example.com',
  SUPABASE_ANON_KEY: 'synthetic-public-key', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-admin-key',
  GLUCOSE_EXPECTED_SUPABASE_URL: 'https://test-project.example.com/',
};

test('cloud-write checks require independent target confirmation and explicit opt-in', () => {
  assert.equal(cloudTestConfig(env).url, 'https://test-project.example.com');
  for (const invalid of [
    { ...env, GLUCOSE_RUN_CLOUD_TESTS: '0' }, { ...env, GLUCOSE_EXPECTED_SUPABASE_URL: '' },
    { ...env, SUPABASE_URL: 'https://different-project.example.com' },
    { ...env, SUPABASE_URL: 'https://user:password@test-project.example.com' },
    { ...env, SUPABASE_URL: 'http://test-project.example.com' },
  ]) {
    assert.throws(() => cloudTestConfig(invalid), error => !error.message.includes(env.SUPABASE_SERVICE_ROLE_KEY));
  }
});

test('deployments support custom project names while preserving linked-project checks', () => {
  assert.equal(deploymentOptions([], {}).projectName, 'glucose-app');
  const options = deploymentOptions(['--project-name', 'community-journal', '--dry-run', '--prod'], {});
  assert.deepEqual(options, { projectName: 'community-journal', dryRun: true, target: 'production' });
  assert.equal(deploymentOptions([], { GLUCOSE_VERCEL_PROJECT_NAME: 'own-journal' }).projectName, 'own-journal');
  const link = { projectName: 'community-journal', projectId: `prj_${'a'.repeat(20)}`, orgId: `team_${'b'.repeat(20)}` };
  assert.deepEqual(validateProjectLink(link, options.projectName), { projectId: link.projectId, orgId: link.orgId });
  assert.throws(() => validateProjectLink(link, 'another-app'));
  assert.throws(() => validateProjectLink({ ...link, projectId: 'invalid' }, options.projectName));
  for (const args of [['--project-name'], ['--unknown'], ['--prod', '--prod'], ['--project-name', '../another-app']]) {
    assert.throws(() => deploymentOptions(args, {}));
  }
});
