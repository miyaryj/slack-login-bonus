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

    const chatUserInfos = await getUserInfos(chatUsers);
    const chatUserNames = chatUserInfos.map(
      (userInfo) => userInfo.profile.display_name
    );
    const huddleUserInfos = await getUserInfos(huddleUsers);
    const huddleUserNames = huddleUserInfos.map(
      (userInfo) => userInfo.profile.display_name
    );

    if (!chatUserNames.length && !huddleUserNames.length) {
      console.log("No login users");
      return;
    }

    const messages = [
      "Today's login users",
      "on chat: " +
        (chatUserNames.length
          ? chatUserNames.map((name) => `*${name}*`).join(", ")
          : "-"),
      "on huddle: " +
        (huddleUserNames.length
          ? huddleUserNames.map((name) => `*${name}*`).join(", ")
          : "-"),
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
    .filter((m) => !m.bot_id && !m.app_id)
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

const getUserInfos = async (users) => {
  const results = await Promise.all(
    users.map((user) => {
      return app.client.users.info({
        token: process.env.SLACK_BOT_TOKEN,
        user: user,
      });
    })
  );

  return results.map((result) => result.user);
};
