import plugin from "../../../lib/plugins/plugin.js";
import fetch from "node-fetch";
import { segment } from "oicq";
import puppeteer from "../../../lib/puppeteer/puppeteer.js";
import common from "../../../lib/common/common.js";
import xxCfg from "../model/xxCfg.js";
import Tools from "../model/tools.js";
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

let urlTypeCache = {};

let groupId = "";

export class tools extends plugin {
  constructor() {
    super({
      name: "闲心小工具",
      dsc: "处理一些杂项小工具",
      event: "message",
      priority: 5000,
      rule: [
        {
          reg: "^#*赞我$",
          fnc: "thumbsUpMe",
        },
        {
          reg: "^#*(woc|卧槽)$",
          fnc: "woc",
          permission: "master",
        },
        {
          reg: "^#*转发\\s*[0-9]{5,11}$",
          fnc: "forward",
          permission: "master",
        },
        {
          reg: "^#*群列表$",
          fnc: "groupList",
          permission: "master",
        },
        {
          reg: "^#*闲心发电榜$",
          fnc: "fdrank",
          permission: "master",
        },
        {
          reg: "^#*最近发电$",
          fnc: "lately",
          permission: "master",
        },
      ],
    });

    this.forwardRules = [
      {
        reg: "^#*(结束|停止)转发$",
        fuc: "stopForward",
        desc: "#结束转发 -- 结束转发消息状态",
      },
      {
        reg: "^#*戳\\s*.*$",
        fuc: "forwardForPoke",
        desc: "#戳 QQ号  -- 戳一戳群组中的某位群友",
      },
      {
        reg: "^#*退群$",
        fuc: "forwardForQuit",
        desc: "#退群  -- 退出当前转发的群聊",
      },
    ];

    /** 读取工具相关设置数据 */
    this.toolsSetData = xxCfg.getConfig("tools", "set");

    this.rule[1].permission = this.toolsSetData.permission;
    this.rule[1].reg = `^#*(${this.toolsSetData.keywords.join("|")})$`;

    // 加入的群组信息
    this.list = [];
    for (var [key, value] of Bot.gl) {
      this.list.push(`${value.group_name} ${key}`);
    }
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
      if (urlTypeCache[this.toolsSetData.wocUrl] == "buffer") {
        const image = await this.getBufferImage(`${this.toolsSetData.wocUrl}`);
        images = [image];
      } else {
        try {
          const fetchData = await fetch(`${this.toolsSetData.wocUrl}`);
          const resJsonData = await fetchData.json();

          images = this.getJsonImages(JSON.stringify(resJsonData));
        } catch (error) {
          urlTypeCache[this.toolsSetData.wocUrl] = "buffer";
          const image = await this.getBufferImage(
            `${this.toolsSetData.wocUrl}`
          );
          images = [image];
        }
      }
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

  async forward() {
    groupId = this.e.msg.replace(/#*转发\s*/g, "") || 0;

    if (!Bot.gl.get(Number(groupId))) {
      this.reply(`未找到当前群组，您加入的群组有\n${this.list.join("\n")}`);
      return;
    }

    this.setContext("doForward", this.e.isGroup, 5 * 60);
    /** 回复 */
    await this.reply(
      `请发送要转发的内容，其中内置指令如下\n${this.forwardRules
        .map((item) => item.desc)
        .join("\n")}`,
      false,
      {
        at: true,
      }
    );
  }

  async doForward() {
    if (this.e.isGroup) {
      return;
    }

    let result = { stats: true };

    for (let v of this.forwardRules) {
      if (new RegExp(v.reg).test(this.e.msg)) {
        try {
          if (v.fuc) {
            let res = await eval("this." + v.fuc)(this);
            result = res;
          }
        } catch (error) {
          logger.error(error);
        }
      }
    }

    if (!result.stats) {
      if (result.code === "finish") {
        this.finish("doForward", this.e.isGroup);
      }
      return;
    }

    /** 转发内容 */
    Bot.pickGroup(Number(groupId))
      .sendMsg(this.e.message)
      .catch((err) => {
        this.reply("发送失败，请确认发送的群号正确");
        return;
      });
  }

  async stopForward(e) {
    e.reply("已停止转发");
    return { status: false, code: "finish" };
  }

  async forwardForQuit(e) {
    Bot.pickGroup(Number(groupId)).quit();
    e.reply(`已退群[${groupId}]`);
  }

  async forwardForPoke(that) {
    const uid = that.e.msg.replace(/#*戳\s*/g, "") || Bot.uin;
    const result = await Bot.pickGroup(Number(groupId)).pokeMember(uid);

    that.e.reply(`已戳[${uid}]`);
    return { status: false, code: "" };
  }

  groupList() {
    this.reply(`目前加入的群组有\n${this.list.join("\n")}`);
  }

  async fdrank() {
    const fetchData = await fetch(
      "https://afdian.net/api/creator/get-sponsors?user_id=2248d8420da611edb68952540025c377&type=amount&page=1"
    );
    const resJsonData = await fetchData.json();

    const data = await new Tools(this.e).getRankData(resJsonData.data.list);

    let img = await puppeteer.screenshot("fdrank", {
      ...data,
      type: "rank",
      limitTop: 10,
    });
    this.e.reply(img);
  }

  async lately() {
    const fetchData = await fetch(
      "https://afdian.net/api/creator/get-sponsors?user_id=2248d8420da611edb68952540025c377&type=new&page=1"
    );
    const resJsonData = await fetchData.json();

    const data = await new Tools(this.e).getRankData(resJsonData.data.list);

    let img = await puppeteer.screenshot("fdrank", {
      ...data,
      type: "lately",
      limitTop: 10,
    });
    this.e.reply(img);
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

  // 获取图片
  async getBufferImage(url) {
    let response = await fetch(url, {
      method: "get",
      responseType: "arraybuffer",
    });

    const buffer = await response.arrayBuffer();

    return (
      "base64://" +
      btoa(
        new Uint8Array(buffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      )
    );
  }
}
