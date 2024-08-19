require('dotenv').config()
const core = require('@actions/core')
const github = require('@actions/github')
const { GistBox, MAX_LINES, MAX_LENGTH } = require('gist-box')

// Utility functions
const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1)
const truncate = (str) =>
  str.length <= MAX_LENGTH ? str : `${str.slice(0, MAX_LENGTH - 3)}...`

// Serializer functions for different GitHub event types
const serializers = {
  IssueCommentEvent: ({ payload, repo }) =>
    `🗣 Commented on #${payload.issue.number} in ${repo.name}`,
  IssuesEvent: ({ payload, repo }) =>
    `❗️ ${capitalize(payload.action)} issue #${payload.issue.number} in ${
      repo.name
    }`,
  PullRequestEvent: ({ payload, repo }) => {
    const actionEmoji = payload.action === 'opened' ? '💪' : '❌'
    const actionText = payload.pull_request.merged
      ? '🎉 Merged'
      : `${actionEmoji} ${capitalize(payload.action)}`
    return `${actionText} PR #${payload.pull_request.number} in ${repo.name}`
  },
}

// Fetch user activity from GitHub
async function fetchUserActivity(username) {
  core.debug(`Fetching activity for ${username}`)
  const octokit = github.getOctokit(process.env.GH_PAT)

  const { data: events } = await octokit.activity.listPublicEventsForUser({
    username,
    per_page: 100,
  })

  core.debug(`Found ${events.length} events for ${username}`)
  return events
}

// Format and truncate the event list
function formatEvents(events) {
  return events
    .filter((event) => serializers.hasOwnProperty(event.type))
    .slice(0, MAX_LINES)
    .map((event) => truncate(serializers[event.type](event)))
    .join('\n')
}

// Update the Gist with the formatted content
async function updateGist(content) {
  const { GIST_ID, GH_PAT } = process.env
  const box = new GistBox({ id: GIST_ID, token: GH_PAT })

  try {
    core.debug(`Updating Gist ${GIST_ID}`)
    await box.update({ content })
    core.info('Gist updated successfully!')
  } catch (err) {
    core.setFailed(`Failed to update Gist: ${err.message}`)
  }
}

// Main function
async function run() {
  try {
    const { GH_USERNAME } = process.env

    // Fetch and format the user activity
    const events = await fetchUserActivity(GH_USERNAME)
    const content = formatEvents(events)

    // Update the Gist with the formatted content
    await updateGist(content)
  } catch (error) {
    core.setFailed(`Action failed with error: ${error.message}`)
  }
}

// Run the script
run()
