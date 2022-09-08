import plugin from "../../../lib/plugins/plugin.js";
import { segment } from "oicq";

// 21点信息存放
let blackjaceState = {};

// 21点当前方 1自己 0对方
let count = {};

// 正在游戏的数据
let gameing = {};

// 定时器如果一段时间没有人回应那么清除进行中状态
let blackjackTimer = {};

let cards = {};

/**
 * 21点小游戏处理
 */
export class blackjack extends plugin {
  constructor(e) {
    super({
      name: "21点",
      dsc: "21点小游戏",
      event: "message.group",
      priority: 500,
      rule: [
        {
          reg: "^#*21(点)?$",
          fnc: "startBlackjack",
        },
        {
          reg: "^(#)?叫牌$",
          fnc: "deal",
        },
        {
          reg: "^(#)?停牌$",
          fnc: "stop",
        },
      ],
    });
  }

  /** 群号key */
  get grpKey() {
    return `Yz:bjgroup_id:${this.e.user_id}`;
  }

  /**
   * rule - #21点开局
   * @returns
   */
  async startBlackjack() {
    await this.getGroupId();
    if (!this.group_id) return;

    if (!gameing[this.group_id]) gameing[this.group_id] = {};

    if (gameing && gameing[this.group_id] && gameing[this.group_id].self) {
      this.e.reply("21点正在游戏中，请对局结束后再开局");
      return;
    }

    this.initArray();

    gameing[this.group_id].self = {
      user_id: this.e.sender.user_id,
      nick: this.e.sender.card || this.e.user_id,
    };

    const message = [
      `${this.e.sender.card || this.e.user_id} 发起了小游戏 21点！`,
      `\n任意玩家发送“叫牌”即可入局`,
    ];

    blackjackTimer[this.group_id] &&
      clearTimeout(blackjackTimer[this.group_id]);
    blackjackTimer[this.group_id] = setTimeout(() => {
      gameing[this.group_id] = {};
      count[this.group_id] = 0;
      blackjaceState[this.group_id] = {};
      this.e.reply("对战超时，已自动结束本局21点");
    }, 1000 * 60 * 3);

    this.e.reply(message);
  }

