import plugin from "../../../lib/plugins/plugin.js";
import fs from "node:fs";

let pkArr = {};

/**
 * jsonData
 * {1484288448: {exp: 0, nick: ''}}
 */

/**
 * @数据
 * {
  post_type: 'message',
  message_id: 'GXLow1h4ccAAADymf/yg82Lk/wwB',
  user_id: 1484288448,
  time: 1659174668,
  seq: 15526,
  rand: 2147262707,
  font: 'Helvetica',
  message: [
    { type: 'text', text: '#pk' },
    { type: 'at', qq: 2243784785, text: '@派蒙' },
    { type: 'text', text: '' }
  ],
  raw_message: '#pk@派蒙 ',
  message_type: 'group',
  sender: {
    user_id: 1484288448,
    nickname: '闲心',
    card: '闲心',
    sex: 'unknown',
    age: 0,
    area: '',
    level: 1,
    role: 'owner',
    title: ''
  },
  group_id: 426961091,
  group_name: '原神丘丘群',
  block: false,
  sub_type: 'normal',
  anonymous: null,
  atme: true,
  atall: false,
  group: Group {},
  member: Member {},
  reply: [AsyncFunction (anonymous)],
  recall: [Function (anonymous)],
  self_id: 2243784785,
  msg: '#pk',
  atBot: true,
  logText: '[原神丘丘群(闲心)]',
  isGroup: true,
  isMaster: true,
  replyNew: [Function (anonymous)],
  logFnc: '[pk游戏][pk]',
  checkAuth: [AsyncFunction (anonymous)],
  getMysApi: [AsyncFunction (anonymous)]
}
 */

export class game extends plugin {
  constructor(e) {
    super({
      name: "pk游戏",
      dsc: "pk小游戏",
      event: "message.group",
      priority: 500,
      rule: [
        {
          reg: "^#我的pk$",
          fnc: "mypk",
        },
        {
          reg: "^#pk榜$",
          fnc: "rank",
        },
        {
          reg: "^#pk$",
          fnc: "pk",
        },
      ],
    });

    this.path = "./data/pkJson/";
  }

  async init() {
    if (!fs.existsSync(this.path)) {
      fs.mkdirSync(this.path);
    }
  }

  /** 群号key */
  get grpKey() {
    return `Yz:group_id:${this.e.user_id}`;
  }

  async mypk() {
    await this.getGroupId();
    if (!this.group_id) return false;

    if (!pkArr[this.group_id]) {
      this.register();
    }

    let pkInfo = pkArr[this.group_id].get(this.e.user_id);

    if (!pkInfo) {
      this.register();
      pkInfo = { nick: this.e.sender.card, exp: 0 };
    }

    this.reply(`昵称：${pkInfo.nick}\n等级：${pkInfo.exp}`);
  }

  async pk() {
    await this.getGroupId();
    if (!this.group_id) return false;

    this.initPkArr();

    console.log(this.e);

    if (!pkArr[this.group_id]) {
      this.reply("首次战斗，请先使用#我的pk注册pk信息");
      return false;
    }

    let pkInfo = pkArr[this.group_id].get(this.e.user_id);

    if (!pkInfo) {
      this.reply("首次战斗，请先使用#我的pk注册pk信息");
      return false;
    }

    console.log(this.e);

    await this.reply("123");
  }

  async rank() {
    await this.getGroupId();
    if (!this.group_id) return false;
  }

  async register() {
    this.initPkArr();

    if (!pkArr[this.group_id]) pkArr[this.group_id] = new Map();

    pkArr[this.group_id].set(this.e.user_id, {
      nick: this.e.sender.card,
      exp: 0,
    });

    this.saveJson();
  }

  /** 初始化已添加内容 */
  initPkArr() {
    if (pkArr[this.group_id]) return;

    pkArr[this.group_id] = new Map();

    let path = `${this.path}${this.group_id}.json`;
    if (!fs.existsSync(path)) {
      return;
    }

    try {
      let pkMapJson = JSON.parse(fs.readFileSync(path, "utf8"));
      for (let key in pkMapJson) {
        pkArr[this.group_id].set(String(key), text[key]);
      }
    } catch (error) {
      logger.error(`json格式错误：${path}`);
      delete pkArr[this.group_id];
      return false;
    }
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

  /** 保存json文件 */
  saveJson() {
    let obj = {};
    for (let [k, v] of pkArr[this.group_id]) {
      obj[k] = v;
    }

    fs.writeFileSync(
      `${this.path}${this.group_id}.json`,
      JSON.stringify(obj, "", "\t")
    );
  }
}
