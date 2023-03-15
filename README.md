# slack-login-bonus

Report daily "login" in a slack channel.

## Slack App Configuration

### OAuth & Permissions

- Add below **Bot Token Scopes** in **Scope**

  - channels:history
  - channels:read
  - chat.write
  - user:read

- **Install App**

- Copy `Signing Secret` and use as `SLACK_SIGNING_SECRET`

- Copy `Bot User OAuth Token` and use as `SLACK_BOT_TOKEN`

- Add the app in your channel

## Usage

### Installation

```
npm install
```

### Environment values

- `SLACK_SIGNING_SECRET` : App's Signing Secret. See above
- `SLACK_BOT_TOKEN` : App's Bot User OAuth Token. See above
- `TARGET_CHANNEL` : Channel ID to check
  - Can be obtained from: right-click the channel -> `Copy link`
- `HISTORY_SINCE` : ISO date to start history counting

Specify environment values in terminal
```
set SLACK_SIGNING_SECRET=xxx SLACK_BOT_TOKEN=xxx TARGET_CHANNEL=xxx npm start
```
or in `.env` file
```
SLACK_SIGNING_SECRET="xxx"
SLACK_BOT_TOKEN="xxx"
TARGET_CHANNEL="xxx"
```

### Execution

Detect this day's "login" users and post a report to the channel

- The definition of "login"
  - Sent a post in the channel (Excluding thread-closed posts)
  - Joined a huddle of the channel (Excluding only-1-user huddle)
- Will not post any message when there is no login user

```
npm start
```

Trace back the "login" histories of each user and post reports to the channel

- Reports will be sent only to this week's login users

```
npm run history
```

Dry-run (without post) mode is also supported

```
npm run dry
npm run history:dry
```
