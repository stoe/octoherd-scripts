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
    name: repo,
    owner: {login: owner},
    size,
    clone_url: url,
  } = repository

  // skip archived, disabled, forked and empty repos
  if (archived || disabled || fork || size === 0) return

  try {
    let ok = octokit
    if (appId && privateKey) {
      ok = await appAuth(repository, appId, privateKey)

      octokit.log.info(`  🤖 authenticated as app`)
    }

    // https://docs.github.com/en/rest/reference/repos#get-repository-content
    const {data: paths} = await ok.request('GET /repos/{owner}/{repo}/contents/{path}', {
      owner,
      repo,
      path: '.github/workflows',
    })

    const actionsMap = new Map()

    for (const file of paths) {
      const {data} = await ok.request('GET /repos/{owner}/{repo}/contents/{path}', {
        owner,
        repo,
        path: file.path,
      })

      const content = Buffer.from(data.content, 'base64').toString('utf-8')

      // extract action and version
      const _actions = content.match(/uses: (?<action>\S+)@(?<version>\S+)/gi)

      actionsMap.set(file.path, {content, actions: _actions.map(a => a.split(': ')[1])})
    }

    const changes = new Map()
    let hasChanges = false

    for (const [path, tmp] of actionsMap) {
      let content = tmp.content

      for await (const action of tmp.actions) {
        const [name, version] = action.split('@')
        const [actionOwner, actionRepo] = name.split('/')

        // skip if version is a SHA
        if (version.length === 40 || version.length === 64) {
          octokit.log.info({change: false}, `  👍 ${action} is already a SHA`)
          continue
        }

        // skip if internal action
        if (name.startsWith('./')) {
          octokit.log.info({change: false}, `  🙈 ${action} is an internal action`)
          continue
        }

        // skip if reusable workflow
        if (name.endsWith('.yml') || name.endsWith('.yaml')) {
          octokit.log.info({change: false}, `  🙈 ${action} is a reusable workflow`)
          continue
        }

        try {
          // https://docs.github.com/en/rest/releases/releases#get-the-latest-release
          const {data: release} = await ok.request('GET /repos/{owner}/{repo}/releases/latest', {
            owner: actionOwner,
            repo: actionRepo,
          })

          // get sha of the latest release tag
          const {
            data: {
              object: {sha},
            },
          } = await ok.request('GET /repos/{owner}/{repo}/git/ref/tags/{ref}', {
            owner: actionOwner,
            repo: actionRepo,
            ref: release.tag_name,
          })

          // replace action version with sha
          const replace = `${name}@${sha}`
          content = content.replace(action, replace)

          hasChanges = true
        } catch (error) {
          octokit.log.info({change: false}, `  🙈 no release found for ${action}`)
          continue
        }
      }

      if (hasChanges) changes.set(path, content)
    }

    const options = {
      owner,
      repo,
      title: '🆙 actions: Change action versions to SHAs',
      head: 'octoherd-script/workflow-action-shas',
      base: default_branch,
      body: 'This pull request updates workflows with the latest release SHAs',
      createWhenEmpty: false,
    }
    const files = Object.fromEntries(changes)

    if (dryRun) {
      octokit.log.info({change: false, files: Object.keys(files)}, `  🐢 dry-run`)
      return
    }

    const PR = {
      ...options,
      changes: [
        {
          files,
          commit: `🤖 actions: Change action versions to SHAs`,
          emptyCommit: false,
        },
      ],
    }

    // open a pull request to replace action version with latest realease sha
    const {data: pr} = await composeCreatePullRequest(ok, PR)

    octokit.log.info({change: true, pr: pr.html_url}, `  🤖 pull request created`)
  } catch (error) {
    octokit.log.info({change: false}, `  ✅ no workflows need changing `)
    return
  }

  octokit.log.info(`  ✅ ${url}`)
  return
}
