import {appAuth} from '@stoe/octoherd-script-common'
import {setTimeout} from 'timers/promises'

/**
 * @param {import('@octoherd/cli').Octokit}    octokit
 * @param {import('@octoherd/cli').Repository} repository
 * @param {object}                             options
 * @param {string}                             [options.excludes='']
 * @param {int}                                [options.appId=0]
 * @param {string}                             [options.privateKey='']
 * @param {boolean}                            [options.dryRun=false]
 */
export async function script(octokit, repository, {excludes = '', appId = 0, privateKey = '', dryRun = false}) {
  const {
    name: repo,
    owner: {login: owner},
    clone_url: url,
  } = repository

  // skip excluded repos
  const exclude = excludes.split(',').map(s => s.trim())
  if (exclude.includes(repo)) {
    octokit.log.info(`  🙈 ${owner}/${repo} excluded, skipping`)
    return
  }

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

    if (dryRun) {
      octokit.log.info({delete: false, url}, `  🐢 ${owner}/${repo} would be deleted`)
      return
    }

    // https://docs.github.com/en/rest/reference/repos#delete-a-repository
    await ok.request('DELETE /repos/{owner}/{repo}', {
      owner,
      repo,
    })

    octokit.log.info(`  🧹 ${owner}/${repo} deleted`)

    // sleep 1 second
    await setTimeout(1000)
  } catch (error) {
    octokit.log.info(
      {delete: false, url, error: error.message, status: error.status},
      `  ❌ ${owner}/${repo} not deleted`,
    )
  }
}
