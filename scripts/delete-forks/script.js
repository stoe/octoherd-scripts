/**
 * @param {import('@octoherd/cli').Octokit}     octokit
 * @param {import('@octoherd/cli').Repository}  repository
 * @param {object}                              options
 * @param { {dryRun: boolean} }                 [options.dryRun=false]
 */
export async function script(octokit, repository, {dryRun = false}) {
  const {
    fork,
    name: repo,
    owner: {login: owner},
    clone_url: url,
  } = repository

  // skip normal repositories
  if (!fork) return

  try {
    // https://docs.github.com/en/rest/reference/repos#delete-a-repository
    if (!dryRun) {
      await octokit.request('DELETE /repos/{owner}/{repo}', {
        owner,
        repo,
      })
    }
  } catch (error) {
    octokit.log.error(`  ❌ ${error.message}`)
    return
  }

  octokit.log.info({deleted: true && !dryRun, 'dry-run': dryRun, url}, `  🗑️ deleted`)
  return
}
