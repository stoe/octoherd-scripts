/**
 * @param {import('@octoherd/cli').Octokit}     octokit
 * @param {import('@octoherd/cli').Repository}  repository
 * @param {object}                              options
 * @param { {dryRun: boolean} }                 [options.dryRun=false]
 */
export async function script(octokit, repository, options = {dryRun: false}) {
  if (repository.archived) return
  if (repository.fork) return

  // eslint-disable-next-line no-console
  console.log({repository, options})
}
