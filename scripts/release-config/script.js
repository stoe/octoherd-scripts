import {composeCreatePullRequest} from 'octokit-plugin-create-pull-request'
import {readFileSync} from 'fs'
import {resolve} from 'path'

import {Octokit} from '@octoherd/cli'
import {createAppAuth} from '@octokit/auth-app'

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
        // read key and convert to base64
        const key = readFileSync(privateKey)

        // authenticate the app
        const app = new Octokit({
          authStrategy: createAppAuth,
          auth: {
            appId,
            privateKey: key,
          },
        })

        // https://docs.github.com/en/rest/apps/apps#get-a-repository-installation-for-the-authenticated-app
        const {
          data: {id: installation_id},
        } = await app.request('GET /repos/{owner}/{repo}/installation', {
          owner,
          repo,
        })

        // https://docs.github.com/en/rest/reference/apps#create-an-installation-access-token-for-an-app
        const {
          data: {token: appToken},
        } = await app.request('POST /app/installations/{installation_id}/access_tokens', {
          installation_id,
        })

        ok = new Octokit({
          auth: appToken,
        })

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
