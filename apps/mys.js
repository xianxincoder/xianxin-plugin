import { segment } from "oicq";
import lodash from "lodash";
import plugin from "../../../lib/plugins/plugin.js";
import Mys from "../model/mys.js";
import common from "../../../lib/common/common.js";
import xxCfg from "../model/xxCfg.js";
import fs from "node:fs";

let mysSetFile = "./plugins/xianxin-plugin/config/mys.set.yaml";
if (!fs.existsSync(mysSetFile)) {
  fs.copyFileSync("./plugins/xianxin-plugin/defSet/mys/set.yaml", mysSetFile);
}
export class mys extends plugin {
  constructor() {
    super({
      name: "米游社相关内容",
      dsc: "处理米游社中获取话题、同人、cos内容",
      event: "message",
      priority: 300,
      rule: [
        {
          reg: "^#热门话题[0-9]*$",
          fnc: "hotchat",
        },
        {
          reg: "^#同人[0-9]*$",
          fnc: "acgn",
        },
        {
          reg: "^#同人[0-9]*详情$",
          fnc: "acgnDetail",
        },
        {
          reg: "^#cos[a-z]*[0-9]*$",
          fnc: "cos",
        },
        {
          reg: "^#cos[a-z]*[0-9]*详情$",
          fnc: "cosDetail",
        },
        {
          reg: "^#*cos(dby)*\\s*.*$",
          fnc: "searchCos",
        },
        {
          reg: "^#*wiki\\s*.*$",
          fnc: "searchWiki",
        },
      ],
    });

    this.mysSetData = xxCfg.getConfig("mys", "set");
  }

  async hotchat() {
    let index = this.e.msg.replace(/#热门话题/g, "") || 0;
    const chatData = await new Mys().getChatData();

    const data = chatData[index];
    if (data) {
      this.reply(`热门话题：${data.title}\n话题地址：${data.url}`);
    } else {
      this.reply("额，没有找到合适的话题哦～");
    }
  }

  async acgn() {
    const isPrivate = this.e.isPrivate;

    let index = this.e.msg.replace(/#同人/g, "") || 0;
    const acgnData = await new Mys().getAcgnData();
    const data = acgnData[index];
    if (data) {
      let msgList = [];
      for (let imageItem of data.images) {
        if (isPrivate) {
          await this.e.reply(segment.image(imageItem));
          await common.sleep(600);
        } else {
          msgList.push({
            message: segment.image(imageItem),
            nickname: Bot.nickname,
            user_id: Bot.uin,
          });
        }
      }

      if (isPrivate) {
        return;
      }

      if (msgList.length == 1) {
        await this.e.reply(msgList[0].message);
      } else {
        await this.e.reply(await Bot.makeForwardMsg(msgList));
      }
    } else {
      this.reply("额。没有找到合适的同人信息～");
    }
  }

  async acgnDetail() {
    let index = this.e.msg.replace(/#同人/g, "").replace("详情", "") || 0;
    const acgnData = await new Mys().getAcgnData();
    const data = acgnData[index];
    if (data) {
      const message = `标题：${data.title}\n地址：${data.url}\n作者：${data.nickname}\n点赞：${data.like_num}`;
      this.reply(message);
    } else {
      this.reply("额。没有找到合适的同人信息～");
    }
  }

  async cos() {
    const isPrivate = this.e.isPrivate;
    let index = this.e.msg.replace(/#cos/g, "").replace(/dby/g, "") || 0;

    let key = "ys";
    if (this.e.msg.indexOf("dby") !== -1) {
      key = "dby";
    }

    const cosData = await new Mys().getCosData(key);

    if (index === 0) {
      index = Math.floor(Math.random() * cosData.length);
    }
    const data = cosData[index];
    if (data) {
      let msgList = [];
      for (let imageItem of data.images) {
        if (isPrivate) {
          await this.e.reply(segment.image(imageItem));
          await common.sleep(600);
        } else {
          msgList.push({
            message: segment.image(imageItem),
            nickname: Bot.nickname,
            user_id: Bot.uin,
          });
        }
      }

      if (isPrivate) {
        return;
      }
      if (msgList.length == 1) {
        await this.e.reply(msgList[0].message);
      } else {
        await this.e.reply(await Bot.makeForwardMsg(msgList));
      }
    } else {
      this.reply("额。没有找到合适的cos信息～");
    }
  }

  async cosDetail() {
    let index =
      this.e.msg.replace(/#cos/g, "").replace(/dby/g, "").replace("详情", "") ||
      0;

    let key = "ys";
    if (this.e.msg.indexOf("dby") !== -1) {
      key = "dby";
    }
    const cosData = await new Mys().getCosData(key);
    const data = cosData[index];
    if (data) {
      const message = `标题：${data.title}\n地址：${data.url}\n作者：${data.nickname}\n点赞：${data.like_num}`;
      this.reply(message);
    } else {
      this.reply("额。没有找到合适的cos信息～");
    }
  }

  async searchCos() {
    const isPrivate = this.e.isPrivate;
    let role = this.e.msg.replace(/#*cos(dby)*/g, "").trim();

    let key = "ys";
    if (this.e.msg.indexOf("dby") !== -1) {
      key = "dby";
    }

    const randomMax = this.mysSetData.cosRandomMax || key === "dby" ? 40 : 100;

    const randomIndex = Math.floor(Math.random() * randomMax) + 1;

    const last_id = Math.ceil(randomIndex / 20);

    const keyword = encodeURIComponent(role);

    const index = randomIndex % 20;

    const cosData = await new Mys().getCosSearchData(keyword, last_id, key);

    const data = cosData[index];

    if (data) {
      if (!data.images || !data.images.length) {
        this.searchCos();
        return;
      }

      if (!this.mysSetData.isReplyMulti) {
        const randomImgIdx = Math.floor(Math.random() * data.images.length);
        data.images = [data.images[randomImgIdx]];
      }

      let msgList = [];
      for (let imageItem of data.images) {
        if (isPrivate) {
          await this.e.reply(segment.image(imageItem));
          await common.sleep(600);
        } else {
          msgList.push({
            message: segment.image(imageItem),
            nickname: Bot.nickname,
            user_id: Bot.uin,
          });
        }
      }

      if (isPrivate) {
        return;
      }
      if (msgList.length == 1) {
        await this.e.reply(msgList[0].message);
      } else {
        await this.e.reply(await Bot.makeForwardMsg(msgList));
      }
    } else {
      this.reply("额。没有找到合适的cos信息～");
    }
  }

  async searchWiki() {
    let keyword = this.e.msg.replace(/#*wiki/g, "").trim();

    const wikiData = await new Mys().getWikiSearchData(keyword);

    if (wikiData.length) {
      if (this.mysSetData.isExactMatch) {
        wikiData.length = 1;
      }

      let msgList = [];
      for (let item of wikiData) {
        msgList.push({
          message: `标题：${item.title}\n标签：${item.tags.join("，")}\n链接：${
            item.href
          }`,
          nickname: Bot.nickname,
          user_id: Bot.uin,
        });
      }

      if (msgList.length == 1) {
        await this.e.reply(msgList[0].message);
      } else {
        await this.e.reply(await Bot.makeForwardMsg(msgList));
      }
    } else {
      this.reply("额。没有找到wiki内容～");
    }
  }
}
