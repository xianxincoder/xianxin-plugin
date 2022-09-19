import { segment } from "oicq";
import plugin from "../../../lib/plugins/plugin.js";
import Mys from "../model/mys.js";
import common from "../../../lib/common/common.js";
import xxCfg from "../model/xxCfg.js";
import fs from "node:fs";

/**
 * 初始化米游社设置文件
 */
let mysSetFile = "./plugins/xianxin-plugin/config/mys.set.yaml";
if (!fs.existsSync(mysSetFile)) {
  fs.copyFileSync("./plugins/xianxin-plugin/defSet/mys/set.yaml", mysSetFile);
}

/**
 * 米游社相关内容
 */
export class mys extends plugin {
  constructor() {
    super({
      name: "米游社功能",
      dsc: "处理米游社中获取wiki、攻略、cos、话题、同人等内容",
      event: "message",
      priority: 800,
      rule: [
        {
          reg: "^#*攻略\\s*.*$",
          fnc: "searchStrategy",
        },
        {
          reg: "^#*wiki\\s*.*$",
          fnc: "searchWiki",
        },
        {
          reg: "^#*cos[a-z]*[0-9]*$",
          fnc: "cos",
        },
        {
          reg: "^#*cos[a-z]*[0-9]*详情$",
          fnc: "cosDetail",
        },
        {
          reg: "^#*cos(dby)*\\s*.*$",
          fnc: "searchCos",
        },
        {
          reg: "^#*同人[0-9]*$",
          fnc: "acgn",
        },
        {
          reg: "^#*同人[0-9]*详情$",
          fnc: "acgnDetail",
        },
        {
          reg: "^#*同人\\s*.*$",
          fnc: "searchAcgn",
        },
        {
          reg: "^#*热门话题[0-9]*$",
          fnc: "hotchat",
        },
      ],
    });

    /** 读取米游社相关设置数据 */
    this.mysSetData = xxCfg.getConfig("mys", "set");
  }

