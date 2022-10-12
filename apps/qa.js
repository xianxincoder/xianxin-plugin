import plugin from "../../../lib/plugins/plugin.js";
import common from "../../../lib/common/common.js";
import fetch from "node-fetch";
import { segment } from "oicq";

let qaForSelectIndex = {};

export class qa extends plugin {
  constructor() {
    super({
      name: "QA问答",
      dsc: "QA问答",
      event: "message",
      priority: 1000,
      rule: [
        {
          reg: "^#*(QA|qa)问答$",
          fnc: "qa",
        },
      ],
    });
    this.qaRules = [
      {
        reg: "^#*选\\s*.*$",
        fuc: "qaForSelect",
        desc: "#选+数字 -- 切换问答",
      },
      {
        reg: "^#*提示$",
        fuc: "qaForTip",
        desc: "#提示  -- 问答提示",
      },
      {
        reg: "^#*换一题$",
        fuc: "qaForNext",
        desc: "#换一题  -- 换一个问题",
      },
      {
        reg: "^#*(结束|退出|停止)问答$",
        fuc: "stopQA",
        desc: "#结束问答 -- 结束问答状态",
      },
    ];

    this.qaList = [
      {
        title: "猜王者角色",
        type: "api",
        apiUrl: "https://xiaoapi.cn/API/game_cyx.php",
        answerPrefix: "我答",
        startText: "开始游戏",
      },
      {
        title: "填古诗词",
        type: "api",
        apiUrl: "http://api.xn--7gqa009h.top/api/tgs",
        answerPrefix: "我答",
        startText: "开始游戏",
      },
      {
        title: "知识答题",
        type: "select",
        apiUrl: "https://xiaoapi.cn/API/game_dati.php",
        answerPrefix: "我答",
        startText: "开始游戏",
      },
      {
        title: "挑战古诗词",
        type: "api",
        apiUrl: "https://xiaoapi.cn/API/game_gs.php",
        answerPrefix: "我答",
        startText: "开始游戏",
      },
      {
        title: "成语接龙",
        type: "api",
        apiUrl: "https://xiaoapi.cn/API/cyjl.php",
        answerPrefix: "我接",
        startText: "开始成语接龙",
      },
      {
        title: "看图猜成语",
        type: "api",
        apiUrl: "https://xiaoapi.cn/API/game_ktccy.php",
        answerPrefix: "我猜",
        startText: "开始游戏",
      },
      {
        title: "听歌猜歌名",
        type: "api",
        apiUrl: "https://xiaoapi.cn/API/caige.php",
        answerPrefix: "我猜",
        startText: "开始游戏",
      },
    ];
  }

  async qa() {
    this.setContext("doQA", this.e.isGroup, 30 * 60);
    await this.reply(
      `已进入QA问答状态，请按照序号选择QA问答，例如：#选1\n${this.qaList
        .map((item, index) => `${index + 1}. ${item.title}`)
        .join("\n")}`,
      false,
      {
        at: true,
      }
    );
  }

  async doQA() {
    let result = { status: true };

    for (let v of this.qaRules) {
      if (new RegExp(v.reg).test(this.e.msg)) {
        try {
          if (v.fuc) {
            let res = await eval("this." + v.fuc)(this);
            result = res;
          }
        } catch (error) {
          logger.error(error);
        }
      }
    }

    if (!result.status) {
      if (result.code === "finish") {
        this.finish("doQA", this.e.isGroup);
      }
      return;
    }

    const user_id = this.e.group_id || this.e.sender.user_id;

    if (!qaForSelectIndex[user_id]) {
      this.e.reply("请选择QA问答");
      return { status: false };
    }

    if (
      this.qaList[qaForSelectIndex[user_id] - 1].type == "select" &&
      !/^[0-9]$/.test(this.e.msg)
    ) {
      return { status: false };
    }

    const response = await fetch(
      `${this.qaList[qaForSelectIndex[user_id] - 1].apiUrl}?msg=${
        this.qaList[qaForSelectIndex[user_id] - 1].answerPrefix
      }${this.e.msg}&id=${user_id}`
    );

    let msg = [];

    if (
      this.qaList[qaForSelectIndex[user_id] - 1].apiUrl.indexOf(
        "game_ktccy"
      ) !== -1
    ) {
      const question = await response.json();
      msg = [question.data.msg];
      if (question.data.pic) {
        msg = [question.data.msg, "\n", segment.image(question.data.pic)];
      }
    } else if (
      this.qaList[qaForSelectIndex[user_id] - 1].apiUrl.indexOf("caige") !== -1
    ) {
      const question = await response.json();
      msg = [question.data.msg];

      await this.reply(msg);

      if (question.data.mp3) {
        await this.reply(segment.record(question.data.mp3));
      }

      return;
    } else if (this.qaList[qaForSelectIndex[user_id] - 1].type == "select") {
      const question = await response.json();
      msg = [question.data.msg, "\n", question.data.option];
    } else {
      const question = await response.text();
      msg = [question];
    }

    await this.reply(msg);
  }

