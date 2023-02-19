import {Octokit} from '@octoherd/cli'
import {createAppAuth} from '@octokit/auth-app'
import {readFileSync} from 'fs'

/**
 * @param {import('@octoherd/cli').Repository} repository
 * @param {*} appId
 * @param {*} privateKey
 *
 * @throws {Error}
 * @returns {import('@octoherd/cli').Octokit}
 */
export async function appAuth(repository, appId, privateKey) {
  try {
    const {
      name: repo,
      owner: {login: owner},
    } = repository

    // read key from file
    const key = readFileSync(privateKey)

    // authenticate as GitHub App
    const app = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId,
        privateKey: key,
      },
    })

    // get GitHub App's installation id for the repository
    // https://docs.github.com/en/rest/apps/apps#get-a-repository-installation-for-the-authenticated-app
    const {
      data: {id: installation_id},
    } = await app.request('GET /repos/{owner}/{repo}/installation', {
      owner,
      repo,
    })

    // create an installation access token for the GitHub App
    // https://docs.github.com/en/rest/reference/apps#create-an-installation-access-token-for-an-app
    const {
      data: {token: appToken},
    } = await app.request('POST /app/installations/{installation_id}/access_tokens', {
      installation_id,
    })

    // return authenticated Octokit instance
    return new Octokit({
      auth: appToken,
    })
  } catch (error) {
    throw error
  }
}
