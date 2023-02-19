import {appAuth} from '@stoe/octoherd-script-common'

/**
 * @param {import('@octoherd/cli').Octokit}     octokit
 * @param {import('@octoherd/cli').Repository}  repository
 * @param {object}                              options
 * @param {int}                                 [options.appId=0]
 * @param {string}                              [options.privateKey='']
 * @param {boolean}                             [options.dryRun=false]
 */
export async function script(octokit, repository, {appId = 0, privateKey = '', dryRun = false}) {
  const {
    fork,
    name: repo,
    owner: {login: owner},
    clone_url: url,
  } = repository

  // skip normal repositories
  if (!fork) return

  try {
    let ok = octokit
    if (appId && privateKey) {
      try {
        ok = await appAuth(repository, appId, privateKey)

        octokit.log.info(`  🤖 authenticated as app`)
      } catch (error) {
        octokit.log.info({error}, `  ❌ failed to authenticate as app`)
        return
      }
    }

    // https://docs.github.com/en/rest/reference/repos#delete-a-repository
    if (!dryRun) {
      await ok.request('DELETE /repos/{owner}/{repo}', {
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
