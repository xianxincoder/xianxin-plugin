import fs from "node:fs";
import xxCfg from "./model/xxCfg.js";

const versionData = xxCfg.getdefSet("version", "version");

Bot.logger.info(`--------------------------`);
Bot.logger.info(`闲心插件${versionData[0].version}初始化~`);
Bot.logger.info(`--------------------------`);

const files = fs
  .readdirSync("./plugins/xianxin-plugin/apps")
  .filter((file) => file.endsWith(".js"));

let apps = {};
for (let file of files) {
  let name = file.replace(".js", "");
  apps[name] = (await import(`./apps/${file}`))[name];
}

export { apps };
