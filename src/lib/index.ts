import winston from "winston";
import { join } from "node:path";

export enum ERROR_CODE {
  BONUS_ALREADY_GOT = "BONUS_ALREADY_GOT",
  NOT_ENOUGH_STONES = "NOT_ENOUGH_STONES",
  USER_NOT_FOUND = "USER_NOT_FOUND",
  SLOWDOWN = "SLOWDOWN",
  INVALID_USER_ID = "INVALID_USER_ID",
  INVALID_INPUT = "INVALID_INPUT",
  NOT_FOUND = "NOT_FOUND",
  FORBIDDEN = "FORBIDDEN",
  UNSAFE_CONTENT = "UNSAFE_CONTENT",
  OUT_OF_SERVICE = "OUT_OF_SERVICE",
  FAILED = "FAILED",
  LOCKED = "LOCKED",
}

export const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  defaultMeta: { service: "nyahaha-bot" },
  transports: [
    //
    // - Write all logs with importance level of `error` or less to `error.log`
    // - Write all logs with importance level of `info` or less to `combined.log`
    //
    new winston.transports.File({
      filename: join(__dirname, "../..", "logs", "error.log"),
      level: "error",
    }),
    new winston.transports.File({
      filename: join(__dirname, "../..", "logs", "combined.log"),
    }),
  ],
});

export function slowdownOver(
  date1: Date,
  date2: Date,
  ms: number = 2 * 60 * 1000
): boolean {
  // 计算两个日期之间的毫秒差值
  const timeDifference = Math.abs(date1.getTime() - date2.getTime());

  // 定义两分钟的毫秒数
  const twoMinutesInMilliseconds = ms;

  // 判断差值是否大于两分钟的毫秒数
  return timeDifference > twoMinutesInMilliseconds;
}

export function parseArgs(input: string) {
  const regex =
    /(?:「[^」]*」|『[^』]*』|《[^》]*》|“[^”]*”|"[^"]*"|'[^']*'|[^ ])+/g;

  // const symbols = [
  //   ['「', '」'],
  //   ['『', '』'],
  //   ['《', '》'],
  //   ['“', '”'],
  //   ['"', '"'],
  //   ["'", "'"],
  // ];
  // const regex = new RegExp(
  //   `(?:${symbols
  //     .map(([left, right]) => `${left}[^${right}]${right}`)
  //     .join('|')})+`,
  //   'g',
  // );
  return input
    .match(regex)
    ?.map((item) => item.trim().replace(/^「|」|『|』|《|》|“|”|"|'$/g, ""));
}

export function sleep(time = 500) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(undefined), time);
  });
}
