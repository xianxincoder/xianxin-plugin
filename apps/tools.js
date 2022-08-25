import plugin from "../../../lib/plugins/plugin.js";
import fetch from "node-fetch";
import { segment } from "oicq";
import common from "../../../lib/common/common.js";
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
      name: "闲心小工具",
      dsc: "处理一些杂项小工具",
      event: "message",
      priority: 5000,
      rule: [
        {
          reg: "^#赞我$",
          fnc: "thumbsUpMe",
        },
        {
          reg: "^#*(woc|卧槽)$",
          fnc: "woc",
          permission: "master",
        },
      ],
    });

    /** 读取工具相关设置数据 */
    this.toolsSetData = xxCfg.getConfig("tools", "set");

    this.rule[1].permission = this.toolsSetData.permission;
    this.rule[1].reg = `^#*(${this.toolsSetData.keywords.join("|")})$`;
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

    // if (this.toolsSetData.permission == "master" && !this.e.isMaster) {
    //   return "return";
    // }

    // if (this.toolsSetData.permission == "admin" && !this.e.member.is_admin) {
    //   return "return";
    // }
    // if (this.toolsSetData.permission == "owner" && !this.e.member.is_owner) {
    //   return "return";
    // }

    if (this.toolsSetData.cd != 0) {
      /** cd */
      let key = `Yz:woc:${this.e.group_id}`;
      if (await redis.get(key)) return;
      redis.set(key, "1", { EX: Number(this.toolsSetData.cd) });
    }

    const randomMax = 600;

    const randomIndex = Math.floor(Math.random() * randomMax) + 1;

    const page = Math.ceil(randomIndex / 10);

    /**
     * 目前已知图片源
     * 1 https://yingtall.com/wp-json/wp/v2/posts?page=
     * 2 https://dimtown.com/wp-json/wp/v2/posts?filter[cat]=8&page=
     */
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
        if (isPrivate) {
          await this.e.reply(segment.image(imageItem), false, {
            recallMsg: this.toolsSetData.delMsg,
          });
          await common.sleep(600);
        } else {
          msgList.push({
            message: segment.image(imageItem),
            ...forwarder,
          });
        }
      }
      if (isPrivate) {
        return;
      }
      await this.e.reply(await Bot.makeForwardMsg(msgList), false, {
        recallMsg: this.toolsSetData.delMsg,
      });
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
