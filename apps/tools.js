import plugin from "../../../lib/plugins/plugin.js";
import fetch from "node-fetch";
import puppeteer from "../../../lib/puppeteer/puppeteer.js";
import Tools from "../model/tools.js";
import lodash from "lodash";
import xxCfg from "../model/xxCfg.js";
import fs from "node:fs";
import common from "../../../lib/common/common.js";

let textArr = {};

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
          reg: "^(戳|撤|禁|踢)$",
          fnc: "shortcuts",
        },
        {
          reg: "^#*(闲心)?发电榜$",
          fnc: "fdrank",
        },
        {
          reg: "^#*最近发电$",
          fnc: "lately",
        },
      ],
    });
    this.path = "./data/shortcutsJson/";
    /** 读取工具相关设置数据 */
    this.toolsSetData = xxCfg.getConfig("tools", "set");
  }

  async init() {
    if (!fs.existsSync(this.path)) {
      fs.mkdirSync(this.path);
    }
  }

  async accept() {
    if (!this.e.message) return false;

    await this.getGroupId();

    if (!this.group_id) return false;

    this.initTextArr();

    let keyword = this.getKeyWord(this.e);

    let msg = textArr[this.group_id].get(keyword) || "";
    if (lodash.isEmpty(msg)) return false;

    if (this.e.group.is_admin) {
      if (msg == "禁") {
        let duration = Math.floor(Math.random() * 600) + 1;
        this.e.group.muteMember(this.e.sender.user_id, duration);
      } else if (msg == "踢") {
        this.e.group.recallMsg(this.e.seq);
        await common.sleep(600);
        this.e.group.kickMember(this.e.sender.user_id);
      } else if (msg == "撤") {
        this.e.group.recallMsg(this.e.seq, this.e.rand);
      }
    }
    if (msg == "戳") {
      this.e.group.pokeMember(this.e.sender.user_id);
    }
  }

  /** 群号key */
  get grpKey() {
    return `Yz:xxtools_group_id:${this.e.user_id}`;
  }

  async thumbsUpMe() {
    Bot.pickFriend(this.e.user_id).thumbUp(10);
    this.reply("已给你点赞");
  }

  async shortcuts() {
    if (
      this.toolsSetData.shortcutsPermission == "owner" &&
      !(this.e.member.is_owner || this.e.isMaster)
    ) {
      return;
    }

    if (
      this.toolsSetData.shortcutsPermission == "admin" &&
      !(this.e.member.is_owner || this.e.isMaster || this.e.member.is_admin)
    ) {
      return;
    }

    if (this.toolsSetData.shortcutsPermission == "master" && !this.e.isMaster) {
      return;
    }

    await this.getGroupId();

    if (!this.group_id) {
      this.e.reply("请先在群内触发该指令");
      return;
    }

    if (this.e.source) {
      let msg = (await this.e.group.getChatHistory(this.e.source.seq, 1)).pop();

      const keyword = this.getKeyWord(msg);

      if (!textArr[this.group_id]) textArr[this.group_id] = new Map();

      textArr[this.group_id].set(keyword, this.e.msg);

      this.saveJson();

      if (this.e.group.is_admin) {
        if (this.e.msg == "禁") {
          this.e.group.recallMsg(this.e.source.seq);
          await common.sleep(600);
          let duration = Math.floor(Math.random() * 600) + 1;
          this.e.group.muteMember(this.e.source.user_id, duration);
        } else if (this.e.msg == "踢") {
          this.e.group.recallMsg(this.e.source.seq);
          await common.sleep(600);
          this.e.group.kickMember(this.e.source.user_id);
        } else if (this.e.msg == "撤") {
          this.e.group.recallMsg(this.e.source.seq, this.e.source.rand);
        }
      }
      if (this.e.msg == "戳") {
        this.e.group.pokeMember(this.e.source.user_id);
      }
    }
  }

  async fdrank() {
    const fetchData = await fetch(
      "https://afdian.net/api/creator/get-sponsors?user_id=2248d8420da611edb68952540025c377&type=amount&page=1"
    );
    const fetchPageTwoData = await fetch(
      "https://afdian.net/api/creator/get-sponsors?user_id=2248d8420da611edb68952540025c377&type=amount&page=2"
    );
    const resJsonData = await fetchData.json();

    const resPageTwoJsonData = await fetchPageTwoData.json();

    const data = await new Tools(this.e).getRankData([
      ...resJsonData.data.list,
      ...resPageTwoJsonData.data.list,
    ]);

    let img = await puppeteer.screenshot("fdrank", {
      ...data,
      type: "rank",
      limitTop: 20,
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

  saveJson() {
    let obj = {};
    for (let [k, v] of textArr[this.group_id]) {
      obj[k] = v;
    }

    fs.writeFileSync(
      `${this.path}${this.group_id}.json`,
      JSON.stringify(obj, "", "\t")
    );
  }

  /** 初始化已添加内容 */
  initTextArr() {
    if (textArr[this.group_id]) return;

    textArr[this.group_id] = new Map();

    let path = `${this.path}${this.group_id}.json`;
    if (!fs.existsSync(path)) {
      return;
    }

    try {
      let text = JSON.parse(fs.readFileSync(path, "utf8"));

      for (let i in text) {
        textArr[this.group_id].set(String(i), text[i]);
      }
    } catch (error) {
      logger.error(`json格式错误：${path}`);
      delete textArr[this.group_id];
      return false;
    }
  }

  /** 获取添加关键词 */
  getKeyWord(msg) {
    return (
      msg
        .toString()
        .trim()
        /** 过滤@ */
        .replace(new RegExp("{at:" + Bot.uin + "}", "g"), "")
        .trim()
    );
  }

  /** 获取群号 */
  async getGroupId() {
    if (this.e.isGroup) {
      this.group_id = this.e.group_id;
      redis.setEx(this.grpKey, 3600 * 24 * 30, String(this.group_id));
      return this.group_id;
    }

    // redis获取
    let groupId = await redis.get(this.grpKey);
    if (groupId) {
      this.group_id = groupId;
      return this.group_id;
    }

    return false;
  }
}
