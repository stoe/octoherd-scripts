import {appAuth} from '@stoe/octoherd-script-common'
import {setTimeout} from 'timers/promises'

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
    name: repo,
    owner: {login: owner},
    clone_url: url,
  } = repository

  // skip non-archived repos
  if (!archived) return

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

    const {
      repository: {
        issues: {totalCount: issuesCount, nodes: issues},
        pullRequests: {totalCount: pullRequestsCount, nodes: pullRequests},
      },
    } = await ok.graphql(
      `query ($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    issues(first: 50, states: [OPEN]) {
      totalCount
      nodes {
        number
        title
        url
      }
    }
    pullRequests(first: 50, states: [OPEN]) {
      totalCount
      nodes {
        number
        title
        url
      }
    }
  }
}
`,
      {
        owner,
        repo,
      },
    )

    if (issuesCount || pullRequestsCount) {
      // unarchive repository
      if (!dryRun) {
        // https://docs.github.com/en/rest/repos/repos#update-a-repository
        await ok.request(`PATCH /repos/{owner}/{repo}`, {
          owner,
          repo,
          archived: false,
        })

        // sleep 1 second
        await setTimeout(1000)
      }

      // close all issues and pull requests
      for (const {number, title, url: i} of [...issues, ...pullRequests]) {
        if (dryRun) {
          octokit.log.info({title, url: i}, `  🐢 dry-run`)
        } else {
          // https://docs.github.com/en/rest/reference/issues#update-an-issue
          await ok.request(`PATCH /repos/{owner}/{repo}/issues/{issue_number}`, {
            owner,
            repo,
            issue_number: number,
            state: 'closed',
            state_reason: 'not_planned',
          })

          octokit.log.info({title, url: i}, `  🛑 closed as not planned`)

          // sleep 1 second
          await setTimeout(1000)
        }
      }

      // archive repository
      if (!dryRun) {
        // https://docs.github.com/en/rest/repos/repos#update-a-repository
        await ok.request(`PATCH /repos/{owner}/{repo}`, {
          owner,
          repo,
          archived: true,
        })

        // sleep 1 second
        await setTimeout(1000)
      }

      octokit.log.info(`  ✅ ${url}`)
      return
    }
  } catch (error) {
    octokit.log.error(`  ❌ ${error.message}`)
    return
  }
}
