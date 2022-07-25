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
      ],
    });
  }

  async hotchat() {
    let index = this.e.msg.replace(/#热门话题/g, "") || 0;
    const chartData = await new Mys().getChatData();

    const data = chartData[index];
    if (data) {
      this.reply(`热门话题：${data.title}\n话题地址：${data.url}`);
    } else {
      this.reply("额，不好意思。没有找到合适的话题哦～");
    }
  }
}
