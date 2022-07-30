import plugin from "../../../lib/plugins/plugin.js";
import fs from "node:fs";
import { segment } from "oicq";

let pkArr = {};

/**
 * jsonData
 * {1484288448: {exp: 0, nick: ''}}
 */

export class game extends plugin {
  constructor(e) {
    super({
      name: "群战小游戏",
      dsc: "群战小游戏",
      event: "message.group",
      priority: 500,
      rule: [
        {
          reg: "^#(我的|加入)?群战(信息)?$",
          fnc: "mypk",
        },
        {
          reg: "^#战榜$",
          fnc: "rank",
        },
        {
          reg: "^(#)?战$",
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
    if (!this.group_id) return;

    this.initPkArr();

    if (!pkArr[this.group_id]) {
      this.register();
    }

    let pkInfo = pkArr[this.group_id].get(String(this.e.user_id));

    if (!pkInfo) {
      this.register();
      pkInfo = { nick: this.e.sender.card || this.e.user_id, exp: 100 };
    }

    this.reply(`昵称：${pkInfo.nick}\n战力：${pkInfo.exp}`);
  }

  async pk() {
    await this.getGroupId();
    if (!this.group_id) return;

    this.initPkArr();

    if (!pkArr[this.group_id]) {
      this.reply("首次战斗，请先使用#加入群战注册群战信息");
      return;
    }

    let selfInfo = pkArr[this.group_id].get(String(this.e.user_id));

    if (!selfInfo) {
      this.reply("首次战斗，请先使用#加入群战注册群战信息");
      return;
    }

    const enemy = this.getEnemy();

    if (!enemy) {
      this.reply("没有对手的战斗，如何战斗。请发送#战@某位群友");
      return;
    }

    let enemyInfo = pkArr[this.group_id].get(String(enemy));

    if (!enemyInfo) {
      this.reply("对手未注册群战信息，请先让对手使用#加入群战注册群战信息");
      return;
    }

    const retData = this.pkHandle(
      { ...selfInfo, user_id: this.e.user_id },
      { ...enemyInfo, user_id: enemy }
    );

    const { winner, loser } = retData;

    const message = [
      segment.at(this.e.user_id, this.e.sender.card || this.e.user_id),
    ];

    if ((this.e.sender.card || this.e.user_id) === winner.nick) {
      message.push(" 完胜");
      message.push(
        `\n战胜了对手，并获得战力${winner.tempExp}点，当前战力为${winner.exp}`
      );
    } else {
      message.push(" 惜败");
      message.push(
        `\n惜败，并损失战力${loser.tempExp}点，当前战力为${loser.exp}`
      );
    }

    await this.reply(message);
  }

  async rank() {
    await this.getGroupId();
    if (!this.group_id) return;
  }

  async register() {
    this.initPkArr();

    if (!pkArr[this.group_id]) pkArr[this.group_id] = new Map();

    pkArr[this.group_id].set(String(this.e.user_id), {
      nick: this.e.sender.card || this.e.user_id,
      exp: 100,
    });

    this.saveJson();
  }

  /** pk处理 */
  pkHandle(self, enemy) {
    if (!pkArr[this.group_id]) pkArr[this.group_id] = new Map();

    const { exp: selfExp } = self;

    const { exp: enemyExp } = enemy;

    let winner = null;
    let loser = null;
    let loserReduce = 0;

    const totalExp = selfExp + enemyExp;

    let probability = Number(selfExp / totalExp).toFixed(2);

    let randomNum = Math.random().toFixed(2);

    let tempSelfExp = selfExp;
    let tempEnemyExp = enemyExp;

    if (randomNum > probability) {
      // 输了
      // 扣减的经验值为对手的1/10经验
      let reduce = Math.round(selfExp * 0.1);

      if (reduce > enemyExp) {
        reduce = enemyExp;
      }

      tempSelfExp = selfExp - reduce;
      tempEnemyExp = enemyExp + reduce;
      loserReduce = reduce;

      if (tempSelfExp < 10) {
        loserReduce = tempSelfExp - 10;
        tempSelfExp = 10;
      }

      winner = { ...enemy, exp: tempEnemyExp, tempExp: reduce };
      loser = { ...self, exp: tempSelfExp, tempExp: loserReduce };
    } else {
      // 赢了
      // 增加的经验值为对手的1/10经验
      let add = Math.round(enemyExp * 0.1);

      // 如果增加的经验值比自己全部的经验都多，那么自己的经验最多翻倍
      if (add > selfExp) {
        add = selfExp;
      }

      tempSelfExp = selfExp + add;

      tempEnemyExp = enemyExp - add;

      loserReduce = add;
      if (tempEnemyExp < 10) {
        tempEnemyExp = 10;
        loserReduce = tempEnemyExp - 10;
      }

      winner = { ...self, exp: tempSelfExp, tempExp: add };
      loser = { ...enemy, exp: tempEnemyExp, tempExp: loserReduce };
    }

    pkArr[this.group_id].set(String(self.user_id), {
      nick: self.nick,
      exp: tempSelfExp,
    });

    pkArr[this.group_id].set(String(enemy.user_id), {
      nick: enemy.nick,
      exp: tempEnemyExp,
    });

    this.saveJson();
    return { winner, loser };
  }

  getEnemy() {
    /** 添加内容 */
    let message = this.e.message;

    let enemy = "";

    for (let i in message) {
      if (message[i].type == "at") {
        enemy = message[i].qq;
      }
    }
    return enemy;
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
        pkArr[this.group_id].set(String(key), pkMapJson[key]);
      }
    } catch (error) {
      logger.error(`json格式错误：${path}`);
      delete pkArr[this.group_id];
      return;
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

    return;
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
