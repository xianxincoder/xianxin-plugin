import { segment } from "oicq";
import xxCfg from "../model/xxCfg.js";
import puppeteer from "../../../lib/puppeteer/puppeteer.js";
import plugin from "../../../lib/plugins/plugin.js";
import Version from "../model/version.js";

export class tools extends plugin {
  constructor() {
    super({
      name: "小工具",
      dsc: "处理一些杂项小工具",
      event: "message",
      priority: 5000,
      rule: [
        {
          reg: "^#赞我$",
          fnc: "thumbsUpMe",
        },
        {
          reg: "^#闲心(插件)?版本$",
          fnc: "version",
        },
      ],
    });

    this.versionData = xxCfg.getdefSet("version", "version");
  }

  async thumbsUpMe() {
    Bot.pickFriend(this.e.user_id).thumbUp(10);
    this.reply("已给你点赞");
  }

  async version() {
    const data = await new Version(this.e).getData(
      this.versionData.slice(0, 3)
    );
    let img = await puppeteer.screenshot("version", data);
    this.e.reply(img);
  }
}
