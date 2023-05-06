import {appAuth} from '@stoe/octoherd-script-common'
import {setTimeout} from 'timers/promises'

/**
 * @param {import('@octoherd/cli').Octokit}     octokit
 * @param {import('@octoherd/cli').Repository}  repository
 * @param {object}                              [options]
 * @param {int}                                 [options.appId=0]
 * @param {string}                              [options.privateKey='']
 * @param {boolean}                             [options.dryRun=false]
 */
export async function script(octokit, repository, {appId = 0, privateKey = '', dryRun = false}) {
  const {
    archived,
    disabled,
    fork,
    size,
    owner: {login: owner},
    name: repo,
    node_id: repoID,
    clone_url: url,
  } = repository

  // skip archived, disabled, forked and empty repos
  if (archived || disabled || fork || size === 0) return

  const language = repository.language ? repository.language.toLowerCase() : null

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

  // branch protection
  const {
    repository: {
      owner: {id: ownerID, type: ownerType},
      branchProtectionRules: {nodes: rules},
    },
  } = await ok.graphql(getBranchProtectionQuery, {owner, repo})

  let actors = []
  if (ownerType === 'User') {
    actors = [ownerID]
  }

  try {
    // determine if branch protection needs to be created or updated
    const create = rules.length === 0
    const update = rules.length > 0

    if (!create && !update) {
      octokit.log.info({skipped: true}, `  🙊 branch protection`)
    } else {
      const statusCheckContext = []
      if (language === 'javascript') {
        statusCheckContext.push('test / test-matrix (16)')
        statusCheckContext.push('test / test')
      }

      const branchProtection = {
        repo: repoID,
        statusCheckContext,
        actors,
      }

      // create
      if (create) {
        if (dryRun) {
          octokit.log.info(
            {checks: true, language, statusCheckContext: branchProtection.statusCheckContext},
            `  🐢 dry-run create branch protection`,
          )
        } else {
          await ok.graphql(createBranchProtectionQuery, branchProtection)

          octokit.log.info(
            {checks: true, language, statusCheckContext: branchProtection.statusCheckContext},
            `  🔒 create branch protection`,
          )
        }
      }

      // update
      if (update) {
        for (const rule of rules) {
          const {pattern, id} = rule

          branchProtection.pattern = pattern
          branchProtection.branchProtectionRuleId = id

          if (['main', 'master'].includes(pattern)) {
            if (dryRun) {
              octokit.log.info(
                {checks: true, pattern, language, statusCheckContext: branchProtection.statusCheckContext},
                `  🐢 dry-run update branch protection`,
              )
            } else {
              await ok.graphql(updateBranchProtectionQuery, branchProtection)

              octokit.log.info(
                {checks: true, pattern, language, statusCheckContext: branchProtection.statusCheckContext},
                `  🔒 update branch protection`,
              )
            }
          } else {
            octokit.log.info(
              {skipped: true, pattern, language, statusCheckContext: branchProtection.statusCheckContext},
              `  🙊 branch protection`,
            )
            continue
          }
        }
      }
    }
  } catch (error) {
    octokit.log.error({error: error.message}, `  ❌ branch protection`)
  }

  // sleep 1 second
  await setTimeout(1000)

  // tags
  try {
    // enable tag protection if not already enabled
    // https://docs.github.com/en/rest/repos/tags#list-tag-protection-states-for-a-repository
    const {data} = await ok.request('GET /repos/{owner}/{repo}/tags/protection', {
      owner,
      repo,
    })

    if (data.length < 1 || data.every(d => d.pattern !== 'v*.*.*')) {
      const tagPattern = 'v*.*.*'

      if (dryRun) {
        octokit.log.info({checks: true}, `  🐢 dry-run tag protection ${tagPattern}`)
      } else {
        // https://docs.github.com/en/rest/repos/tags#create-a-tag-protection-state-for-a-repository
        await ok.request('POST /repos/{owner}/{repo}/tags/protection', {
          owner,
          repo,
          pattern: tagPattern,
        })

        octokit.log.info({checks: true}, `  🔒 tag protection ${tagPattern}`)
      }
    } else {
      octokit.log.info({skipped: true, patterns: data.map(d => d.pattern)}, `  🙊 tag protection`)
    }
  } catch (error) {
    octokit.log.error({error: error.message}, `  ❌ tag protection`)
  }

  // sleep 1 second
  await setTimeout(1000)

  // settings
  // https://docs.github.com/en/rest/reference/repos#update-a-repository
  const config = {
    owner,
    repo,
    name: repo,
    has_issues: true,
    has_projects: false,
    has_wiki: false,
    allow_squash_merge: true,
    allow_merge_commit: false,
    allow_rebase_merge: false,
    allow_auto_merge: true,
    delete_branch_on_merge: true,
    security_and_analysis: {
      secret_scanning: {
        status: 'enabled',
      },
      secret_scanning_push_protection: {
        status: 'enabled',
      },
    },
    squash_merge_commit_title: 'PR_TITLE',
    squash_merge_commit_message: 'BLANK',
  }

  try {
    if (dryRun) {
      octokit.log.info({updated: true}, `  🐢 dry-run vulnerability alerts`)
    } else {
      // https://docs.github.com/en/rest/reference/repos#enable-vulnerability-alerts
      await ok.request('PUT /repos/{owner}/{repo}/vulnerability-alerts', {
        owner,
        repo,
      })

      octokit.log.info({updated: true}, `  🔐 automated security fixes`)

      // sleep 1 second
      await setTimeout(1000)
    }

    if (dryRun) {
      octokit.log.info({updated: true}, `  🐢 dry-run automated security fixes`)
    } else {
      // https://docs.github.com/en/rest/reference/repos#enable-automated-security-fixes
      await ok.request('PUT /repos/{owner}/{repo}/automated-security-fixes', {
        owner,
        repo,
      })

      octokit.log.info({updated: true}, `  🔐 vulnerability alerts`)

      // sleep 1 second
      await setTimeout(1000)
    }

    if (config.security_and_analysis.secret_scanning && repository.visibility === 'public') {
      // Secret Scanning is enabled on public repositories
      delete config.security_and_analysis.secret_scanning

      octokit.log.info({skipped: true, visibility: repository.visibility, type: ownerType}, `  🙊 secret scanning`)
    }

    if (
      (config.security_and_analysis.secret_scanning || config.security_and_analysis.secret_scanning_push_protection) &&
      ownerType === 'User'
    ) {
      // Secret Scanning can only be set on organization owned repositories
      delete config.security_and_analysis.secret_scanning
      delete config.security_and_analysis.secret_scanning_push_protection

      octokit.log.info(
        {skipped: true, visibility: repository.visibility, type: ownerType},
        `  🙊 secret scanning push protection`,
      )
    }

    if (Object.keys(config.security_and_analysis).length === 0) {
      delete config.security_and_analysis
    } else {
      if (config.security_and_analysis.secret_scanning) {
        octokit.log.info({updated: true, visibility: repository.visibility, type: ownerType}, `  🔐 secret scanning`)
      }

      if (config.security_and_analysis.secret_scanning_push_protection) {
        octokit.log.info(
          {updated: true, visibility: repository.visibility, type: ownerType},
          `  🔐 secret scanning push protection`,
        )
      }
    }

    if (dryRun) {
      const c = {}
      for (const [key, value] of Object.entries(config)) {
        if (!['owner', 'repo', 'name'].includes(key)) {
          c[key] = value
        }
      }

      octokit.log.info(
        {
          updated: true,
          config: c,
        },
        `  🐢 dry-run repository settings`,
      )
    } else {
      await ok.request('PATCH /repos/{owner}/{repo}', config)

      octokit.log.info({updated: true}, `  🔧 repository settings`)

      // sleep 1 second
      await setTimeout(1000)
    }
  } catch (error) {
    octokit.log.warn({error: error.message}, `  ❌ repository settings, retrying without secret scanning`)

    if (error.message === 'Secret scanning can only be enabled on repos where Advanced Security is enabled') {
      delete config.security_and_analysis.secret_scanning
      await ok.request('PATCH /repos/{owner}/{repo}', config)

      octokit.log.info({updated: true}, `  🔧 repository settings`)
    }
  }

  // sleep 1 second
  await setTimeout(1000)

  // actions settings
  const actionsConfig = {
    owner,
    repo,
    default_workflow_permissions: 'read',
    // can_approve_pull_request_reviews: true,
  }

  if (dryRun) {
    octokit.log.info({updated: true, config: actionsConfig}, `  🐢 dry-run actions settings`)
  } else {
    try {
      // https://docs.github.com/en/rest/actions/permissions#set-default-workflow-permissions-for-a-repository
      await ok.request('PUT /repos/{owner}/{repo}/actions/permissions/workflow', actionsConfig)

      octokit.log.info({updated: true}, `  🔧 actions settings`)
    } catch (error) {
      octokit.log.warn({error: error.message}, `  ❌ actions settings`)
    }
  }

  // done
  octokit.log.info(`  ✅ ${url}`)
  return true
}

