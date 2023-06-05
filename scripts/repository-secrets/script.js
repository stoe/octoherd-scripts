import _sodium from 'libsodium-wrappers'
import {load} from 'js-yaml'
import {readFileSync} from 'fs'

/**
 * @param {import('@octoherd/cli').Octokit}    octokit
 * @param {import('@octoherd/cli').Repository} repository
 * @param {object}                             options
 * @param {string}                             [options.path=.secrets.yml]
 * @param {boolean}                            [options.dryRun=false]
 */
export async function script(octokit, repository, {path = '.secrets.yml', dryRun = false}) {
  const {
    archived,
    disabled,
    fork,
    name: repo,
    owner: {login: owner},
    size,
    clone_url: url,
  } = repository

  // skip archived, disabled, forked and empty repos
  if (archived || disabled || fork || size === 0) return

  try {
    // read secrets from file
    const buff = readFileSync(path, 'utf-8')
    const {secrets, variables} = await load(buff)

    // fail if no secrets or variables found
    if (!secrets && !variables) {
      octokit.log.error(`❌ no secrets nor variables found in ${path}`)
      return
    }

    // repository secrets
    if (secrets) {
      // https://docs.github.com/en/rest/actions/secrets#get-a-repository-public-key
      const {
        data: {key_id, key},
      } = await octokit.request('GET /repos/{owner}/{repo}/actions/secrets/public-key', {
        owner,
        repo,
      })

      for (const secret of Object.keys(secrets)) {
        const secretName = secret
        const secretValue = secrets[secret]

        const encryptedValue = await encrypt(key, secretValue)

        if (dryRun) {
          octokit.log.info(`  🐢 dry-run create or update secret ${secretName}`)
        } else {
          try {
            // https://docs.github.com/en/rest/actions/secrets#create-or-update-a-repository-secret
            const {status} = await octokit.request('PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}', {
              owner,
              repo,
              secret_name: secretName,
              encrypted_value: encryptedValue,
              key_id,
            })

            octokit.log.info(`  🛡️ ${status === 201 ? 'created' : 'updated'} ${secretName}`)
          } catch (error) {
            octokit.log.error({error: error.message, secret: secretName}, `  ❌ create or update secret ${secretName}`)
          }
        }
      }
    }

    // repository variables
    if (variables) {
      for (const variable of Object.keys(variables)) {
        const variableName = variable
        const variableValue = variables[variable]

        let create = false
        let value = null

        try {
          // https://docs.github.com/en/rest/actions/variables#get-a-repository-variable
          const {
            data: {value: v},
          } = await octokit.request('GET /repos/{owner}/{repo}/actions/variables/{name}', {
            owner,
            repo,
            name: variableName,
          })

          value = v
        } catch (error) {
          create = true
        }

        if (variableValue === value) {
          octokit.log.info(`  🙊 no change for variable ${variableName}`)
          continue
        }

        if (dryRun) {
          octokit.log.info(`  🐢 dry-run ${create ? 'create' : 'update'} variable ${variableName}`)
        } else {
          try {
            if (create) {
              // https://docs.github.com/en/rest/actions/variables#create-a-repository-variable
              await octokit.request('POST /repos/{owner}/{repo}/actions/variables', {
                owner,
                repo,
                name: variableName,
                value: variableValue,
              })
            } else {
              // https://docs.github.com/en/rest/actions/variables#create-a-repository-variable
              await octokit.request('PATCH /repos/{owner}/{repo}/actions/variables/{name}', {
                owner,
                repo,
                name: variableName,
                value: variableValue,
              })
            }

            octokit.log.info(`  🛡️ ${create ? 'created' : 'updated'} ${variableName}`)
          } catch (error) {
            octokit.log.error({error: error.message}, `  ❌ ${create ? 'create' : 'update'} variable ${variableName}`)
          }
        }
      }
    }

    octokit.log.info(`  ✅ ${url}`)
    return
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    octokit.log.error(`❌ ${error.message}`)
  }
}

/**
 * Encrypt a secret using a public key.
 * https://www.npmjs.com/package/libsodium-wrappers
 *
 * @function encrypt
 * @async
 *
 * @param {string} key
 * @param {string} secret
 *
 * @returns {Promise<string>}
 */
const encrypt = async (key, secret) => {
  await _sodium.ready
  const sodium = _sodium

  // make sure key is a string and trim it
  if (typeof key !== 'string') key = key.toString()
  key = key.trim()

  // make sure secret is a string and trim it
  if (typeof secret !== 'string') secret = secret.toString()
  secret.trim()

  // convert base64 key & secret to Uint8Array.
  const binkey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL)
  const binsec = sodium.from_string(secret)

  // encrypt the secret using LibSodium
  const encBytes = sodium.crypto_box_seal(binsec, binkey)

  // convert encrypted Uint8Array to Base64
  return sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL)
}
