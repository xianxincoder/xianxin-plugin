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

    this.e.reply("触发探索未知的神秘空间，请稍等...");
    let images = [];
    const isDimtown = this.toolsSetData.wocUrl.indexOf("dimtown.com") !== -1;
    if (this.toolsSetData.wocUrl.indexOf("/wp-json") !== -1) {
      const randomMax = isDimtown ? 400 : 600;

      const randomIndex = Math.floor(Math.random() * randomMax) + 1;

      const page = Math.ceil(randomIndex / 10);

      const fetchData = await fetch(`${this.toolsSetData.wocUrl}${page}`);
      const resJsonData = await fetchData.json();

      const index = randomIndex % 10;

      if (!resJsonData.length) {
        this.e.reply("额。没有探索到，换个姿势再来一次吧～");
        return "return";
      }

      const content = resJsonData[index].content;

      if (!content || !content.rendered) {
        this.e.reply("额。没有探索到，换个姿势再来一次吧～");
        return "return";
      }

      images = this.getImages(content.rendered);
    } else {
      const fetchData = await fetch(`${this.toolsSetData.wocUrl}`);
      const resJsonData = await fetchData.json();

      images = this.getJsonImages(JSON.stringify(resJsonData));
    }

    if (isDimtown && images.length > 1) {
      images.pop();
    }

    const imageCountLimit = this.toolsSetData.imageCountLimit || 10;

    if (images.length > imageCountLimit) {
      images.length = imageCountLimit;
    }

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
      const res = await this.e.reply(await Bot.makeForwardMsg(msgList), false, {
        recallMsg: this.toolsSetData.delMsg,
      });
      if (!res) {
        if (!res) {
          if (this.e.group.is_admin) {
            if (
              Number(Math.random().toFixed(2)) * 100 <
              this.toolsSetData.mute
            ) {
              let duration = Math.floor(Math.random() * 600) + 1;
              this.e.group.muteMember(this.e.sender.user_id, duration);
              await this.e.reply(
                `不用等了，你想要的已经被神秘的力量吞噬了～ 并随手将你禁锢${duration}秒`
              );
            } else {
              this.reply("不用等了，你想要的已经被神秘的力量吞噬了～");
            }
          } else {
            this.reply("不用等了，你想要的已经被神秘的力量吞噬了～");
          }
        }
      }
    } else {
      this.reply("额。没有探索到，换个姿势再来一次吧～");
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

  getJsonImages(string) {
    const imgRex = /https?:\/\/.*?\.(jpg|JPG|png|PNG|gif|GIF|jpeg|JPEG)/g;
    const images = [];
    let img;
    while ((img = imgRex.exec(string))) {
      images.push(img[0]);
    }
    return images;
  }
}
