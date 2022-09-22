import plugin from "../../../lib/plugins/plugin.js";
import { segment } from "oicq";
import fs from "node:fs";
import lodash from "lodash";
import Glgg from "../model/glgg.js";
import puppeteer from "../../../lib/puppeteer/puppeteer.js";
import common from "../../../lib/common/common.js";
import xxCfg from "../model/xxCfg.js";

const _path = process.cwd().replace(/\\/g, "/");

const resPath = `${_path}/plugins/xianxin-plugin/resources/`;

// glgg玩家信息存放
let glggArr = {};

// 数据 {user_id: {virtualArr: [], initBeenStoredArr: [], images: [], current: 1}}
let glggState = {};

/**
 * 寄了个寄小游戏处理
 */
export class glgg extends plugin {
  constructor(e) {
    super({
      name: "g了个g",
      dsc: "根据羊了个羊改编",
      event: "message",
      priority: 500,
      rule: [
        {
          reg: "^#*(寄|g)了个(寄|g)$",
          fnc: "startGlgg",
        },
        {
          reg: "^#*(寄|g)\\s*[0-9]*$",
          fnc: "click",
        },
        {
          reg: "^#*(寄|g)了个榜$",
          fnc: "colorRank",
        },
      ],
    });
    this.path = "./data/glggJson/";
    this.gameSetData = xxCfg.getConfig("game", "set");
  }

  async init() {
    if (!fs.existsSync(this.path)) {
      fs.mkdirSync(this.path);
    }
  }

  async startGlgg() {
    this.initData(1);

    const state = glggState[this.e.user_id];

    const data = await new Glgg(this.e).getGlggData({
      glggData: JSON.stringify({ state: state }),
    });

    let img = await puppeteer.screenshot("glgg", {
      ...data,
      user_id: this.e.user_id,
    });

    this.e.reply(img);
  }

  async click() {
    this.e.reply("画饼待填");
  }

  async glggRank() {
    this.e.reply("画饼待填");
  }

  initData(current) {
    glggState[this.e.user_id] = {
      current: current || 1,
      images: [],
      virtualArr: [],
      initBeenStoredArr: [],
    };

    const randomIndexArr = [1, 2, 3, 4, 5, 6, 7];
    randomIndexArr.map((item) => {
      glggState[this.e.user_id].images.push(`${resPath}img/glgg/${item}.png`);
    });

    for (let index = 0; index < 14 + current; index++) {
      // 保存打乱的数组
      glggState[this.e.user_id].virtualArr.push(
        ...glggState[this.e.user_id].images.sort(() =>
          Math.random() > 0.5 ? -1 : 1
        )
      );
    }
  }

  getRandomNum(min, max, countNum) {
    var arr = [];
    for (let i = 0; i < countNum; i++) {
      var number = Math.floor(Math.random() * (max - min) + min);
      if (arr.indexOf(number) == -1) {
        //去除重复项
        arr.push(number);
      } else {
        i--;
      }
      return arr;
    }
  }

  initGlggArr() {
    glggArr[Bot] = new Map();

    let path = `${this.path}${Bot.uin}.json`;
    if (!fs.existsSync(path)) {
      return;
    }

    try {
      let colorMapJson = JSON.parse(fs.readFileSync(path, "utf8"));
      for (let key in colorMapJson) {
        glggArr[Bot.uin].set(String(key), colorMapJson[key]);
      }
      return;
    } catch (error) {
      logger.error(`json格式错误：${path}`);
      delete glggArr[Bot.uin];
      return;
    }
  }

  /** 保存json文件 */
  saveJson() {
    let obj = {};
    for (let [k, v] of glggArr[Bot.uin]) {
      obj[k] = v;
    }

    fs.writeFileSync(
      `${this.path}${Bot.uin}.json`,
      JSON.stringify(obj, "", "\t")
    );
  }

  /**
   * 初始化小游戏数据
   */
  initArray() {
    scoreData = {};
    seecolorState[Bot.uin] = { current: 2, randomNum: 0 };
  }
}
