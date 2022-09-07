import plugin from "../../../lib/plugins/plugin.js";
import Gobang from "../model/gobang.js";
import puppeteer from "../../../lib/puppeteer/puppeteer.js";

// 五子棋信息存放
let gobangState = {};

// 五子棋当前棋子 0黑色 1 白色
let count = {};

// 正在游戏的数据
let gameing = {};

// 定时器如果一段时间没有人下棋那么清除五子棋进行中状态
let gobangTimer = {};

/**
 * 五子棋小游戏处理
 */
export class gobang extends plugin {
  constructor(e) {
    super({
      name: "五子棋",
      dsc: "五子棋小游戏",
      event: "message.group",
      priority: 500,
      rule: [
        {
          reg: "^#五子棋$",
          fnc: "startGobang",
        },
        {
          reg: "^(#)?落子[A-Za-z]+[0-9]+$",
          fnc: "drop",
        },
        {
          reg: "^#弃子$",
          fnc: "admitDefeat",
        },
      ],
    });
  }

  /** 群号key */
  get grpKey() {
    return `Yz:gbgroup_id:${this.e.user_id}`;
  }

  /**
   * rule - #五子棋开局
   * @returns
   */
  async startGobang() {
    await this.getGroupId();
    if (!this.group_id) return;

    if (!gameing[this.group_id]) gameing[this.group_id] = {};

    if (gameing && gameing[this.group_id] && gameing[this.group_id].self) {
      this.e.reply("五子棋正在游戏中，请对局结束后再开局");
      return;
    }

    this.initArray();

    const state = gobangState[this.group_id];

    gameing[this.group_id].self = { user_id: this.e.sender.user_id };

    const data = await new Gobang(this.e).getGobangData({
      gobangData: JSON.stringify({ state: state }),
    });

    let img = await puppeteer.screenshot("gobang", {
      ...data,
      user_id: this.e.user_id,
    });

    const message = [
      `${this.e.sender.card || this.e.user_id} 发起了小游戏 五子棋！`,
      `\n发送“落子+字母+数字”下棋，如“落子A1”\n`,
      img,
    ];

    gobangTimer[this.group_id] && clearTimeout(gobangTimer[this.group_id]);
    gobangTimer[this.group_id] = setTimeout(() => {
      gameing[this.group_id] = {};
      count[this.group_id] = 0;
      gobangState[this.group_id] = new Array();
      this.e.reply("对战超时，已自动结束本局#五子棋");
    }, 1000 * 60 * 3);

    this.e.reply(message);
  }

  /**
   * rule - #落子
   * @returns
   */
  async drop() {
    await this.getGroupId();
    if (!this.group_id) return;

    if (!gameing[this.group_id] || !gameing[this.group_id].self) {
      this.e.reply("当前没有进行中的五子棋小游戏，发送#五子棋，开一局吧");
      return;
    }

    if (
      count[this.group_id] == 0 &&
      gameing[this.group_id].self.user_id !== this.e.sender.user_id
    ) {
      this.e.reply("本轮请黑棋落子");
      return;
    }

    if (
      gameing[this.group_id] &&
      gameing[this.group_id].self &&
      gameing[this.group_id].self.user_id !== this.e.sender.user_id &&
      !gameing[this.group_id].enemy
    ) {
      gameing[this.group_id].enemy = { user_id: this.e.sender.user_id };
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
      count[this.group_id] == 1 &&
      ((gameing[this.group_id].enemy && gameing[this.group_id].enemy.user_id) ||
        "") !== this.e.sender.user_id
    ) {
      this.e.reply("本轮请白棋落子");
      return;
    }

    const position = this.e.msg.replace("#", "").replace("落子", "").trim();

    let y = position.substr(0, 1).toUpperCase();
    const x = position.slice(1) - 1;

    y = Number(y.charCodeAt(0) - 65);

    if (x < 0 || x > 15 || y < 0 || y > 15) {
      this.e.reply("落子失败，不是有效棋盘位置");
      return;
    }

    if (gobangState[this.group_id][x][y] != -1) {
      this.e.reply("该位置已落子，请选择其他位置落子");
      return;
    }

    this.dropArray({ x, y });

    const data = await new Gobang(this.e).getGobangData({
      gobangData: JSON.stringify({
        state: gobangState[this.group_id],
        current: { x, y },
      }),
    });

    let img = await puppeteer.screenshot("gobang", {
      ...data,
      user_id: this.e.user_id,
    });

    const info = this.getRule(x, y);

    if (count[this.group_id] == 0) {
      count[this.group_id] = 1;
    } else {
      count[this.group_id] = 0;
    }

    if (info != "gaming") {
      gobangTimer[this.group_id] && clearTimeout(gobangTimer[this.group_id]);
      gameing[this.group_id] = {};
      count[this.group_id] = 0;
      gobangState[this.group_id] = new Array();

      const message = [
        `${this.e.sender.card || this.e.user_id} 获得胜利，恭喜！`,
        img,
      ];
      this.e.reply(message);
      return;
    }

    gobangTimer[this.group_id] && clearTimeout(gobangTimer[this.group_id]);
    gobangTimer[this.group_id] = setTimeout(() => {
      gameing[this.group_id] = {};
      count[this.group_id] = 0;
      gobangState[this.group_id] = new Array();
      this.e.reply("对战超时，已自动结束本局#五子棋");
    }, 1000 * 60 * 3);

    this.e.reply(img);
  }

