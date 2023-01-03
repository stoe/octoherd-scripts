import {appAuth} from '@stoe/octoherd-script-common'
import {composeCreatePullRequest} from 'octokit-plugin-create-pull-request'
import {readFileSync} from 'fs'
import {resolve} from 'path'

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

  let configPath = undefined
  switch (lang) {
    case 'javascript':
    case 'go':
      configPath = resolve(process.env.PWD, `./dependabot.${lang}.yml`)
      break
    case 'hcl':
      configPath = resolve(process.env.PWD, `./dependabot.terraform.yml`)
      break
    default:
      configPath = resolve(process.env.PWD, `./dependabot.default.yml`)
      break
  }

  try {
    let ok = octokit

    const newContentBuffer = readFileSync(configPath)
    const newContent = Buffer.from(newContentBuffer, 'base64').toString('utf-8')

    const options = {
      owner,
      repo,
      title: '🤖 Update @dependabot config',
      head: 'octoherd-script/dependabot-config',
      base: default_branch,
      body: 'This pull request updates the @dependabot config',
      createWhenEmpty: false,
      changes: [
        {
          files: {
            '.github/dependabot.yml': newContent,
          },
          commit: `🤖 Update .github/dependabot.yml`,
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
        path: '.github/dependabot.yml',
      })

      existingContent = Buffer.from(existingContentBase64, 'base64').toString('utf-8')
    } catch (error) {
      create = true
    }

    if (newContent === existingContent) {
      octokit.log.info({change: false}, `  🙊 no changes`)
    } else {
      if (create) {
        options.title = '✨ Create @dependabot config'
        options.body = `- ✨ Create .github/dependabot.yml`
        options.changes[0].commit = `✨ Create .github/dependabot.yml`
      }

      if (dryRun) {
        const {title, base, head, changes} = options
        octokit.log.info({title, base, head, changes}, `  🐢 dry-run`)
      } else {
        options.body += `

> **Note**
> [Configure dependabot.yml](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file)`

        if (appId && privateKey) {
          ok = await appAuth(repository, appId, privateKey)

          octokit.log.info(`  🤖 authenticated as app`)
        }

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
