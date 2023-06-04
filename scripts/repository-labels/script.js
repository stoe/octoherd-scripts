import {appAuth} from '@stoe/octoherd-script-common'
import defaultLabels from './labels.js'
import {readFileSync} from 'fs'
import {setTimeout} from 'timers/promises'

/**
 * @param {import('@octoherd/cli').Octokit}    octokit
 * @param {import('@octoherd/cli').Repository} repository
 * @param {object}                             options
 * @param {boolean}                            [options.defaults=false]
 * @param {string}                             [options.path=null]
 * @param {boolean}                            [options.template=false]
 * @param {int}                                [options.appId=0]
 * @param {string}                             [options.privateKey='']
 * @param {boolean}                            [options.dryRun=false]
 */
export async function script(
  octokit,
  repository,
  {defaults = false, path = null, template = null, appId = 0, privateKey = '', dryRun = false},
) {
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
    clone_url: url,
  } = repository

  // skip archived, disabled, and forked repos
  if (archived || disabled || fork) return

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
        const {data} = await ok.request('GET /repos/{owner}/{repo}/labels', {
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
    const {data} = await ok.request('GET /repos/{owner}/{repo}/labels', {
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

    for (const {name, description, color} of deleteLabels) {
      try {
        octokit.log.info({name, description, color}, `  🚮 deleting`)

        if (!dryRun) await deleteLabel(ok, owner, repo, name)
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
        octokit.log.info({name, new_name, description, color}, `  🆙 updating`)

        if (!dryRun) await updateLabel(ok, owner, repo, name, new_name, color, description)
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
        octokit.log.info({name, description, color}, `  🆕 creating`)

        if (!dryRun) await createLabel(ok, owner, repo, name, color, description)
      } catch (error) {
        octokit.log.error(`  ${name}: ${error.message}`)
      }
    }

    octokit.log.info(`  ✅ ${url}`)
    return
  } catch (error) {
    octokit.log.error(`  ${error.message}`)
  }
}

/**
 * Create a label on a GitHub repository
 * @see https://docs.github.com/en/rest/reference/issues#create-a-label
 *
 * @param {import('@octoherd/cli').Octokit} octokit - authenticated Octokit instance
 * @param {string}                          owner - owner of repository
 * @param {string}                          repo - name of repository
 * @param {string}                          name - name of label
 * @param {string}                          color - color of label
 * @param {string}                          description - description of label
 *
 * @returns {Promise<void>}
 */
async function createLabel(octokit, owner, repo, name, color, description) {
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

/**
 * Update a label on a GitHub repository
 * @see https://docs.github.com/en/rest/reference/issues#update-a-label
 *
 * @param {import('@octoherd/cli').Octokit} octokit - authenticated Octokit instance
 * @param {string}                          owner - owner of repository
 * @param {string}                          repo - name of repository
 * @param {string}                          name - name of label
 * @param {string}                          new_name - new name of label
 * @param {string}                          color - color of label
 * @param {string}                          description - description of label
 *
 * @returns {Promise<void>}
 */
async function updateLabel(octokit, owner, repo, name, new_name, color, description) {
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

/**
 * Delete a label on a GitHub repository
 * @see https://docs.github.com/en/rest/reference/issues#delete-a-label
 *
 * @param {import('@octoherd/cli').Octokit} octokit - authenticated Octokit instance
 * @param {string}                          owner - owner of repository
 * @param {string}                          repo - name of repository
 * @param {string}                          name - name of label
 *
 * @returns {Promise<void>}
 */
async function deleteLabel(octokit, owner, repo, name) {
  await octokit.request('DELETE /repos/{owner}/{repo}/labels/{name}', {
    owner,
    repo,
    name,
  })

  // sleep 1.5 seconds
  await setTimeout(1500)
}
