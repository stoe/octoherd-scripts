import {appAuth} from '@stoe/octoherd-script-common'
import {composeCreatePullRequest} from 'octokit-plugin-create-pull-request'
import {readFileSync} from 'fs'
import {dirname, resolve} from 'path'
import {fileURLToPath} from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

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

  let path = undefined
  switch (lang) {
    case 'javascript':
    case 'go':
      path = resolve(__dirname, `./dependabot.${lang}.yml`)
      break
    case 'hcl':
      path = resolve(__dirname, `./dependabot.terraform.yml`)
      break
    default:
      path = resolve(__dirname, `./dependabot.default.yml`)
      break
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

    const dependabotNewBuffer = readFileSync(path)
    const dependabotNewContent = Buffer.from(dependabotNewBuffer, 'base64').toString('utf-8')

    const combinePRsBuffer = readFileSync(resolve(__dirname, `./dependabot-combine-prs.yml`))
    const combineNewContent = Buffer.from(combinePRsBuffer, 'base64').toString('utf-8')

    const options = {
      owner,
      repo,
      title: '🤖 @dependabot config',
      head: 'octoherd-script/dependabot-config',
      base: default_branch,
      body: `## Summary
copilot:summary

## Details
copilot:walkthrough

---

> **Note**
> - [Configuration options for the dependabot.yml file](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file)
> - [GitHub Action to combine multiple PRs into a single one](https://github.com/github/combine-prs)
`,
      createWhenEmpty: false,
      changes: [
        {
          files: {
            '.github/dependabot.yml': dependabotNewContent,
          },
          commit: `🤖 Update .github/dependabot.yml`,
          emptyCommit: false,
        },
        {
          files: {
            '.github/workflows/dependabot-combine-prs.yml': combineNewContent,
          },
          commit: `🤖 Update .github/workflows/dependabot-combine-prs.yml`,
          emptyCommit: false,
        },
      ],
      update: true,
    }

    let dependabotUpdateContent
    let combineUpdateContent
    try {
      // https://docs.github.com/en/rest/reference/repos#get-repository-content
      const {
        data: {content: dependabotContentBase64},
      } = await ok.request('GET /repos/{owner}/{repo}/contents/{path}', {
        owner,
        repo,
        path: '.github/dependabot.yml',
      })

      dependabotUpdateContent = Buffer.from(dependabotContentBase64, 'base64').toString('utf-8')

      // https://docs.github.com/en/rest/reference/repos#get-repository-content
      const {
        data: {content: combineContentBase64},
      } = await ok.request('GET /repos/{owner}/{repo}/contents/{path}', {
        owner,
        repo,
        path: '.github/dependabot.yml',
      })

      combineUpdateContent = Buffer.from(combineContentBase64, 'base64').toString('utf-8')
    } catch (error) {
      // do nothing
    }

    if (dependabotNewContent === dependabotUpdateContent && combineNewContent === combineUpdateContent) {
      octokit.log.info({change: false}, `  🙊 no changes`)
    } else {
      if (dryRun) {
        const {title, base, head, changes} = options
        octokit.log.info({title, base, head, changes}, `  🐢 dry-run`)
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
