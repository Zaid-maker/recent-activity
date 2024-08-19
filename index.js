require('dotenv').config()

const { Toolkit } = require('actions-toolkit')
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
async function fetchUserActivity(tools, username) {
  tools.log.debug(`Fetching activity for ${username}`)
  const { data: events } = await tools.github.activity.listPublicEventsForUser({
    username,
    per_page: 100,
  })
  tools.log.debug(`Found ${events.length} events for ${username}`)
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
async function updateGist(tools, content) {
  const { GIST_ID, GH_PAT } = process.env
  const box = new GistBox({ id: GIST_ID, token: GH_PAT })

  try {
    tools.log.debug(`Updating Gist ${GIST_ID}`)
    await box.update({ content })
    tools.exit.success('Gist updated successfully!')
  } catch (err) {
    tools.log.error('Failed to update Gist:', err)
    tools.exit.failure('Gist update failed.')
  }
}

// Main function executed by the Toolkit
Toolkit.run(
  async (tools) => {
    const { GH_USERNAME } = process.env

    // Fetch and format the user activity
    const events = await fetchUserActivity(tools, GH_USERNAME)
    const content = formatEvents(events)

    // Update the Gist with the formatted content
    await updateGist(tools, content)
  },
  {
    event: 'schedule',
    secrets: ['GITHUB_TOKEN', 'GH_PAT', 'GH_USERNAME', 'GIST_ID'],
  }
)
