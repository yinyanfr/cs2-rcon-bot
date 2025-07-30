import { exec } from "node:child_process";
import { promisify } from "node:util";
import { cs2 } from "../../configs";
import Rcon from "rcon-srcds";
import { AcceptedAlias, getAlias, MapPool, parseAlias } from "./lib";
import { ERROR_CODE, slowdownOver } from "../../lib";

const execPromise = promisify(exec);

const { host, port, password } = cs2;

const options = {
  host, // Host
  port, // Port
  maximumPacketSize: 0, // Maximum packet bytes (0 = no limit)
  encoding: "ascii" as const, // Packet encoding (ascii, utf8)
  timeout: 1000, // in ms
};

const Cooldown = process.env.NODE_ENV === "development" ? 3 * 1000 : 30 * 1000;

export interface ServerStatus {
  connected: boolean;
  gameAlias: string;
  map: string;
  players: number;
  lastModified: Date;
  restarting: boolean;
}

const status: ServerStatus = {
  connected: false,
  gameAlias: "deathmatch",
  map: "de_mirage",
  players: 0,
  lastModified: new Date(),
  restarting: false,
};

export async function useRcon(
  action: (cs2Server: Rcon, status: ServerStatus) => Promise<any>
) {
  const cs2Server = new Rcon(options);
  if (status.restarting === true) {
    throw ERROR_CODE.RESTARTING;
  }
  if (status.connected === true) {
    throw ERROR_CODE.LOCKED;
  }
  try {
    await cs2Server.authenticate(password);
  } catch (error) {
    throw ERROR_CODE.OUT_OF_SERVICE;
  }
  status.connected = true;
  try {
    const result = await action(cs2Server, status);
    await cs2Server.disconnect();
    status.connected = false;
    return result;
  } catch (error) {
    await cs2Server.disconnect().catch((err) => {
      console.log(err);
    }); // whatever
    status.connected = false;
    throw error;
  }
}

export async function getStatus(cs2Server: Rcon, status: ServerStatus) {
  const statusJson = await cs2Server.execute("status_json");
  if (statusJson) {
    const statusData = JSON.parse(statusJson as string);
    const map = statusData?.server?.map;
    if (map) {
      status.map = map;
    }
    const players = statusData?.server?.clients_human;
    status.players = players || 0;
  } else throw ERROR_CODE.OUT_OF_SERVICE;
  const rawAlias = await cs2Server.execute("game_alias");
  if (rawAlias) {
    const { type, mode } = parseAlias(rawAlias as string);
    const alias = getAlias(type, mode);
    if (alias) {
      status.gameAlias = alias;
    }
  } else throw ERROR_CODE.OUT_OF_SERVICE;
  return status;
}

export function changeAliasOrMap(name: string) {
  return async function (cs2Server: Rcon, status: ServerStatus) {
    let baseCommand;
    if (AcceptedAlias.includes(name)) {
      baseCommand = "game_alias";
    } else if (MapPool.includes(name)) {
      baseCommand = "map";
    } else {
      throw ERROR_CODE.INVALID_INPUT;
    }
    const now = new Date();
    if (!slowdownOver(now, status.lastModified, Cooldown)) {
      throw ERROR_CODE.SLOWDOWN;
    }

    await cs2Server.execute(`${baseCommand} ${name}`);
  };
}

export async function restartDocker() {
  status.restarting = true;
  await execPromise("cd /etc/docker/containers/cs2/ && docker compose restart");
}

export function restartFinished() {
  status.restarting = false;
}
