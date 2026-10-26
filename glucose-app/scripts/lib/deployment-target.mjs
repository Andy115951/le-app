export function deploymentOptions(args, env = process.env) {
  let target = 'preview'; let dryRun = false;
  let projectName = env.GLUCOSE_VERCEL_PROJECT_NAME || 'glucose-app';
  const seen = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (seen.has(argument)) throw new Error('Repeated deployment argument.');
    seen.add(argument);
    if (argument === '--dry-run') dryRun = true;
    else if (argument === '--prod') target = 'production';
    else if (argument === '--project-name') {
      projectName = args[++index];
      if (!projectName || projectName.startsWith('--')) throw new Error('Provide a deployment project name.');
    } else throw new Error('Supported deployment options: --dry-run, --prod, --project-name <name>.');
  }
  if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(projectName)) throw new Error('Invalid deployment project name.');
  return { target, dryRun, projectName };
}

export function validateProjectLink(link, expectedName) {
  if (!link || link.projectName !== expectedName) throw new Error('The local Vercel link does not match the explicitly selected application.');
  if (typeof link.projectId !== 'string' || !/^prj_[A-Za-z0-9]{16,64}$/.test(link.projectId)) throw new Error('Invalid Vercel project ID.');
  if (typeof link.orgId !== 'string' || !/^(?:(?:team|user)_)?[A-Za-z0-9]{16,64}$/.test(link.orgId)) throw new Error('Invalid Vercel organization ID.');
  return { projectId: link.projectId, orgId: link.orgId };
}
