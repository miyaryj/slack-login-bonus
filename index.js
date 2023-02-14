require("dotenv").config();
const { App } = require("@slack/bolt");
const moment = require("moment");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

exports.handler = async (event) => {
  console.log(event);
  const { dryRun } = event;
  const today = moment().startOf("day");

  try {
    const { chatUsers, huddleUsers } = await getUsers(today);

    const messages = [
      "Today's login users",
      "on chat: " + chatUsers.map((u) => `<@${u}>`).join(" "),
      "on huddle: " + huddleUsers.map((u) => `<@${u}>`).join(" "),
    ];
    console.log(messages);

    if (!dryRun) {
      const result = await app.client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN,
        channel: process.env.TARGET_CHANNEL,
        text: messages.join("\n"),
      });
      console.log(result);
    }
  } catch (error) {
    console.error(error);
  }
};

const getUsers = async (today) => {
  const result = await app.client.conversations.history({
    token: process.env.SLACK_BOT_TOKEN,
    channel: process.env.TARGET_CHANNEL,
    oldest: today.unix(),
    include_all_metadata: true,
  });
  console.log(result);

  const chatUsers = result.messages
    .filter((m) => !m.bot_id && !m.app_id && !m.subtype)
    .map((m) => {
      return m.user;
    })
    .filter((u) => u && u != "USLACKBOT")
    .reduce((uniq, a) => {
      if (uniq.indexOf(a) < 0) uniq.push(a);
      return uniq;
    }, []);
  console.log(chatUsers);

  const huddleUsers = result.messages
    .filter((m) => m.user == "USLACKBOT" && m.room)
    .map((m) => m.room.participant_history)
    .flat()
    .reduce((uniq, a) => {
      if (uniq.indexOf(a) < 0) uniq.push(a);
      return uniq;
    }, []);
  console.log(huddleUsers);

  return { chatUsers, huddleUsers };
};
