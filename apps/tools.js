import plugin from "../../../lib/plugins/plugin.js";
import fetch from "node-fetch";
import { segment } from "oicq";
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
          reg: "^#*官威删除(.*)$",
          fnc: "shortcutsdel",
        },
        {
          reg: "^#*官威列表$",
          fnc: "shortcutslist",
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

    if (!this.e.isGroup) return false;

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
    if (!this.checkAuth()) return;
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

  async shortcutsdel() {
    if (!this.checkAuth()) return;
    await this.getGroupId();
    if (!this.group_id) return false;

    this.initTextArr();

    let keyWord = this.getKeyWord(this.e).replace(/#|\n|＃|官威删除/g, "");

    let temp = textArr[this.group_id].get(keyWord);
    if (textArr[this.group_id].has(keyWord)) {
      textArr[this.group_id].delete(keyWord);
    }

    let retMsg = [{ type: "text", text: "删除成功：" }];
    for (let msg of this.e.message) {
      if (msg.type == "text") {
        msg.text = msg.text.replace(/#|＃|官威删除/g, "");

        if (!msg.text) continue;
      }
      retMsg.push(msg);
    }

    await this.e.reply(retMsg);

    /** 删除图片 */
    let img = temp;
    if (Array.isArray(temp)) {
      img = item[0];
    }
    if (img && img.local) {
      fs.unlink(img.local, () => {});
    }

    this.saveJson();
  }

  async shortcutslist() {
    let page = 1;
    let pageSize = 100;
    let type = "list";

    await this.getGroupId();
    if (!this.group_id) return false;

    this.initTextArr();

    let search = this.e.msg.replace(/#|＃|官威/g, "");

    if (search.includes("列表")) {
      page = search.replace(/列表/g, "") || 1;
    } else {
      type = "search";
    }

    let list = textArr[this.group_id];

    if (lodash.isEmpty(list)) {
      await this.e.reply("暂无官威数据");
      return;
    }

    let arr = [];
    for (let [k, v] of textArr[this.group_id]) {
      if (type == "list") {
        arr.push({ key: k, val: v, num: arr.length + 1 });
      } else if (k.includes(search)) {
        /** 搜索官威 */
        arr.push({ key: k, val: v, num: arr.length + 1 });
      }
    }

    let count = arr.length;
    arr = arr.reverse();

    if (type == "list") {
      arr = this.pagination(page, pageSize, arr);
    }

    if (lodash.isEmpty(arr)) {
      return;
    }

    let msg = [];
    let num = 0;
    for (let i in arr) {
      if (num >= page * pageSize) break;

      let keyWord = await this.keyWordTran(arr[i].key);
      if (!keyWord) continue;

      // if (Array.isArray(keyWord)) {
      //   keyWord.unshift(`${arr[i].num}、`);
      //   keyWord.push("\n");
      //   keyWord.forEach((v) => msg.push(v));
      // } else
      if (keyWord.type) {
        msg.push(`\n${arr[i].num}、`, keyWord, `[${arr[i].val}]`, "\n\n");
      } else {
        msg.push(`${arr[i].num}、${keyWord}[${arr[i].val}]\n`);
      }
      num++;
    }

    let end = "";
    if (type == "list" && count > 100) {
      end = `更多内容请翻页查看\n如：#官威列表${Number(page) + 1}`;
    }

    let title = `官威列表，第${page}页，共${count}条`;
    if (type == "search") {
      title = `官威${search}，${count}条`;
    }

    let forwardMsg = await this.makeForwardMsg(Bot.uin, title, msg, end);

    this.e.reply(forwardMsg);
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

  checkAuth() {
    if (this.e.isMaster) return true;

    if (
      this.toolsSetData.shortcutsPermission == "owner" &&
      (this.e.member.is_owner || this.e.isMaster)
    ) {
      return true;
    }

    if (
      this.toolsSetData.shortcutsPermission == "admin" &&
      (this.e.member.is_owner || this.e.isMaster || this.e.member.is_admin)
    ) {
      return true;
    }

    return false;
  }

  async makeForwardMsg(qq, title, msg, end = "") {
    let nickname = Bot.nickname;
    if (this.e.isGroup) {
      let info = await Bot.getGroupMemberInfo(this.e.group_id, qq);
      nickname = info.card ?? info.nickname;
    }
    let userInfo = {
      user_id: Bot.uin,
      nickname,
    };

    let forwardMsg = [
      {
        ...userInfo,
        message: title,
      },
    ];

    let msgArr = lodash.chunk(msg, 40);
    msgArr.forEach((v) => {
      v[v.length - 1] = lodash.trim(v[v.length - 1], "\n");
      forwardMsg.push({ ...userInfo, message: v });
    });

    if (end) {
      forwardMsg.push({ ...userInfo, message: end });
    }

    /** 制作转发内容 */
    if (this.e.isGroup) {
      forwardMsg = await this.e.group.makeForwardMsg(forwardMsg);
    } else {
      forwardMsg = await this.e.friend.makeForwardMsg(forwardMsg);
    }

    /** 处理描述 */
    forwardMsg.data = forwardMsg.data
      .replace(/\n/g, "")
      .replace(/<title color="#777777" size="26">(.+?)<\/title>/g, "___")
      .replace(/___+/, `<title color="#777777" size="26">${title}</title>`);

    return forwardMsg;
  }

  /** 分页 */
  pagination(pageNo, pageSize, array) {
    let offset = (pageNo - 1) * pageSize;
    return offset + pageSize >= array.length
      ? array.slice(offset, array.length)
      : array.slice(offset, offset + pageSize);
  }

  /** 关键词转换成可发送消息 */
  async keyWordTran(msg) {
    /** 图片 */
    if (msg.includes("{image")) {
      let tmp = msg.split("{image");
      if (tmp.length > 2) return false;

      let md5 = tmp[1].replace(/}|_|:/g, "");

      msg = segment.image(`http://gchat.qpic.cn/gchatpic_new/0/0-0-${md5}/0`);
      msg.asface = true;
    } else if (msg.includes("{at:")) {
      let tmp = msg.match(/{at:(.+?)}/g);

      for (let qq of tmp) {
        qq = qq.match(/[1-9][0-9]{4,14}/g)[0];
        let member = await await Bot.getGroupMemberInfo(
          this.group_id,
          Number(qq)
        ).catch(() => {});
        let name = member?.card ?? member?.nickname;
        if (!name) continue;
        msg = msg.replace(`{at:${qq}}`, `@${name}`);
      }
    } else if (msg.includes("{face")) {
      let tmp = msg.match(/{face(:|_)(.+?)}/g);
      if (!tmp) return msg;
      msg = [];
      for (let face of tmp) {
        let id = face.match(/\d+/g);
        msg.push(segment.face(id));
      }
    }

    return msg;
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
