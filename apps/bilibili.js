import plugin from "../../../lib/plugins/plugin.js";
import fetch from "node-fetch";
import { segment } from "oicq";

export class bilibili extends plugin {
  constructor() {
    super({
      name: "b站查询",
      dsc: "UID查询up信息",
      event: "message",
      priority: 500,
      rule: [
        {
          reg: "^#up.*$",
          fnc: "detail",
        },
      ],
    });
  }

  async detail() {
    let uid = this.e.msg.replace(/#up/g, "");

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
      `\n昵称：${data.name}`,
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
