import {appAuth} from '@stoe/octoherd-script-common'
import {composeCreatePullRequest} from 'octokit-plugin-create-pull-request'

/**
 * @param {import('@octoherd/cli').Octokit}    octokit
 * @param {import('@octoherd/cli').Repository} repository
 * @param {object}                             options
 * @param {int}                                [options.appId=0]
 * @param {string}                             [options.privateKey='']
 * @param {boolean}                            [options.dryRun=false]
 */
export async function script(octokit, repository, {appId = 0, privateKey = '', dryRun = false}) {
  const {
    archived,
    default_branch,
    disabled,
    fork,
    language,
    name: repo,
    owner: {login: owner},
    size,
    clone_url: url,
  } = repository

  // skip archived, disabled, forked and empty repos
  if (archived || disabled || fork || size === 0) return

  // skip non JavaScript repos
  const lang = language ? language.toLowerCase() : undefined
  if (lang !== 'javascript') {
    octokit.log.info({change: false, lang}, `  🙈 not a JavaScript repository`)
    return
  }

  let newContent = ''

  // skip repostories without action.yml
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

    // https://docs.github.com/en/rest/reference/repos#get-repository-content
    const {data} = await ok.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner,
      repo,
      path: 'action.yml',
    })

    const options = {
      owner,
      repo,
      title: 'Update node version',
      head: 'octoherd-script/action-node-version',
      base: default_branch,
      body: 'This pull request updates the node version to node16',
      createWhenEmpty: false,
    }

    if (data && data.name === 'action.yml') {
      const content = Buffer.from(data.content, 'base64').toString('utf-8')

      if (content.includes("using: 'node12'")) {
        octokit.log.warn({url}, `  🪄 needs to be updated from node12 to node16`)

        newContent = content.replace("using: 'node12'", "using: 'node16'")

        const PR = {
          ...options,
          changes: [
            {
              files: {
                'action.yml': newContent,
              },
              commit: `🤖 Update node version to node16`,
              emptyCommit: false,
            },
          ],
        }

        if (dryRun) return
        // open a pull request to replace node12 with node16
        const {data: pr} = await composeCreatePullRequest(ok, PR)

        octokit.log.info({change: true}, `  🤖 pull request created ${pr.html_url}`)
      } else if (content.includes("using: 'node14'")) {
        octokit.log.warn({url}, `  🪄 needs to be updated from node14 to node16`)

        newContent = content.replace("using: 'node14'", "using: 'node16'")

        const PR = {
          ...options,
          changes: [
            {
              files: {
                'action.yml': newContent,
              },
              commit: `🤖 Update node version to node16`,
              emptyCommit: false,
            },
          ],
        }

        if (dryRun) return
        // open a pull request to replace node14 with node16
        const {data: pr} = await composeCreatePullRequest(ok, PR)

        octokit.log.info({change: true}, `  🤖 pull request created ${pr.html_url}`)
      } else if (content.includes("using: 'node16'")) {
        octokit.log.info({url}, `  👍 already using node16`)
        return
      }
    }
  } catch (error) {
    octokit.log.info({change: false, url}, `  🙈 not a GitHub Actions repository`)
    return
  }

  octokit.log.info(`  ✅ ${url}`)
  return
}