  async qaForSelect(that) {
    const qaIndex = that.e.msg.replace(/#*选\s*/g, "") || 1;
    if (that.qaList.length < qaIndex) {
      that.reply("未检测到您选择的QA题目，请重新选择");
      return { status: false };
    }

    const prefix = `将要进行【${that.qaList[qaIndex - 1].title}】QA问答\n`;

    /** 回复 */
    await that.reply(
      `${prefix}您可以发送答案，或者其中内置的指令，如下\n${that.qaRules
        .map((item) => item.desc)
        .join("\n")}`
    );

    await common.sleep(600);

    const user_id = that.e.group_id || that.e.sender.user_id;

    qaForSelectIndex[user_id] = qaIndex;

    const response = await fetch(
      `${that.qaList[qaIndex - 1].apiUrl}?msg=${
        that.qaList[qaIndex - 1].startText
      }&id=${user_id}`
    );
    let msg = [];

    if (that.qaList[qaIndex - 1].apiUrl.indexOf("game_ktccy") !== -1) {
      const question = await response.json();
      msg = [question.data.msg];
      if (question.data.pic) {
        msg = [question.data.msg, "\n", segment.image(question.data.pic)];
      }
    } else if (that.qaList[qaIndex - 1].apiUrl.indexOf("caige") !== -1) {
      const question = await response.json();
      msg = [question.data.msg];

      await that.reply(msg);

      if (question.data.mp3) {
        await that.reply(segment.record(question.data.mp3));
      }

      return { status: false };
    } else if (that.qaList[qaIndex - 1].type == "select") {
      const question = await response.json();
      msg = [question.data.msg, "\n", question.data.option];
    } else {
      const question = await response.text();
      msg = [question];
    }

    await that.reply(msg);
    return { status: false };
  }

  async qaForTip(that) {
    const user_id = that.e.group_id || that.e.sender.user_id;

    if (that.qaList[qaForSelectIndex[user_id] - 1].type === "select") {
      await that.reply("啥？选择题还用提示？");
      return { status: false };
    }

    const response = await fetch(
      `${
        that.qaList[qaForSelectIndex[user_id] - 1].apiUrl
      }?msg=提示&id=${user_id}`
    );

    let msg = [];

    if (
      that.qaList[qaForSelectIndex[user_id] - 1].apiUrl.indexOf(
        "game_ktccy"
      ) !== -1
    ) {
      const tip = await response.json();
      msg = [tip.data.msg];
      if (tip.data.pic) {
        msg = [tip.data.msg, "\n", segment.image(tip.data.pic)];
      }
    } else if (
      that.qaList[qaForSelectIndex[user_id] - 1].apiUrl.indexOf("caige") !== -1
    ) {
      const tip = await response.json();
      msg = [tip.data.msg];
    } else {
      const tip = await response.text();
      if (tip.indexOf("这是TA的头像") !== -1) {
        const avatars = that.getJsonImages(tip);
        if (avatars && avatars.length) {
          await that.reply([tip, "\n", segment.image(avatars[0])]);
        } else {
          that.qaForTip(that);
        }

        return { status: false };
      }
      msg = [tip];
    }

    await that.reply(msg);
    return { status: false };
  }

  async qaForNext(that) {
    const user_id = that.e.group_id || that.e.sender.user_id;

    const response = await fetch(
      `${that.qaList[qaForSelectIndex[user_id] - 1].apiUrl}?msg=${
        that.qaList[qaForSelectIndex[user_id] - 1].startText
      }&id=${user_id}`
    );

    let msg = [];

    if (
      that.qaList[qaForSelectIndex[user_id] - 1].apiUrl.indexOf(
        "game_ktccy"
      ) !== -1
    ) {
      const question = await response.json();
      msg = [question.data.msg];
      if (question.data.pic) {
        msg = [question.data.msg, "\n", segment.image(question.data.pic)];
      }
    } else if (
      that.qaList[qaForSelectIndex[user_id] - 1].apiUrl.indexOf("caige") !== -1
    ) {
      const question = await response.json();
      msg = [question.data.msg];

      await that.reply(msg);

      if (question.data.mp3) {
        await that.reply(segment.record(question.data.mp3));
      }

      return { status: false };
    } else if (that.qaList[qaForSelectIndex[user_id] - 1].type == "select") {
      const question = await response.json();
      msg = [question.data.msg, "\n", question.data.option];
    } else {
      const question = await response.text();
      msg = [question];
    }

    await that.reply(msg);
    return { status: false };
  }

  async stopQA(that) {
    await that.e.reply("已结束问答状态");
    return { status: false, code: "finish" };
  }

  getJsonImages(string) {
    const imgRex = /https?:\/\/.*?\.(jpg|JPG|png|PNG|gif|GIF|jpeg|JPEG)/g;
    const images = [];
    let img;
    while ((img = imgRex.exec(string))) {
      images.push(encodeURI(img[0]));
    }
    return images;
  }
}
