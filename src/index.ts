import { CronJob } from "cron";
import TelegramBot from "node-telegram-bot-api";
import configs from "./configs";

import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";
import utc from "dayjs/plugin/utc";
import relativeTime from "dayjs/plugin/relativeTime";
import { ERROR_CODE, logger, parseArgs, sleep } from "./lib";
import {
  changeAliasOrMap,
  getStatus,
  restartDocker,
  restartFinished,
  type ServerStatus,
  useRcon,
} from "./features";
import { AcceptedAlias, MapPool } from "./features/cs2/lib";

dayjs.extend(localizedFormat);
dayjs.extend(utc);
dayjs.extend(relativeTime);

const botToken = configs.token;

if (!botToken) {
  logger.error("No token.");
  throw "Please add your bot token to the env.";
}

const bot = new TelegramBot(botToken, {
  polling: true,
});
logger.info("Bot running.");

bot.on("message", async (msg) => {
  const { id: uid, first_name, last_name } = msg.from ?? {};
  const { id: chatId } = msg.chat ?? {};
  const { text = "" } = msg ?? {};
  if (!uid) {
    return 0;
  }

  const rawText = text.replace(/ *@cs2_rcon_bot */, " ").replace(/^\//, "");
  const args = parseArgs(rawText);

  try {
    if (args?.length) {
      // Exlusive Features
      if (`${chatId}` === `${configs.groupId}`) {
        if (args[0] === "cs2") {
          const command = args[1];
          if (!command) {
            const status: ServerStatus = await useRcon(getStatus);
            if (status) {
              const { gameAlias, map, players } = status;
              await bot.sendMessage(
                chatId,
                `服务器正在运行，模式：${gameAlias}，地图：${map}，服务器中当前有${players}位玩家。`
              );
              return logger.info(
                `${uid} - ${first_name} ${
                  last_name ?? ""
                } has checked the server data.`
              );
            }
          } else if (command === "重启" || command === "restart") {
            await useRcon(async () => {
              await bot.sendMessage(chatId, `开始尝试重启服务器，请稍等。`);
              await restartDocker();
              await bot.sendMessage(
                chatId,
                `服务器已成功重启，可能需要等到3-5分钟（需要更新的情况时间更长），请耐心等待。`
              );
            });

            for (let retry = 0; retry < 5; retry++) {
              await sleep(2 * 60 * 1000);
              try {
                const status: ServerStatus = await useRcon(getStatus);
                if (status) {
                  const { gameAlias, map, players } = status;
                  await bot.sendMessage(
                    chatId,
                    `服务器正在运行，模式：${gameAlias}，地图：${map}，服务器中当前有${players}位玩家。`
                  );
                  restartFinished();
                  return logger.info(
                    `${uid} - ${first_name} ${
                      last_name ?? ""
                    } has restarted the server.`
                  );
                }
              } catch (error) {
                await bot.sendMessage(
                  chatId,
                  `服务器准备中，2分钟后重新查询。`
                );
              }
            }
          } else {
            await useRcon(changeAliasOrMap(command));
            await bot.sendMessage(
              chatId,
              `服务器正在更换模式或地图至：${command}，请稍等。如需继续更改模式或地图，请等待30秒。`
            );
            return logger.info(
              `${uid} - ${first_name} ${
                last_name ?? ""
              } has changed cs2 server to ${command}.`
            );
          }
        }
      }
    }
  } catch (error) {
    if (error === ERROR_CODE.INVALID_INPUT) {
      await bot.sendMessage(
        chatId,
        `请输入正确的模式或地图代号：\n模式：${AcceptedAlias.join(
          "  "
        )}\n地图：${MapPool.join("  ")}`
      );
    } else if (error === ERROR_CODE.LOCKED) {
      await bot.sendMessage(chatId, "当前有正在进行的操作，请等待其完成。");
    } else if (error === ERROR_CODE.RESTARTING) {
      await bot.sendMessage(chatId, "服务器正在重启，请耐心等待。");
    } else if (error === ERROR_CODE.OUT_OF_SERVICE) {
      await bot.sendMessage(chatId, `服务器挂惹`);
    } else if (error === ERROR_CODE.SLOWDOWN) {
      await bot.sendMessage(chatId, `切换模式或地图需等待30秒。`);
    } else {
      console.log(error);
      await bot.sendMessage(chatId, `未知错误。`);
    }
    return logger.info(
      `${uid} - ${first_name} ${
        last_name ?? ""
      } wanted to operate cs2 server, but has failed to ${error}.`
    );
  }
});

const autoRestart = new CronJob(
  "0 4 * * *",
  async function () {
    await useRcon(async () => {
      try {
        await restartDocker();
        await sleep(10 * 60 * 1000);
        restartFinished();
        return logger.info("Server auto restarted.");
      } catch (error) {
        bot.sendMessage(configs.groupId, "服务器自动重启失败");
        return logger.info("Server auto restart failed.");
      }
    });
  },
  null,
  true,
  "Asia/Hong_Kong"
);
