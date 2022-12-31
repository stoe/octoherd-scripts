/**
 * @param {import('@octoherd/cli').Octokit}     octokit
 * @param {import('@octoherd/cli').Repository}  repository
 */
export async function script(octokit, repository) {
  if (repository.archived || repository.fork) return

  const {
    archived,
    disabled,
    fork,
    size,
    owner: {login: owner},
    name: repo,
    node_id: repoID,
    clone_url,
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
      await octokit.graphql(createBranchProtectionQuery, {
        repo: repoID,
        actors,
      })

      octokit.log.info({updated: true, checks: true, language}, `  branch protection`)
    } else {
      for (const rule of rules) {
        const {pattern, id, requiredStatusChecks} = rule

        if (requiredStatusChecks.length === 0) {
          await octokit.graphql(updateBranchProtectionNoChecksQuery, {
            branchProtectionRuleId: id,
            pattern,
            actors,
          })
          octokit.log.info({updated: true, checks: false, pattern, language}, `  branch protection`)
          continue
        }

        if (['main', 'master'].includes(pattern)) {
          await octokit.graphql(updateBranchProtectionQuery, {
            branchProtectionRuleId: id,
            pattern,
            actors,
          })

          octokit.log.info({updated: true, checks: true, pattern, language}, `  branch protection`)
        } else {
          octokit.log.info({skipped: true, pattern}, `  branch protection`)
        }
      }
    }
  } catch (error) {
    octokit.log.warn({error: error.message}, `  branch protection`)
  }

  // settings
  try {
    // https://docs.github.com/en/rest/reference/repos#enable-vulnerability-alerts
    await octokit.request('PUT /repos/{owner}/{repo}/vulnerability-alerts', {
      owner,
      repo,
    })

    // https://docs.github.com/en/rest/reference/repos#enable-automated-security-fixes
    await octokit.request('PUT /repos/{owner}/{repo}/automated-security-fixes', {
      owner,
      repo,
    })

    // https://docs.github.com/en/rest/reference/repos#update-a-repository
    const config = {
      owner,
      repo,
      name: repo,
      has_issues: 'yes',
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

    if (config.security_and_analysis.secret_scanning && repository.private === false) {
      // Secret Scanning is enabled on public repositories
      delete config.security_and_analysis.secret_scanning
    }

    if (config.security_and_analysis.secret_scanning && ownerType === 'User') {
      // Secret Scanning can only be set on organization owned repositories
      delete config.security_and_analysis.secret_scanning
      delete config.security_and_analysis.secret_scanning_push_protection
    }

    if (Object.keys(config.security_and_analysis).length === 0) {
      delete config.security_and_analysis
    }

    await octokit.request('PATCH /repos/{owner}/{repo}', config)

    octokit.log.info({updated: true}, `  settings`)
  } catch (error) {
    octokit.log.warn({error: error.message}, `  settings`)
  }


  octokit.log.info(`  ${clone_url}`)
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
    requiredStatusCheckContexts: ["test / test", "test / test-matrix (16)"]

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
    requiredStatusCheckContexts: ["test / test", "test / test-matrix (16)"]

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
