import {appAuth} from '@stoe/octoherd-script-common'
import {composeCreatePullRequest} from 'octokit-plugin-create-pull-request'
import {readFileSync} from 'fs'
import {resolve} from 'path'

/**
 * @param {import('@octoherd/cli').Octokit} octokit
 * @param {import('@octoherd/cli').Repository} repository
 * @param {object} options
 * @param {int}     [options.appId=0]
 * @param {string}  [options.privateKey='']
 * @param {boolean} [options.dryRun=false]
 */
export async function script(octokit, repository, {appId = 0, privateKey = '', dryRun = false}) {
  const {
    archived,
    default_branch,
    disabled,
    fork,
    language,
    size,
    name: repo,
    owner: {login: owner},
    clone_url: url,
  } = repository

  // skip archived, disabled, forked and empty repos
  if (archived || disabled || fork || size === 0) return

  // skip non JavaScript, Golang repos
  const lang = language ? language.toLowerCase() : undefined
  if (lang !== 'javascript' && lang !== 'go') return

  try {
    const content = readFileSync(resolve(`./release.default.yml`))
    const contentBuffer = Buffer.from(content, 'base64').toString('utf-8')

    const options = {
      owner,
      repo,
      title: '🤖 Update release notes config',
      head: 'octoherd-script/release-config',
      base: default_branch,
      body: `This pull request updates the release notes config

ℹ️ https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes#configuring-automatically-generated-release-notes`,
      createWhenEmpty: false,
      changes: [
        {
          files: {
            '.github/release.yml': contentBuffer,
          },
          commit: `🤖 Update .github/release.yml`,
          emptyCommit: false,
        },
      ],
      update: true,
    }

    let create = false
    let existingContent
    try {
      // https://docs.github.com/en/rest/reference/repos#get-repository-content
      const {
        data: {content: existingContentBase64},
      } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
        owner,
        repo,
        path: '.github/release.yml',
      })

      existingContent = Buffer.from(existingContentBase64, 'base64').toString('utf-8')
    } catch (error) {
      create = true
    }

    if (contentBuffer.toString('utf-8') === existingContent) {
      octokit.log.info({change: false}, `  🙊 no changes`)
    } else {
      let ok = octokit
      if (appId && privateKey) {
        ok = await appAuth(repository, appId, privateKey)

        octokit.log.info(`  🤖 authenticated as app`)
      }

      if (create) {
        options.title = '✨ Create release notes config'
        // eslint-disable-next-line i18n-text/no-en
        options.body = `This pull request creates the release notes config

  ℹ️ https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes#configuring-automatically-generated-release-notes`
        options.changes[0].commit = `✨ Create .github/release.yml`
      }

      if (dryRun) {
        octokit.log.info({...options}, `  🐢 dry-run`)
      } else {
        const {
          data: {html_url},
        } = await composeCreatePullRequest(ok, options)

        octokit.log.info({change: true}, `  📦 pull request created ${html_url}`)
      }
    }
  } catch (error) {
    octokit.log.error({error}, `  ❌ ${error.message}`)
    return
  }

  octokit.log.info(`  ✅ ${url}`)
  return
}
