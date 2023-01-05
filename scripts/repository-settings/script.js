import {setTimeout} from 'timers/promises'

/**
 * @param {import('@octoherd/cli').Octokit}     octokit
 * @param {import('@octoherd/cli').Repository}  repository
 * @param {object}                              [options]
 * @param {boolean}                             [options.dryRun=false]
 */
export async function script(octokit, repository, {dryRun = false}) {
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

  // branch protection
  const {
    repository: {
      owner: {id: ownerID, type: ownerType},
      branchProtectionRules: {nodes: rules},
    },
  } = await octokit.graphql(getBranchProtectionQuery, {owner, repo})

  let actors = []
  if (ownerType === 'User') {
    actors = [ownerID]
  }

  try {
    if (rules.length === 0 && language === 'javascript') {
      if (dryRun) {
        octokit.log.info({checks: true, language}, `  🐢 dry-run create branch protection (checks)`)
      } else {
        await octokit.graphql(createBranchProtectionQuery, {
          repo: repoID,
          actors,
        })

        octokit.log.info({updated: true, checks: true, language}, `  🔏 create branch protection (checks)`)
      }
    } else if (rules.length === 0 && language !== 'javascript') {
      if (dryRun) {
        octokit.log.info({checks: true, language}, `  🐢 dry-run create branch protection (checks)`)
      } else {
        await octokit.graphql(createBranchProtectionNoChecksQuery, {
          repo: repoID,
          actors,
        })

        octokit.log.info({updated: true, checks: true, language}, `  🔏 create branch protection (no checks)`)
      }
    } else {
      for (const rule of rules) {
        const {pattern, id, requiredStatusChecks} = rule

        if (requiredStatusChecks.length === 0) {
          if (dryRun) {
            octokit.log.info({checks: false, pattern, language}, `  🐢 dry-run update branch protection (no checks)`)
          } else {
            await octokit.graphql(updateBranchProtectionNoChecksQuery, {
              branchProtectionRuleId: id,
              pattern,
              actors,
            })

            octokit.log.info(
              {updated: true, checks: false, pattern, language},
              `  🔏 update branch protection (no checks)`,
            )
          }
          continue
        }

        if (['main', 'master'].includes(pattern)) {
          if (dryRun) {
            octokit.log.info({checks: true, pattern, language}, `  🐢 dry-run update branch protection (checks)`)
          } else {
            await octokit.graphql(updateBranchProtectionQuery, {
              branchProtectionRuleId: id,
              pattern,
              actors,
            })

            octokit.log.info({updated: true, checks: true, pattern, language}, `  🔏 update branch protection (checks)`)
          }
        } else {
          octokit.log.info({skipped: true, pattern}, `  🙊 branch protection`)
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
    const {data} = await octokit.request('GET /repos/{owner}/{repo}/tags/protection', {
      owner,
      repo,
    })

    if (data.length < 1 || data.every(d => d.pattern !== 'v*.*.*')) {
      const tagPattern = 'v*.*.*'

      if (dryRun) {
        octokit.log.info({checks: true}, `  🐢 dry-run tag protection ${tagPattern}`)
      } else {
        // https://docs.github.com/en/rest/repos/tags#create-a-tag-protection-state-for-a-repository
        await octokit.request('POST /repos/{owner}/{repo}/tags/protection', {
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
    squash_merge_commit_message: 'COMMIT_MESSAGES',
    squash_merge_commit_title: 'PR_TITLE',
  }

  try {
    if (dryRun) {
      octokit.log.info({updated: true}, `  🐢 dry-run vulnerability alerts`)
    } else {
      // https://docs.github.com/en/rest/reference/repos#enable-vulnerability-alerts
      await octokit.request('PUT /repos/{owner}/{repo}/vulnerability-alerts', {
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
      await octokit.request('PUT /repos/{owner}/{repo}/automated-security-fixes', {
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
        `  🐢 dry-run settings`,
      )
    } else {
      await octokit.request('PATCH /repos/{owner}/{repo}', config)

      octokit.log.info({updated: true}, `  🔧 settings`)

      // sleep 1 second
      await setTimeout(1000)
    }
  } catch (error) {
    octokit.log.warn({error: error.message}, `  ❌ settings, retrying without secret scanning`)

    if (error.message === 'Secret scanning can only be enabled on repos where Advanced Security is enabled') {
      delete config.security_and_analysis.secret_scanning
      await octokit.request('PATCH /repos/{owner}/{repo}', config)

      octokit.log.info({updated: true}, `  🔧 settings`)
    }
  }

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
    requiredStatusCheckContexts: ["Test / test", "Test / test-matrix (16)"]

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

// https://docs.github.com/en/graphql/reference/input-objects#createbranchprotectionruleinput
const createBranchProtectionNoChecksQuery = `mutation(
  $repo: ID!,
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

    requiresStatusChecks: false
    requiresStrictStatusChecks: false
    requiredStatusCheckContexts: []

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
    requiredStatusCheckContexts: ["Test / test", "Test / test-matrix (16)"]

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
const updateBranchProtectionNoChecksQuery = `mutation(
  $branchProtectionRuleId: ID!
  $pattern: String = "main",
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

    requiresStatusChecks: false
    requiresStrictStatusChecks: false
    requiredStatusCheckContexts: []

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