  /**
   * rule - #叫牌
   * @returns
   */
  async deal() {
    await this.getGroupId();
    if (!this.group_id) return;

    if (!gameing[this.group_id] || !gameing[this.group_id].self) {
      this.e.reply("当前没有进行中的21点小游戏，请发送 #21点 开一局吧");
      return;
    }

    if (
      count[this.group_id] == 1 &&
      gameing[this.group_id].self.user_id !== this.e.sender.user_id
    ) {
      this.e.reply([
        "本轮请",
        segment.at(
          gameing[this.group_id].self.user_id,
          gameing[this.group_id].self.nick
        ),
        "叫牌",
      ]);
      return;
    }

    if (
      gameing[this.group_id] &&
      gameing[this.group_id].self &&
      gameing[this.group_id].self.user_id !== this.e.sender.user_id &&
      !gameing[this.group_id].enemy
    ) {
      gameing[this.group_id].enemy = {
        user_id: this.e.sender.user_id,
        nick: this.e.sender.card || this.e.user_id,
      };
    }

    // 如果不是对战的两个人那么直接拦截
    if (
      ![
        gameing[this.group_id].self.user_id,
        (gameing[this.group_id].enemy &&
          gameing[this.group_id].enemy.user_id) ||
          "",
      ].includes(this.e.sender.user_id)
    ) {
      return;
    }

    if (
      count[this.group_id] == 0 &&
      ((gameing[this.group_id].enemy && gameing[this.group_id].enemy.user_id) ||
        "") !== this.e.sender.user_id
    ) {
      this.e.reply([
        "本轮请",
        !!gameing[this.group_id].enemy
          ? segment.at(
              gameing[this.group_id].enemy.user_id,
              gameing[this.group_id].enemy.nick
            )
          : "对方",
        "叫牌",
      ]);
      return;
    }

    // 获取纸牌
    const randomMax = Math.round(cards[this.group_id].length);

    let index = Math.floor(Math.random() * randomMax);

    const card = cards[this.group_id][index];

    cards[this.group_id].splice(index, 1);

    const state = blackjaceState[this.group_id];

    if (!state[this.e.sender.user_id])
      state[this.e.sender.user_id] = new Array();

    state[this.e.sender.user_id].push(card);

    const info = this.getRule(false);

    const msg = [];
    msg.push(segment.at(this.e.user_id, this.e.sender.card || this.e.user_id));
    msg.push(`本轮获取的纸牌：${card[0]}${card[1]}\n`);

    msg.push("当前纸牌情况：\n");

    let selfPoint = 0;
    if (state[this.e.sender.user_id] && state[this.e.sender.user_id].length) {
      state[this.e.sender.user_id].map((item, index) => {
        selfPoint += this.cardToNum(item[1]);
        msg.push(`${item[0]}${item[1]}`);
        if (index != state[this.e.sender.user_id].length - 1) {
          msg.push(" + ");
        }
      });
      msg.push(` = ${selfPoint}点`);
    }

    if (
      state[gameing[this.group_id].self.user_id] &&
      state[gameing[this.group_id].self.user_id].length
    ) {
      msg.push("\n对方纸牌情况：\n");
      let enemyPoint = 0;
      if (
        state[gameing[this.group_id].enemy.user_id] &&
        state[gameing[this.group_id].enemy.user_id].length
      ) {
        state[gameing[this.group_id].enemy.user_id].map((item, index) => {
          enemyPoint += this.cardToNum(item[1]);
          msg.push(`${item[0]}${item[1]}`);
          if (index != state[gameing[this.group_id].enemy.user_id].length - 1) {
            msg.push(" + ");
          }
        });
        msg.push(` = ${enemyPoint}点`);
      }
    }

    if (info != "gaming") {
      blackjackTimer[this.group_id] &&
        clearTimeout(blackjackTimer[this.group_id]);
      gameing[this.group_id] = {};
      count[this.group_id] = 0;
      blackjaceState[this.group_id] = new Array();
      let message = [];
      if (info == "爆掉") {
        message = [
          segment.at(this.e.user_id, this.e.sender.card || this.e.user_id),
          ` 爆掉，败北！\n`,
          ...msg,
        ];
      } else {
        // message = [
        //   info == "平局"
        //     ? `平局\n`
        //     : `${info.nick || info.user_id} 获得胜利，恭喜！\n`,
        //   ...msg,
        // ];

        if (info == "平局") {
          message.push("平局\n");
        } else {
          message.push(segment.at(info.user_id, info.nick || info.user_id));
          message.push(" 获得胜利，恭喜！\n");
        }
        message = message.concat(msg);
      }

      this.e.reply(message);
      return;
    }

    blackjackTimer[this.group_id] &&
      clearTimeout(blackjackTimer[this.group_id]);
    blackjackTimer[this.group_id] = setTimeout(() => {
      gameing[this.group_id] = {};
      count[this.group_id] = 0;
      blackjaceState[this.group_id] = new Array();
      this.e.reply("对战超时，已自动结束本局21点");
    }, 1000 * 60 * 3);

    msg.push("\n\n继续请发送“叫牌”，结束叫牌请发送“停牌”");

    this.e.reply(msg);
  }