  /**
   * rule - #弃子认输
   * @returns
   */
  async admitDefeat() {
    await this.getGroupId();
    if (!this.group_id) return;

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

    gobangTimer[this.group_id] && clearTimeout(gobangTimer[this.group_id]);

    gameing[this.group_id] = {};
    count[this.group_id] = 0;
    gobangState[this.group_id] = new Array();

    await this.e.reply(
      `${this.e.sender.card || this.e.user_id} 认输，本轮五子棋结束！`
    );
  }

  /**
   * 初始化五子棋数据
   */
  initArray() {
    gobangTimer[this.group_id] && clearTimeout(gobangTimer[this.group_id]);
    gameing[this.group_id] = {};
    count[this.group_id] = 0;
    if (!gobangState[this.group_id]) gobangState[this.group_id] = new Array();
    for (var i = 0; i < 15; i++) {
      gobangState[this.group_id][i] = new Array();
      for (var j = 0; j < 15; j++) {
        gobangState[this.group_id][i][j] = -1;
      }
    }
  }

  /**
   * 落子后改变Array数据
   * @param {object} position x - x轴位置 y - y轴位置
   */
  dropArray(position) {
    if (!gobangState[this.group_id]) gobangState[this.group_id] = new Array();

    const { x, y } = position;

    for (var i = 0; i < 15; i++) {
      if (!gobangState[this.group_id][i])
        gobangState[this.group_id][i] = new Array();
      for (var j = 0; j < 15; j++) {
        if (y == j && x == i) {
          gobangState[this.group_id][i][j] = count[this.group_id];
        }
      }
    }
  }

  /**
   * 获取五子棋落子是否获胜
   * @param {number} ix 落子x轴位置
   * @param {number} iy 落子y轴位置
   * @returns
   */
  getRule(ix, iy) {
    const state = gobangState[this.group_id];
    const s = count[this.group_id];
    var hc = 0,
      vc = 0,
      rdc = 0,
      luc = 0;
    /** 横向连珠数量 */
    for (var i = ix; i < 15; i++) {
      if (state[i][iy] != s) {
        break;
      }
      hc++;
    }
    for (var i = ix - 1; i >= 0; i--) {
      if (state[i][iy] != s) {
        break;
      }
      hc++;
    }
    /** 竖向连珠数量 */
    for (var j = iy; j < 15; j++) {
      if (state[ix][j] != s) {
        break;
      }
      vc++;
    }
    for (var j = iy - 1; j >= 0; j--) {
      if (state[ix][j] != s) {
        break;
      }
      vc++;
    }
    /** 斜向连珠数量 */
    for (var i = ix, j = iy; i < 15 && j < 15; i++, j++) {
      if (state[i][j] != s) {
        break;
      }
      rdc++;
    }
    for (var i = ix - 1, j = iy - 1; i >= 0 && j >= 0; i--, j--) {
      if (state[i][j] != s) {
        break;
      }
      rdc++;
    }
    for (var i = ix, j = iy; i < 15 && j >= 0; i++, j--) {
      if (state[i][j] != s) {
        break;
      }
      luc++;
    }
    for (var i = ix - 1, j = iy + 1; i >= 0 && j < 15; i--, j++) {
      if (state[i][j] != s) {
        break;
      }
      luc++;
    }
    if (hc >= 5 || vc >= 5 || rdc >= 5 || luc >= 5) {
      if (s == 0) {
        return gameing[this.group_id].self;
      } else {
        return gameing[this.group_id].enemy;
      }
    }

    return "gaming";
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
