import plugin from "../../../lib/plugins/plugin.js";
import { segment } from "oicq";
import fs from "node:fs";
import Game from "../model/game.js";
import lodash from "lodash";
import Seecolor from "../model/seecolor.js";
import puppeteer from "../../../lib/puppeteer/puppeteer.js";
import common from "../../../lib/common/common.js";
import xxCfg from "../model/xxCfg.js";

// 给我点颜色看看信息存放
let seecolorState = {};

let scoreData = {};

// 正在游戏的数据
let gameing = {};

// 定时器如果一段时间没有人回应那么清除进行中状态
let seecolorTimer = {};

// color信息存放
let colorArr = {};

/**
 * 给我点颜色看看小游戏处理
 */
export class seecolor extends plugin {
  constructor(e) {
    super({
      name: "给我点颜色看看",
      dsc: "根据色块找不同",
      event: "message.group",
      priority: 500,
      rule: [
        {
          reg: "^#*给我点颜色(看看)?$",
          fnc: "startSeecolor",
        },
        {
          reg: "^#*块\\s*[0-9]*$",
          fnc: "click",
        },
        {
          reg: "^#*色榜$",
          fnc: "colorRank",
        },
      ],
    });
    this.path = "./data/colorJson/";
    this.gameSetData = xxCfg.getConfig("game", "set");
  }

  async init() {
    if (!fs.existsSync(this.path)) {
      fs.mkdirSync(this.path);
    }
  }

  /** 群号key */
  get grpKey() {
    return `Yz:scgroup_id:${this.e.user_id}`;
  }

  /**
   * rule - #给我点颜色看看开局
   * @returns
   */
  async startSeecolor() {
    await this.getGroupId();
    if (!this.group_id) return;

    if (!gameing[this.group_id]) gameing[this.group_id] = false;

    if (gameing && gameing[this.group_id]) {
      this.e.reply("给我点颜色看看正在游戏中，请对局结束后再开局");
      return;
    }

    this.initArray();

    let tempRandomNum = Math.floor(
      Math.random() *
        (seecolorState[this.group_id].current *
          seecolorState[this.group_id].current)
    );

    seecolorState[this.group_id].randomNum = tempRandomNum;

    const state = seecolorState[this.group_id];

    const data = await new Seecolor(this.e).getSeecolorData({
      seecolorData: JSON.stringify({ state: state }),
    });

    let img = await puppeteer.screenshot("seecolor", {
      ...data,
      user_id: this.e.user_id,
    });

    const message = [
      `${this.e.sender.card || this.e.user_id} 发起了小游戏 给我点颜色看看！`,
      `任意玩家发送“块+数字”即可参与\n`,
      img,
    ];

    seecolorTimer[this.group_id] && clearTimeout(seecolorTimer[this.group_id]);
    seecolorTimer[this.group_id] = setTimeout(async () => {
      if (scoreData[this.group_id]) {
        let arr = [];
        for (let [key, value] of scoreData[this.group_id]) {
          arr.push(value);
        }

        arr = arr.sort((a, b) => {
          return b.score - a.score;
        });

        this.sortHandle();

        const scoreMessage = [
          `很遗憾${
            this.gameSetData.seecolorOverTime || 45
          }s内没有人答对，本局结束。\n本局答案为：块${
            seecolorState[this.group_id].randomNum + 1
          }，得分排名如下`,
        ];

        arr.map((item) => {
          scoreMessage.push(`${item.userName} ${item.score}分`);
          return item;
        });

        this.e.reply(scoreMessage.join("\n"));
      } else {
        this.e.reply("游戏已结束，没有玩家得分");
      }

      gameing[this.group_id] = false;
      scoreData = {};
      seecolorState[this.group_id] = { current: 2, randomNum: 0 };
    }, 1000 * (this.gameSetData.seecolorOverTime || 45));

    this.e.reply(message);
  }

