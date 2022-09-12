import plugin from "../../../lib/plugins/plugin.js";
import { segment } from "oicq";
import Seecolor from "../model/seecolor.js";
import puppeteer from "../../../lib/puppeteer/puppeteer.js";
import common from "../../../lib/common/common.js";

// 给我点颜色看看信息存放
let seecolorState = {};

let scoreData = {};

// 正在游戏的数据
let gameing = {};

/**
 * 给我点颜色看看小游戏处理
 */
export class seecolor extends plugin {
  constructor(e) {
    super({
      name: "给我点颜色(看看)?",
      dsc: "根据色块找不同",
      event: "message.group",
      priority: 500,
      rule: [
        {
          reg: "^#*给我点颜色看看$",
          fnc: "startSeecolor",
        },
        {
          reg: "^#*块\\s*[0-9]*$",
          fnc: "click",
        },
      ],
    });
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

    console.log(data);

    let img = await puppeteer.screenshot("seecolor", {
      ...data,
      user_id: this.e.user_id,
    });

    const message = [
      `${this.e.sender.card || this.e.user_id} 发起了小游戏 给我点颜色看看！`,
      `任意玩家发送“块+数字”即可参与\n`,
      img,
    ];

    setTimeout(() => {
      if (scoreData[this.group_id]) {
        let arr = [];
        for (let [key, value] of scoreData[this.group_id]) {
          arr.push(value);
        }

        console.log(arr);
        arr = arr.sort((a, b) => {
          return b.score - a.score;
        });

        const scoreMessage = ["本局结束，得分如下"];

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
    }, 1000 * 60 * 1);

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
        user_id: this.e.user_id,
        score:
          scoreData[this.group_id].get(this.e.user_id).score +
          seecolorState[this.group_id].current *
            seecolorState[this.group_id].current,
        userName: this.e.sender.card || this.e.user_id,
      });
    } else {
      scoreData[this.group_id].set(this.e.user_id, {
        user_id: this.e.user_id,
        score:
          seecolorState[this.group_id].current *
          seecolorState[this.group_id].current,
        userName: this.e.sender.card || this.e.user_id,
      });
    }

    await this.e.reply(message);
    await common.sleep(600);

    this.next();
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

    this.e.reply(img);
  }

  /**
   * 初始化小游戏数据
   */
  initArray() {
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
