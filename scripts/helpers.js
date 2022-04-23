const winston = require('winston')

/**
 * Logger helper
 */
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console({
      level: 'debug',
      format: winston.format.combine(winston.format.colorize(), winston.format.simple())
    }),
    new winston.transports.File({filename: 'logs/error.log', level: 'error'}),
    new winston.transports.File({filename: 'logs/combined.log'})
  ],
  exceptionHandlers: [new winston.transports.File({filename: 'logs/exceptions.log'})],
  exitOnError: false
})

/**
 * @param {import('@octokit/openapi-types').components["schemas"]["repository"]} repository
 * @returns {boolean} Is it an empty repository?
 */
const isRepoEmpty = async (octokit, repository) => {
  // https://docs.github.com/rest/reference/repos#list-commits
  const commits = await octokit
    .request('GET /repos/{owner}/{repo}/commits', {
      owner: repository.owner.login,
      repo: repository.name,
      sha: repository.default_branch,
      per_page: 1,
      page: 1
    })
    .then(
      response => response.data.length,
      error => 0
    )

  return commits === 0
}

/**
 * @param {import('@octokit/openapi-types').components["schemas"]["repository"]} repository
 * @returns {string|undefined} Skip repository for this reason
 */
const skipRepoReason = repository => {
  if (repository.archived) return 'archived'

  if (repository.disabled) return 'disabled'

  if (repository.fork) return 'a fork'

  return undefined
}

module.exports = {
  isRepoEmpty,
  logger,
  skipRepoReason
}