  /**
   * rule - #选择色块
   * @returns
   */
  async click() {
    await this.getGroupId();
    if (!this.group_id) return;

    if (!gameing[this.group_id]) {
      this.e.reply(
        "当前没有进行中的给我点颜色看看小游戏，请发送 #给我点颜色看看 开一局吧"
      );
      return;
    }

    const position = this.e.msg.replace(/#*块\s*/g, "") || 0;

    if (seecolorState[this.group_id].randomNum != Number(position) - 1) {
      return;
    }

    const message = [
      segment.at(this.e.user_id, this.e.sender.card || this.e.user_id),
      `猜对啦，获得积分${
        seecolorState[this.group_id].current *
        seecolorState[this.group_id].current
      }分`,
    ];

    if (!scoreData[this.group_id]) scoreData[this.group_id] = new Map();

    if (scoreData[this.group_id].has(this.e.user_id)) {
      scoreData[this.group_id].set(this.e.user_id, {
        user_id: String(this.e.user_id),
        score:
          scoreData[this.group_id].get(this.e.user_id).score +
          seecolorState[this.group_id].current *
            seecolorState[this.group_id].current,
        userName: this.e.sender.card || this.e.user_id,
      });
    } else {
      scoreData[this.group_id].set(this.e.user_id, {
        user_id: String(this.e.user_id),
        score:
          seecolorState[this.group_id].current *
          seecolorState[this.group_id].current,
        userName: this.e.sender.card || this.e.user_id,
      });
    }

    seecolorTimer[this.group_id] && clearTimeout(seecolorTimer[this.group_id]);
    seecolorTimer[this.group_id] = setTimeout(async () => {
      if (scoreData[this.group_id]) {
        let arr = [];
        for (let [key, value] of scoreData[this.group_id]) {
          arr.push(value);
        }

        arr = arr.sort((a, b) => {
          return b.score - a.score;
        });

        this.sortHandle();

        const scoreMessage = [
          `很遗憾${
            this.gameSetData.seecolorOverTime || 45
          }s内没有人答对，本局结束。\n本局答案为：块${
            seecolorState[this.group_id].randomNum + 1
          }，得分排名如下`,
        ];

        arr.map((item) => {
          scoreMessage.push(`${item.userName} ${item.score}分`);
          return item;
        });

        this.e.reply(scoreMessage.join("\n"));
      } else {
        this.e.reply("游戏已结束，没有玩家得分");
      }

      gameing[this.group_id] = false;
      scoreData = {};
      seecolorState[this.group_id] = { current: 2, randomNum: 0 };
    }, 1000 * (this.gameSetData.seecolorOverTime || 45));

    this.e.reply(message);

    await this.next();
  }

  async next() {
    seecolorState[this.group_id].current += 1;
    let tempRandomNum = Math.floor(
      Math.random() *
        (seecolorState[this.group_id].current *
          seecolorState[this.group_id].current)
    );

    seecolorState[this.group_id].randomNum = tempRandomNum;

    const state = seecolorState[this.group_id];

    const data = await new Seecolor(this.e).getSeecolorData({
      seecolorData: JSON.stringify({ state: state }),
    });

    let img = await puppeteer.screenshot("seecolor", {
      ...data,
      user_id: this.e.user_id,
    });

    await common.sleep(600);

    this.e.reply(img);
  }

  async colorRank() {
    await this.getGroupId();
    if (!this.group_id) return;

    const players = this.getPlayers();

    if (!players || !players.length) {
      this.reply(`未找到玩家数据`);
      return;
    }

    const sortScorePlayers = players.sort(function (a, b) {
      return b.score - a.score;
    });

    const data = await new Game(this.e).getRankData(
      sortScorePlayers.slice(0, this.gameSetData.limitTop || 20)
    );

    let img = await puppeteer.screenshot("rank", {
      ...data,
      type: "color",
      limitTop: this.gameSetData.limitTop || 20,
    });
    this.e.reply(img);
  }

  sortHandle() {
    const currentPlayers = [];
    for (let [key, value] of scoreData[this.group_id]) {
      currentPlayers.push(value);
    }

    const players = this.getPlayers() || [];

    const allPlayers = [...players, ...currentPlayers];

    let sortScorePlayers = allPlayers.sort(function (a, b) {
      return b.score - a.score;
    });

    sortScorePlayers = lodash.uniqBy(sortScorePlayers, "user_id");

    sortScorePlayers.map((item) => {
      colorArr[this.group_id].set(String(item.user_id), item);
    });

    this.saveJson();
  }

  getPlayers() {
    this.initColorArr();

    if (!colorArr[this.group_id]) colorArr[this.group_id] = new Map();

    let playerArr = [];

    for (let [k, v] of colorArr[this.group_id]) {
      playerArr.push({ ...v, user_id: k });
    }
    return playerArr;
  }

  /** 初始化群战信息 */
  initColorArr() {
    colorArr[this.group_id] = new Map();

    let path = `${this.path}${this.group_id}.json`;
    if (!fs.existsSync(path)) {
      return;
    }

    try {
      let colorMapJson = JSON.parse(fs.readFileSync(path, "utf8"));
      for (let key in colorMapJson) {
        colorArr[this.group_id].set(String(key), colorMapJson[key]);
      }
      return;
    } catch (error) {
      logger.error(`json格式错误：${path}`);
      delete colorArr[this.group_id];
      return;
    }
  }

  /** 保存json文件 */
  saveJson() {
    let obj = {};
    for (let [k, v] of colorArr[this.group_id]) {
      obj[k] = v;
    }

    fs.writeFileSync(
      `${this.path}${this.group_id}.json`,
      JSON.stringify(obj, "", "\t")
    );
  }

  /**
   * 初始化小游戏数据
   */
  initArray() {
    seecolorTimer[this.group_id] && clearTimeout(seecolorTimer[this.group_id]);
    gameing[this.group_id] = true;
    scoreData = {};
    seecolorState[this.group_id] = { current: 2, randomNum: 0 };
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
}
