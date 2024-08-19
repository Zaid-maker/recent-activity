const core = require('@actions/core')
const github = require('@actions/github')
const nock = require('nock')
const { GistBox } = require('gist-box')

jest.mock('@actions/core')
jest.mock('@actions/github')
jest.mock('gist-box')

const events = [
  {
    type: 'IssuesEvent',
    repo: { name: 'clippy/take-over-github' },
    payload: { action: 'opened', issue: { number: 1 } },
  },
  {
    type: 'IssueCommentEvent',
    repo: { name: 'clippy/take-over-github' },
    payload: { action: 'closed', issue: { number: 1 } },
  },
  {
    type: 'PullRequestEvent',
    repo: { name: 'clippy/take-over-github' },
    payload: { action: 'closed', pull_request: { number: 2, merged: true } },
  },
  {
    type: 'PullRequestEvent',
    repo: { name: 'clippy/take-over-github' },
    payload: { action: 'closed', pull_request: { number: 3, merged: false } },
  },
  {
    type: 'PullRequestEvent',
    repo: {
      name: 'clippy/really-really-really-really-really-really-really-really-really-long',
    },
    payload: { action: 'opened', pull_request: { number: 3 } },
  },
]

describe('activity-box', () => {
  let octokit

  beforeEach(() => {
    GistBox.prototype.update = jest.fn()

    core.debug = jest.fn()
    core.info = jest.fn()
    core.setFailed = jest.fn()

    octokit = {
      activity: {
        listPublicEventsForUser: jest.fn().mockResolvedValue({ data: events }),
      },
    }

    github.getOctokit = jest.fn().mockReturnValue(octokit)

    nock('https://api.github.com')
      .get('/users/clippy/events/public?per_page=100')
      .reply(200, events)
  })

  it('updates the Gist with the expected string', async () => {
    const { run } = require('..')
    await run()
    expect(GistBox.prototype.update).toHaveBeenCalled()
    expect(GistBox.prototype.update.mock.calls[0][0]).toMatchSnapshot()
  })

  it('handles failure to update the Gist', async () => {
    GistBox.prototype.update.mockImplementationOnce(() => {
      throw new Error('Gist update failed')
    })

    const { run } = require('..')
    await run()
    expect(core.setFailed).toHaveBeenCalledWith(
      'Failed to update Gist: Gist update failed'
    )
  })

  it('handles failure to fetch user activity', async () => {
    octokit.activity.listPublicEventsForUser.mockImplementationOnce(() => {
      throw new Error('Failed to fetch user activity')
    })

    const { run } = require('..')
    await run()
    expect(core.setFailed).toHaveBeenCalledWith(
      'Action failed with error: Failed to fetch user activity'
    )
  })
})