const getBranchProtectionQuery = `query(
  $owner: String!,
  $repo: String!
) {
  repository(
    owner: $owner,
    name: $repo
  ) {
    owner {
      id
      type: __typename
    }
    branchProtectionRules(first: 5) {
      nodes {
        id
        pattern
        requiredStatusChecks {
          context
        }
      }
    }
  }
}`

// https://docs.github.com/en/graphql/reference/input-objects#createbranchprotectionruleinput
const createBranchProtectionQuery = `mutation(
  $repo: ID!,
  $statusCheckContext: [String!] = [],
  $actors: [ID!] = []
) {
  createBranchProtectionRule(input: {
    clientMutationId: "@stoe/octoherd-script-repo-settings"
    repositoryId: $repo
    pattern: "main"

    requiresApprovingReviews: true
    requiredApprovingReviewCount: 0
    requiresCodeOwnerReviews: true
    restrictsReviewDismissals: false
    requireLastPushApproval: true

    requiresStatusChecks: true
    requiresStrictStatusChecks: true
    requiredStatusCheckContexts: $statusCheckContext

    requiresConversationResolution: true

    requiresCommitSignatures: true

    requiresLinearHistory: true

    restrictsPushes: false

    isAdminEnforced: false

    allowsForcePushes: false
    bypassForcePushActorIds: $actors
    bypassPullRequestActorIds: $actors

    allowsDeletions: false
  }) {
    clientMutationId
  }
}`

// https://docs.github.com/en/graphql/reference/mutations#updatebranchprotectionrule
const updateBranchProtectionQuery = `mutation(
  $branchProtectionRuleId: ID!
  $pattern: String = "main",
  $statusCheckContext: [String!] = [],
  $actors: [ID!] = []
) {
  updateBranchProtectionRule(input: {
    clientMutationId: "@stoe/octoherd-script-repo-settings"
    branchProtectionRuleId: $branchProtectionRuleId

    pattern: $pattern

    requiresApprovingReviews: true
    requiredApprovingReviewCount: 0
    requiresCodeOwnerReviews: true
    restrictsReviewDismissals: false
    requireLastPushApproval: true

    requiresStatusChecks: true
    requiresStrictStatusChecks: true
    requiredStatusCheckContexts: $statusCheckContext

    requiresConversationResolution: true

    requiresCommitSignatures: true

    requiresLinearHistory: true

    restrictsPushes: false

    isAdminEnforced: false

    allowsForcePushes: false
    bypassForcePushActorIds: $actors
    bypassPullRequestActorIds: $actors

    allowsDeletions: false
  }) {
    clientMutationId
  }
}`
