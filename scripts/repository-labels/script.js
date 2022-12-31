import defaultLabels from './labels.js'
import {readFileSync} from 'fs'
import {setTimeout} from 'timers/promises'

/**
 * @param {import('@octoherd/cli').Octokit}     octokit
 * @param {import('@octoherd/cli').Repository}  repository
 * @param {object}                              options
 * @param { {defaults: boolean} }               [options.defaults=false]
 * @param { {path: boolean} }                   [options.path=null]
 * @param { {dryRun: template} }                [options.template=false]
 * @param { {dryRun: boolean} }                 [options.dryRun=false]
 */
export async function script(octokit, repository, {defaults = false, path = null, template = null, dryRun = false}) {
  // fail fast
  if (!defaults && !path && !template) {
    throw new Error(`Either --defaults, --path or --template must be defined`)
  }

  const {
    archived,
    disabled,
    fork,
    name: repo,
    owner: {login: owner},
    full_name,
    size,
    clone_url: url,
  } = repository

  // skip archived, disabled, forked and empty repos
  if (archived || disabled || fork || size === 0) return

  let wantLabels = []

  // use local default labels from './labels.js'
  if (defaults) {
    wantLabels = defaultLabels

    octokit.log.info({labels: wantLabels.map(l => l.name)}, `  🤖 loaded default labels`)
  }

  // read labels from provided JSON
  if (path) {
    const buff = readFileSync(path, 'utf-8')
    const str = buff.toString('utf-8')

    wantLabels = JSON.parse(str)

    octokit.log.info({path, labels: wantLabels.map(l => l.name)}, `  🤖 loaded labels from file`)
  }

  // load labels from another repo
  if (template) {
    if (template === full_name) {
      octokit.log.warn({template}, `  skipping self`)
      return
    }

    try {
      const [ownerSync, repoSync] = template.split('/')

      // https://docs.github.com/en/rest/reference/issues#list-labels-for-a-repository
      const {data} = await octokit.request('GET /repos/{owner}/{repo}/labels', {
        owner: ownerSync,
        repo: repoSync,
      })

      wantLabels = data.map(({name, description, color}) => {
        return {name, description, color}
      })

      octokit.log.info({template, labels: wantLabels.map(l => l.name)}, `  🤖 loaded labels from repository`)
    } catch (error) {
      octokit.log.error(`  ${error.message}`)
      return
    }
  }

  // current labels
  // https://docs.github.com/en/rest/reference/issues#list-labels-for-a-repository
  const {data} = await octokit.request('GET /repos/{owner}/{repo}/labels', {
    owner,
    repo,
    per_page: 100,
  })

  const currentLabels = data.map(({name, description, color}) => {
    return {name, description, color}
  })

  // labels to delete
  const deleteLabels = currentLabels.filter(have => {
    return !wantLabels.find(want => {
      return want.name === have.name
    })
  })

  for (const {name} of deleteLabels) {
    try {
      octokit.log.info({label: name}, `  🚮 deleting`)

      // https://docs.github.com/en/rest/reference/issues#delete-a-label
      if (!dryRun) {
        await octokit.request('DELETE /repos/{owner}/{repo}/labels/{name}', {owner, repo, name})

        // sleep 1.5 seconds
        await setTimeout(1500)
      }
    } catch (error) {
      octokit.log.error(`  ${name}: ${error.message}`)
    }
  }

  // labels to update
  const updateLabels = wantLabels.filter(want => {
    return currentLabels.find(have => want.name === have.name)
  })

  for (const {name, new_name, color, description} of updateLabels) {
    try {
      octokit.log.info({label: name}, `  🆙 updating`)

      // https://docs.github.com/en/rest/reference/issues#update-a-label
      if (!dryRun) {
        await octokit.request('PATCH /repos/{owner}/{repo}/labels/{name}', {
          owner,
          repo,
          name,
          new_name,
          color,
          description,
        })

        // sleep 1.5 seconds
        await setTimeout(1500)
      }
    } catch (error) {
      octokit.log.error(`  ${name}: ${error.message}`)
    }
  }

  // labels to create
  const createLabels = wantLabels.filter(want => {
    return !currentLabels.find(have => JSON.stringify(want) === JSON.stringify(have)) && !updateLabels.includes(want)
  })

  for (const {name, color, description} of createLabels) {
    try {
      octokit.log.info({label: name}, `  🆕 creating`)

      // https://docs.github.com/en/rest/reference/issues#create-a-label
      if (!dryRun) {
        await octokit.request('POST /repos/{owner}/{repo}/labels', {
          owner,
          repo,
          name,
          color,
          description,
        })

        // sleep 1.5 seconds
        await setTimeout(1500)
      }
    } catch (error) {
      octokit.log.error(`  ${name}: ${error.message}`)
    }
  }

  octokit.log.info(`  ✅ ${url}`)
  return
}