  /**
   * rule - 米游社热门话题
   */
  async hotchat() {
    let index = this.e.msg.replace(/#*热门话题/g, "") || 0;
    const chatData = await new Mys().getChatData();

    const data = chatData[index];
    if (data) {
      this.e.reply(`热门话题：${data.title}\n话题地址：${data.url}`);
    } else {
      this.e.reply("额，没有找到合适的话题哦～");
    }
  }

  /**
   * rule - 米游社同人
   * @returns
   */
  async acgn() {
    const isPrivate = this.e.isPrivate;

    let index = this.e.msg.replace(/#*同人/g, "") || 0;
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
      this.e.reply("额。没有找到合适的同人信息～");
    }
  }

  async searchAcgn() {
    const isPrivate = this.e.isPrivate;
    let title = this.e.msg.replace(/#*同人/g, "").trim();

    const randomMax = 50;

    const randomIndex = Math.floor(Math.random() * randomMax) + 1;

    const last_id = Math.ceil(randomIndex / 20);

    const keyword = encodeURIComponent(title);

    const index = randomIndex % 20;

    const cosData = await new Mys().getAcgnSearchData(keyword, last_id);

    const data = cosData[index];

    if (data) {
      if (!data.images || !data.images.length) {
        this.searchAcgn();
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
      this.reply("额。没有找到合适的同人信息～");
    }
  }

  /**
   * rule - 米游社同人详情
   */
  async acgnDetail() {
    let index = this.e.msg.replace(/#*同人/g, "").replace("详情", "") || 0;
    const acgnData = await new Mys().getAcgnData();
    const data = acgnData[index];
    if (data) {
      const message = `标题：${data.title}\n地址：${data.url}\n作者：${data.nickname}\n点赞：${data.like_num}`;
      this.e.reply(message);
    } else {
      this.e.reply("额。没有找到合适的同人信息～");
    }
  }

  /**
   * rule - 米游社cos
   * @returns
   */
  async cos() {
    const isPrivate = this.e.isPrivate;
    let index = this.e.msg.replace(/#*cos/g, "").replace(/dby/g, "") || 0;

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

  /**
   * rule - 米游社cos详情
   */
  async cosDetail() {
    let index =
      this.e.msg
        .replace(/#*cos/g, "")
        .replace(/dby/g, "")
        .replace("详情", "") || 0;

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

  /**
   * rule - 搜索米游社cos
   * @returns
   */
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

  /**
   * rule - 米游社搜索wiki内容
   * @returns
   */
  async searchWiki() {
    const isPrivate = this.e.isPrivate;
    let keyword = this.e.msg.replace(/#*wiki/g, "").trim();

    const wikiData = await new Mys().getWikiSearchData(keyword, "wiki");

    if (wikiData.length) {
      if (this.mysSetData.wikiMode) {
        if (this.mysSetData.isExactMatch) {
          wikiData.length = 1;
        }

        let msgList = [];
        for (let item of wikiData) {
          msgList.push({
            message: `标题：${item.title}\n标签：${item.tags.join(
              "，"
            )}\n链接：${item.href}`,
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
        const data = wikiData[0];
        const isSplit = this.mysSetData.strategyMode == 2;
        const renderInfo = await new Mys().getWikiPage(data, isSplit);
        if (!renderInfo) return;

        const { img, code } = renderInfo;

        if (code === "limit") {
          if (this.mysSetData.isExactMatch) {
            wikiData.length = 1;
          }

          let msgList = [];
          for (let item of wikiData) {
            msgList.push({
              message: `标题：${item.title}\n标签：${item.tags.join(
                "，"
              )}\n链接：${item.href}`,
              nickname: Bot.nickname,
              user_id: Bot.uin,
            });
          }

          if (msgList.length == 1) {
            await this.e.reply(msgList[0].message);
          } else {
            await this.e.reply(await Bot.makeForwardMsg(msgList));
          }
          return "return";
        }

        if (img.length == 1) {
          await this.e.reply(img[0]);
        } else {
          let msgList = [];

          msgList.unshift({
            message: data.title,
            nickname: Bot.nickname,
            user_id: Bot.uin,
          });
          for (let item of img) {
            if (isPrivate) {
              await this.e.reply(item);
              await common.sleep(600);
            } else {
              msgList.push({
                message: item,
                nickname: Bot.nickname,
                user_id: Bot.uin,
              });
            }
          }
          if (isPrivate) {
            return;
          }

          await this.e.reply(await Bot.makeForwardMsg(msgList));
        }
      }
    } else {
      this.reply("额。没有找到wiki内容，换个关键词试试吧～");
    }
  }

  /**
   * rule - 米游社搜索攻略内容
   * @returns
   */
  async searchStrategy() {
    const isPrivate = this.e.isPrivate;
    let keyword = this.e.msg.replace(/#*攻略/g, "").trim();

    const wikiData = await new Mys().getWikiSearchData(keyword, "strategy");

    if (wikiData.length) {
      if (this.mysSetData.strategyMode == 1) {
        if (this.mysSetData.isExactMatch) {
          wikiData.length = 1;
        }

        let msgList = [];
        for (let item of wikiData) {
          msgList.push({
            message: `标题：${item.title}\n标签：${item.tags.join(
              "，"
            )}\n链接：${item.href}`,
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
        const data = wikiData[0];
        const isSplit = this.mysSetData.strategyMode == 2;
        const renderInfo = await new Mys().strategySearch(data, isSplit);
        if (!renderInfo) return;

        const { img, code } = renderInfo;

        if (code === "limit") {
          if (this.mysSetData.isExactMatch) {
            wikiData.length = 1;
          }

          let msgList = [];
          for (let item of wikiData) {
            msgList.push({
              message: `标题：${item.title}\n标签：${item.tags.join(
                "，"
              )}\n链接：${item.href}`,
              nickname: Bot.nickname,
              user_id: Bot.uin,
            });
          }

          if (msgList.length == 1) {
            await this.e.reply(msgList[0].message);
          } else {
            await this.e.reply(await Bot.makeForwardMsg(msgList));
          }
          return "return";
        }

        if (img.length == 1) {
          await this.e.reply(img[0]);
        } else {
          let msgList = [];

          msgList.unshift({
            message: data.title,
            nickname: Bot.nickname,
            user_id: Bot.uin,
          });
          for (let item of img) {
            if (isPrivate) {
              await this.e.reply(item);
              await common.sleep(600);
            } else {
              msgList.push({
                message: item,
                nickname: Bot.nickname,
                user_id: Bot.uin,
              });
            }
          }

          if (isPrivate) {
            return;
          }
          await this.e.reply(await Bot.makeForwardMsg(msgList));
        }
      }
    } else {
      this.e.reply("额。没有找到攻略内容，换个关键词试试吧～");
    }
  }
}
