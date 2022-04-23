const octoherd = require('@octoherd/cli')

const token = process.env.GITHUB_TOKEN
const {Octokit} = require('@octokit/rest')
const octokit = new Octokit({
  auth: token
})

const {resolve} = require('path')
const {logger} = require('./scripts/helpers')

;(async () => {
  const data = await octokit.paginate('GET /user/repos', {
    visibility: 'all',
    affiliation: 'owner',
    sort: 'full_name'
  })

  let repos = []

  data.map(repository => {
    if (!repository.archived && !repository.disabled && !repository.fork) {
      repos.push(repository.full_name)
    }
  })

  logger.log({
    level: 'debug',
    message: `found ${repos.length} repositories`
  })

  try {
    // add your scripts to run here...

    /**
     * example
     *
     * await octoherd({
     *   token,
     *   script: resolve(process.env.PWD, 'scripts/repo-settings/script.js'),
     *   repos,
     *   cache: false,
     *   signature: true
     * })
     */

     logger.info('done')
  } catch (err) {
    logger.error(err)
  }
})()