  /**
   * rule - #停牌
   * @returns
   */
  async stop() {
    await this.getGroupId();
    if (!this.group_id) return;

    if (!gameing[this.group_id] || !gameing[this.group_id].self) {
      this.e.reply("当前没有进行中的21点小游戏，请发送 #21点 开一局吧");
      return;
    }

    if (
      count[this.group_id] == 1 &&
      gameing[this.group_id].self.user_id !== this.e.sender.user_id
    ) {
      this.e.reply([
        "本轮到",
        segment.at(
          gameing[this.group_id].self.user_id,
          gameing[this.group_id].self.nick
        ),
        "停牌",
      ]);
      return;
    }

    // 如果不是对战的两个人那么直接拦截
    if (
      ![
        gameing[this.group_id].self.user_id,
        (gameing[this.group_id].enemy &&
          gameing[this.group_id].enemy.user_id) ||
          "",
      ].includes(this.e.sender.user_id)
    ) {
      return;
    }

    if (
      count[this.group_id] == 0 &&
      ((gameing[this.group_id].enemy && gameing[this.group_id].enemy.user_id) ||
        "") !== this.e.sender.user_id
    ) {
      this.e.reply([
        "本轮到",
        !!gameing[this.group_id].enemy
          ? segment.at(
              gameing[this.group_id].enemy.user_id,
              gameing[this.group_id].enemy.nick
            )
          : "对方",
        "停牌",
      ]);
      return;
    }

    const state = blackjaceState[this.group_id];

    if (
      !(state[this.e.sender.user_id] && state[this.e.sender.user_id].length)
    ) {
      this.e.reply(["请至少叫牌一次，再进行停牌"]);
      return;
    }

    if (count[this.group_id] == 0) {
      count[this.group_id] = 1;
      this.e.reply([
        "当前已停牌，请",
        segment.at(
          gameing[this.group_id].self.user_id,
          gameing[this.group_id].self.nick
        ),
        "叫牌。",
      ]);
    } else {
      count[this.group_id] = 0;

      const info = this.getRule(true);
      const msg = [];
      msg.push(
        segment.at(this.e.user_id, this.e.sender.card || this.e.user_id)
      );

      msg.push("当前纸牌情况：\n");

      let selfPoint = 0;
      if (state[this.e.sender.user_id] && state[this.e.sender.user_id].length) {
        state[this.e.sender.user_id].map((item, index) => {
          selfPoint += this.cardToNum(item[1]);
          msg.push(`${item[0]}${item[1]}`);
          if (index != state[this.e.sender.user_id].length - 1) {
            msg.push(" + ");
          }
        });
        msg.push(` = ${selfPoint}点`);
      }

      if (
        state[gameing[this.group_id].self.user_id] &&
        state[gameing[this.group_id].self.user_id].length
      ) {
        msg.push("\n对方纸牌情况：\n");
        let enemyPoint = 0;
        if (
          state[gameing[this.group_id].enemy.user_id] &&
          state[gameing[this.group_id].enemy.user_id].length
        ) {
          state[gameing[this.group_id].enemy.user_id].map((item, index) => {
            enemyPoint += this.cardToNum(item[1]);
            msg.push(`${item[0]}${item[1]}`);
            if (
              index !=
              state[gameing[this.group_id].enemy.user_id].length - 1
            ) {
              msg.push(" + ");
            }
          });
          msg.push(` = ${enemyPoint}`);
        }
      }

      blackjackTimer[this.group_id] &&
        clearTimeout(blackjackTimer[this.group_id]);
      gameing[this.group_id] = {};
      count[this.group_id] = 0;
      blackjaceState[this.group_id] = new Array();

      let message = [];
      if (info == "爆掉") {
        message = [
          `${this.e.sender.card || this.e.user_id} 爆掉，败北！\n`,
          ...msg,
        ];
      } else {
        message = [
          info == "平局"
            ? `平局\n`
            : `${info.nick || info.user_id} 获得胜利，恭喜！\n`,
          ...msg,
        ];
      }
      this.e.reply(message);
      return;
    }
  }

  /**
   * 初始化21点数据
   */
  initArray() {
    blackjackTimer[this.group_id] &&
      clearTimeout(blackjackTimer[this.group_id]);
    gameing[this.group_id] = {};
    count[this.group_id] = 0;

    blackjaceState[this.group_id] = {};

    cards[this.group_id] = new Array();

    const points = ["A", 2, 3, 4, 5, 6, 7, 8, 9, 10, "J", "Q", "K"];

    cards[this.group_id] = cards[this.group_id].concat(
      points.map((p) => ["♠️", p]),
      points.map((p) => ["♣️", p]),
      points.map((p) => ["♥️", p]),
      points.map((p) => ["♠️", p])
    );
  }

  /**
   * 获取21点是否获胜
   * @returns
   */
  getRule(isStop) {
    const state = blackjaceState[this.group_id];

    const self = state[this.e.sender.user_id];

    const point = this.getPoint(self);

    if (point == 21) {
      return this.e.sender.user_id == gameing[this.group_id].self.user_id
        ? gameing[this.group_id].self
        : gameing[this.group_id].enemy;
    }

    if (point > 21) {
      return "爆掉";
    }

    if (isStop) {
      const enemy =
        this.e.sender.user_id == gameing[this.group_id].self.user_id
          ? state[gameing[this.group_id].enemy.user_id]
          : state[gameing[this.group_id].self.user_id];

      const enemyPoint = this.getPoint(enemy);

      if (point == enemyPoint) {
        return "平局";
      } else if (point > enemyPoint) {
        return this.e.sender.user_id == gameing[this.group_id].self.user_id
          ? gameing[this.group_id].self
          : gameing[this.group_id].enemy;
      } else {
        return this.e.sender.user_id == gameing[this.group_id].self.user_id
          ? gameing[this.group_id].enemy
          : gameing[this.group_id].self;
      }
    }

    return "gaming";
  }

  getPoint(cards) {
    let point = 0;
    if (cards && cards.length) {
      cards.map((item) => {
        point += this.cardToNum(item[1]);
      });
    }
    return point;
  }

  cardToNum(point) {
    let tempPoint = 0;
    switch (point) {
      case "J":
      case "Q":
      case "K":
        tempPoint = 10;
        break;
      case "A":
        tempPoint = 1;
        break;
      default:
        tempPoint = point;
    }
    return tempPoint;
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
