require("dotenv").config();
const { App } = require("@slack/bolt");
const moment = require("moment");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

exports.handler = async (event) => {
  const today = moment().startOf("day");

  try {
    const chatUsers = await getChatUsers(today);
    const huddleUsers = []; // TODO

    const messages = [
      "Today's login users",
      "on chat: " + chatUsers.map((u) => `<@${u}>`).join(" "),
      "on huddle: " + huddleUsers.map((u) => `<@${u}>`).join(" "),
    ];
    await app.client.chat.postMessage({
      token: process.env.SLACK_BOT_TOKEN,
      channel: "CG4TU8X41",
      text: messages.join("\n"),
    });
  } catch (error) {
    console.error(error);
  }
};

const getChatUsers = async (today) => {
  const result = await app.client.conversations.history({
    token: process.env.SLACK_BOT_TOKEN,
    channel: process.env.TARGET_CHANNEL,
    oldest: today.unix(),
  });
  console.log(result);

  const chatUsers = result.messages
    .filter((m) => !m.bot_id && !m.app_id)
    .map((m) => {
      return m.user;
    })
    .filter((u) => u)
    .reduce((uniq, a) => {
      if (uniq.indexOf(a) < 0) uniq.push(a);
      return uniq;
    }, []);
  console.log(chatUsers);

  return chatUsers;
}