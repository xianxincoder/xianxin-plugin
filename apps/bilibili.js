import plugin from "../../../lib/plugins/plugin.js";
import xxCfg from "../model/xxCfg.js";
import fs from "node:fs";
import fetch from "node-fetch";
import Bilibili from "../model/bilibili.js";

let bilibiliSetFile = "./plugins/xianxin-plugin/config/bilibili.set.yaml";
if (!fs.existsSync(bilibiliSetFile)) {
  fs.copyFileSync(
    "./plugins/xianxin-plugin/defSet/bilibili/set.yaml",
    bilibiliSetFile
  );
}

let bilibiliPushFile = "./plugins/xianxin-plugin/config/bilibili.push.yaml";
if (!fs.existsSync(bilibiliPushFile)) {
  fs.copyFileSync(
    "./plugins/xianxin-plugin/defSet/bilibili/push.yaml",
    bilibiliPushFile
  );
}

export class bilibili extends plugin {
  constructor() {
    super({
      name: "B站功能",
      dsc: "b站相关指令",
      event: "message.group",
      priority: 500,
      rule: [
        {
          reg: "^#up\\s*[0-9]*$",
          fnc: "detail",
        },
        {
          reg: "^#*(添加|订阅|新增|增加)up推送\\s*.*$",
          fnc: "addPush",
          permission: "master",
        },
        {
          reg: "^#*(删除|取消|移除|去除)up推送\\s*.*$",
          fnc: "delPush",
          permission: "master",
        },
        {
          reg: "^#推送(up)?列表$",
          fnc: "listPush",
          permission: "master",
        },
        {
          reg: "^#手动推送up$",
          fnc: "newPushTask",
          permission: "master",
        },
      ],
    });
    this.bilibiliSetData = xxCfg.getConfig("bilibili", "set");
    this.bilibiliPushData = xxCfg.getConfig("bilibili", "push");

    /** 定时任务 */
    this.task = {
      cron: !!this.bilibiliSetData.pushStatus
        ? this.bilibiliSetData.pushTime
        : "",
      name: "检测b站推送定时任务",
      fnc: () => this.newPushTask(),
      log: !!this.bilibiliSetData.pushTaskLog,
    };
  }

  async newPushTask() {
    let bilibili = new Bilibili(this.e);
    await bilibili.upTask();
  }

  /** 添加b站推送 */
  async addPush() {
    let uid = this.e.msg.replace(/#*(添加|订阅|新增|增加)up推送/g, "").trim();
    if (!uid) {
      this.e.reply(`请输入推送的uid\n示例：#添加up推送 401742377`);
      return true;
    }
    let data = this.bilibiliPushData || {};

    if (!data[this.e.group_id]) data[this.e.group_id] = new Array();

    const existUids = data[this.e.group_id].map((item) => item.uid || "");

    if (existUids.includes(uid)) {
      this.e.reply("这个uid已经添加过了");
      return;
    }

    const res = await new Bilibili(this.e).getBilibiliUserInfo(uid);

    if (!res.ok) {
      this.e.reply("诶嘿，出了点网络问题，等会再试试吧~");
      return;
    }

    const resJson = await res.json();

    if (resJson.code != 0 || !resJson?.data) {
      this.e.reply("uid不对啊老兄，别乱搞哦～");
      return;
    }

    data[this.e.group_id].push({ uid, name: resJson?.data.name });

    this.bilibiliPushData = data;

    xxCfg.saveSet("bilibili", "push", "config", data);

    this.e.reply(`添加b站推送成功~\n${resJson?.data.name}：${uid}`);
  }

  /** 删除b站推送 */
  async delPush() {
    let uid = this.e.msg.replace(/#*(删除|取消|移除|去除)up推送/g, "").trim();
    if (!uid) {
      this.e.reply(`请输入推送的uid\n示例：#删除up推送 401742377`);
      return true;
    }
    let data = this.bilibiliPushData || {};

    if (!data[this.e.group_id]) data[this.e.group_id] = new Array();

    data[this.e.group_id] = data[this.e.group_id].filter(
      (item) => item.uid !== uid
    );

    this.bilibiliPushData = data;

    xxCfg.saveSet("bilibili", "push", "config", data);

    this.e.reply(`删除b站推送成功~\n${uid}`);
  }

  /** b站推送列表 */
  async listPush() {
    let data = this.bilibiliPushData || {};
    if (!data[this.e.group_id]) data[this.e.group_id] = new Array();

    const messages = [];

    data[this.e.group_id].map((item) => {
      messages.push(`${item.uid}  ${item.name}`);
      return item;
    });

    this.e.reply(`推送列表如下：\n${messages.join("\n")}`);
  }

  async detail() {
    let uid = this.e.msg.replace(/#up/g, "").trim();

    const userRes = await fetch(
      `https://api.bilibili.com/x/relation/stat?vmid=${uid}`
    );
    const userResJsonData = await userRes.json();

    const accInfoRes = await fetch(
      `https://api.bilibili.com/x/space/acc/info?mid=${uid}&jsonp=jsonp`
    );

    if (!accInfoRes.ok) {
      this.reply("诶嘿，出了点网络问题，等会再试试吧~");
      return true;
    }

    const accInfoResJsonData = await accInfoRes.json();

    const data = accInfoResJsonData?.data || null;

    if (accInfoResJsonData.code != 0 || !data) {
      this.reply("UID不对啊老兄，别乱搞哦～");
      return true;
    }
    const message = [
      `昵称：${data.name}`,
      `\n性别：${data.sex}`,
      `\n等级：${data.level}`,
      `\n粉丝人数：${userResJsonData.data.follower}`,
    ];

    if (data.live_room) {
      message.push(
        `\n\n直播信息`,
        `\n直播标题：${accInfoResJsonData.data.live_room.title}`,
        `\n直播状态：${
          accInfoResJsonData.data.live_room.liveStatus ? "直播中" : "未开播"
        }`,
        `\n直播链接：${accInfoResJsonData.data.live_room.url}`
      );
      if (data.live_room.watched_show) {
        message.push(`\n观看人数：${data.live_room.watched_show.num}人`);
      }
    }

    this.reply(message);
  }
}
