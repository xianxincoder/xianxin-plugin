import plugin from "../../../lib/plugins/plugin.js";
import fetch from "node-fetch";
import { segment } from "oicq";
import xxCfg from "../model/xxCfg.js";
import fs from "node:fs";

/**
 * 初始化工具设置文件
 */
let toolsSetFile = "./plugins/xianxin-plugin/config/tools.set.yaml";
if (!fs.existsSync(toolsSetFile)) {
  fs.copyFileSync(
    "./plugins/xianxin-plugin/defSet/tools/set.yaml",
    toolsSetFile
  );
}

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
          reg: "^#*(woc|卧槽|嘿嘿|r18|祷图|整点涩的|瑟瑟|涩涩|色色)$",
          fnc: "woc",
          permission: "master",
        },
      ],
    });

    /** 读取工具相关设置数据 */
    this.toolsSetData = xxCfg.getConfig("tools", "set");

    this.rule[1].permission = this.toolsSetData.permission;
  }

  async thumbsUpMe() {
    Bot.pickFriend(this.e.user_id).thumbUp(10);
    this.reply("已给你点赞");
  }

  async woc() {
    const isPrivate = this.e.isPrivate;

    if (!this.toolsSetData.isPrivate && isPrivate) {
      return "return";
    }

    const randomMax = 600;

    const randomIndex = Math.floor(Math.random() * randomMax) + 1;

    const page = Math.ceil(randomIndex / 10);

    const fetchData = await fetch(
      `https://yingtall.com/wp-json/wp/v2/posts?page=${page}`
    );
    const resJsonData = await fetchData.json();

    const index = randomIndex % 10;

    if (!resJsonData.length) {
      this.reply("额。没有找到合适的cos信息，换个姿势再来一次吧～");
      return "return";
    }

    const content = resJsonData[index].content;

    if (!content || !content.rendered) {
      this.reply("额。没有找到合适的cos信息，换个姿势再来一次吧～");
      return "return";
    }

    const images = this.getImages(content.rendered);

    const forwarder =
      this.toolsSetData.forwarder == "bot"
        ? { nickname: Bot.nickname, user_id: Bot.uin }
        : {
            nickname: this.e.sender.card || this.e.user_id,
            user_id: this.e.user_id,
          };

    if (images && images.length) {
      let msgList = [];
      for (let imageItem of images) {
        msgList.push({
          message: segment.image(imageItem),
          ...forwarder,
        });
      }
      await this.e.reply(await Bot.makeForwardMsg(msgList));
    } else {
      this.reply("额。没有找到合适的cos信息～");
    }
  }

  getImages(string) {
    const imgRex = /<img.*?src="(.*?)"[^>]+>/g;
    const images = [];
    let img;
    while ((img = imgRex.exec(string))) {
      images.push(img[1]);
    }
    return images;
  }
}
