require("dotenv").config();
const { App } = require("@slack/bolt");
const { DateTime } = require("luxon");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

const isUserMessage = (message) => {
  return (
    !message.bot_id &&
    !message.app_id &&
    message.user &&
    message.user != "USLACKBOT"
  );
};

const isHuddleMessage = (message) => {
  return message.user == "USLACKBOT" && message.room;
};

const groupby = (array, by) => {
  return Array.from(
    array.reduce((map, cur, idx, src) => {
      const key = cur[by];
      const list = map.get(key);
      if (list) {
        list.push(cur);
      } else {
        map.set(key, [cur]);
      }
      return map;
    }, new Map())
  );
};

const createCalendar = (start, end) => {
  const calendar = { 1: [], 2: [], 3: [], 4: [], 5: [] };

  // 開始日より前の曜日をパディングする
  let date = start;
  while (date.weekday > 1) {
    date = date.minus({ days: 1 });
    if (calendar[date.weekday]) {
      calendar[date.weekday].push(null);
    }
  }

  date = start;
  while (date <= end) {
    if (calendar[date.weekday]) {
      calendar[date.weekday].push({ date: date.toISODate() });
    }
    date = date.plus({ days: 1 });
  }
  return calendar;
};

exports.handler = async (event) => {
  console.log(event);
  const { history, dryRun } = event;

  if (history) {
    await reportHistory(dryRun);
  } else {
    await reportToday(dryRun);
  }
};

const reportToday = async (dryRun) => {
  const today = DateTime.now().setZone("Asia/Tokyo").startOf("day");
  console.log("today: ", today.toISO());

  try {
    const { chatUsers, huddleUsers } = await getLoginUsers(today);

    const chatUserInfos = await getUserInfos(chatUsers);
    const chatUserNames = chatUserInfos.map(
      (userInfo) => userInfo.profile.display_name || userInfo.real_name
    );
    const huddleUserInfos = await getUserInfos(huddleUsers);
    const huddleUserNames = huddleUserInfos.map(
      (userInfo) => userInfo.profile.display_name || userInfo.real_name
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

const reportHistory = async (dryRun) => {
  const sinceStr = process.env.HISTORY_SINCE;
  if (!sinceStr) {
    console.error("No HISTORY_SINCE");
    return;
  }
  const since = DateTime.fromISO(sinceStr).setZone("Asia/Tokyo").startOf("day");
  const today = DateTime.now().setZone("Asia/Tokyo").startOf("day");
  console.log(`since: ${since.toISO()}, today: ${today.toISO()}`);

  try {
    const userMessages = {};
    const histories = await getHistories(since);
    const userHistories = groupby(histories, "user");
    userHistories.slice(0, 3).forEach(([user, histories]) => {
      const loginDates = histories
        .map((h) => h.date)
        .reduce((uniq, a) => {
          if (uniq.indexOf(a) < 0) uniq.push(a);
          return uniq;
        }, []);

      const cal = createCalendar(since, today);
      Object.values(cal).forEach((week) => {
        week.forEach((day) => {
          if (day && loginDates.indexOf(day.date) >= 0) {
            day.login = true;
          }
        });
      });
      userMessages[user] = Object.values(cal)
        .map((week) => {
          return week
            .map((day) => (day ? (day.login ? "■" : "□") : "　"))
            .join("");
        })
        .join("\n");
      console.log(user + "\n" + userMessages[user]);
    });

    if (!dryRun) {
      const result = await app.client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN,
        channel: process.env.TARGET_CHANNEL,
        text: "Weekly login report",
      });
      console.log(result);

      if (result.ok) {
        for (const user in userMessages) {
          const message =
            `<@${user}>` +
            "\n" +
            userMessages[user]
              .replaceAll("■", ":large_green_square:")
              .replaceAll("□", ":white_square:")
              .replaceAll("　", ":white_small_square:");
          const result1 = await app.client.chat.postMessage({
            token: process.env.SLACK_BOT_TOKEN,
            channel: process.env.TARGET_CHANNEL,
            text: message,
            thread_ts: result.ts,
          });
          console.log(result1);
        }
      }
    }
  } catch (error) {
    console.error(error);
  }
};

const getLoginUsers = async (today) => {
  const result = await app.client.conversations.history({
    token: process.env.SLACK_BOT_TOKEN,
    channel: process.env.TARGET_CHANNEL,
    oldest: today.toUnixInteger(),
    include_all_metadata: true,
  });
  console.log(result);

  const chatUsers = result.messages
    .reverse()
    .filter((m) => isUserMessage(m))
    .map((m) => {
      return m.user;
    })
    .reduce((uniq, a) => {
      if (uniq.indexOf(a) < 0) uniq.push(a);
      return uniq;
    }, []);
  console.log(chatUsers);

  const huddleUsers = result.messages
    .filter((m) => isHuddleMessage(m))
    .map((m) => m.room.participant_history)
    .flat()
    .reduce((uniq, a) => {
      if (uniq.indexOf(a) < 0) uniq.push(a);
      return uniq;
    }, []);
  console.log(huddleUsers);

  return { chatUsers, huddleUsers };
};

const getHistories = async (since) => {
  const result = await app.client.conversations.history({
    token: process.env.SLACK_BOT_TOKEN,
    channel: process.env.TARGET_CHANNEL,
    oldest: since.toUnixInteger(),
    include_all_metadata: true,
  });
  const messages = result.messages;
  let cursor = result.response_metadata.next_cursor;
  while (cursor) {
    const nextResult = await app.client.conversations.history({
      token: process.env.SLACK_BOT_TOKEN,
      channel: process.env.TARGET_CHANNEL,
      oldest: since.toUnixInteger(),
      cursor: cursor,
      include_all_metadata: true,
    });
    messages.unshift(...nextResult.messages);
    cursor = nextResult.response_metadata.next_cursor;
  }
  console.log("messages.length: ", messages.length);

  const histories = [];
  messages.reverse().forEach((m) => {
    if (isUserMessage(m)) {
      histories.push({
        type: "chat",
        user: m.user,
        date: DateTime.fromSeconds(Number(m.ts))
          .setZone("Asia/Tokyo")
          .toISODate(),
      });
    } else if (isHuddleMessage(m)) {
      m.room.participant_history.forEach((u) => {
        histories.push({
          type: "huddle",
          user: u,
          date: DateTime.fromSeconds(Number(m.ts))
            .setZone("Asia/Tokyo")
            .toISODate(),
        });
      });
    }
  });
  console.log(histories.slice(-20));

  return histories;
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
