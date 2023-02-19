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
  const lang = language ? language.toLowerCase() : null

  let path = null
  switch (lang) {
    case 'c':
    case 'cpp':
    case 'csharp':
    case 'go':
    case 'kotlin':
    case 'java':
      path = resolve(__dirname, `./codeql.compiled.yml`)
      break
    case 'javascript':
    case 'python':
    case 'ruby':
    case 'typescript':
      path = resolve(__dirname, `./codeql.yml`)
      break
    default:
      break
  }

  if (!path || !lang) {
    octokit.log.info({skipped: true, lang}, `  🙈 no supported language found`)
    return
  }

  let langReplace = lang

  // use 'cpp' also for C
  if (lang === 'c') langReplace = 'cpp'

  // use 'java' also for Kotlin
  if (lang === 'kotlin') langReplace = 'java'

  // use 'javascript' also for TypeScript
  if (lang === 'typescript') langReplace = 'javascript'

  if (lang !== langReplace) octokit.log.info({lang, replace: langReplace}, `  ❎ replace language`)

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

    const newContentBuffer = readFileSync(path)
    const newContentStr = Buffer.from(newContentBuffer, 'base64').toString('utf-8')
    const newContent = newContentStr.replace('__LANGUAGE__', langReplace)

    const options = {
      owner,
      repo,
      title: '🤖 Update CodeQL GitHub Action workflow',
      head: 'octoherd-script/codeql',
      base: default_branch,
      body: 'This pull request updates the CodeQL GitHub Action workflow',
      createWhenEmpty: false,
      changes: [
        {
          files: {
            '.github/workflows/codeql.yml': newContent,
          },
          commit: `🤖 Update .github/workflows/codeql.yml`,
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
      } = await ok.request('GET /repos/{owner}/{repo}/contents/{path}', {
        owner,
        repo,
        path: '.github/workflows/codeql.yml',
      })

      existingContent = Buffer.from(existingContentBase64, 'base64').toString('utf-8')
    } catch (error) {
      create = true
    }

    if (newContent === existingContent) {
      octokit.log.info({change: false}, `  🙊 no changes`)
    } else {
      if (create) {
        options.title = '✨ Create CodeQL GitHub Action workflow'
        options.body = `- ✨ Create .github/workflows/codeql.yml`
        options.changes[0].commit = `✨ Create .github/workflows/codeql.yml`
      }

      if (dryRun) {
        const {title, base, head, changes} = options
        octokit.log.info({lang, title, base, head, changes}, `  🐢 dry-run`)
      } else {
        const {
          data: {html_url},
        } = await composeCreatePullRequest(ok, options)

        octokit.log.info({change: true, lang}, `  📦 pull request created ${html_url}`)
      }
    }
  } catch (error) {
    octokit.log.error({error}, `  ❌ ${error.message}`)
    return
  }

  octokit.log.info(`  ✅ ${url}`)
  return
}
