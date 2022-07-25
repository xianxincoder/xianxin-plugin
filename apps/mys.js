import { segment } from "oicq";
import lodash from "lodash";
import plugin from "../../../lib/plugins/plugin.js";
import Mys from "../model/mys.js";

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
          reg: "^#cos[0-9]*$",
          fnc: "cos",
        },
      ],
    });
  }

  async hotchat() {
    let index = this.e.msg.replace(/#热门话题/g, "") || 0;
    const chatData = await new Mys().getChatData();

    const data = chatData[index];
    if (data) {
      this.reply(`热门话题：${data.title}\n话题地址：${data.url}`);
    } else {
      this.reply("额，不好意思。没有找到合适的话题哦～");
    }
  }

  async acgn() {
    let index = this.e.msg.replace(/#同人/g, "") || 0;
    const acgnData = await new Mys().getAcgnData();
    const data = acgnData[index];
    if (data) {
      const message = [
        segment.image(data.cover),
        `\n标题：${data.title}`,
        `\n地址：${data.url}`,
      ];
      this.reply(message);
    } else {
      this.reply("额，不好意思。没有找到合适的话题哦～");
    }
  }

  async cos() {
    let index = this.e.msg.replace(/#cos/g, "") || 0;
    const cosData = await new Mys().getCosData();
    const data = cosData[index];
    if (data) {
      const message = [
        segment.image(data.cover),
        `\n标题：${data.title}`,
        `\n地址：${data.url}`,
      ];
      this.reply(message);
    } else {
      this.reply("额，不好意思。没有找到合适的话题哦～");
    }
  }
}
