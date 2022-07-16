import { segment } from "oicq";
import lodash from "lodash";
import fetch from "node-fetch";

export const rule = {
  bilibiliUpDetail: {
    reg: "^#up.*$", //匹配消息正则，命令正则
    priority: 5000, //优先级，越小优先度越高
    describe: "【#up+uid】查看up信息", //【命令】功能说明
  },
};

export async function bilibiliUpDetail(e) {
  let uid = e.msg.replace(/#up/g, "");

  if (uid.indexOf("道长") !== -1) {
    uid = 99744821;
  }

  const userRes = await fetch(
    `https://api.bilibili.com/x/relation/stat?vmid=${uid}`
  );
  const userResJsonData = await userRes.json();
  console.log(userResJsonData);

  const accInfoRes = await fetch(
    `https://api.bilibili.com/x/space/acc/info?mid=${uid}&jsonp=jsonp`
  );

  if (!accInfoRes.ok) {
    e.reply("诶嘿，出了点网络问题，等会再试试吧~");
    return true;
  }

  const accInfoResJsonData = await accInfoRes.json();

  const data = accInfoResJsonData?.data || null;

  if (accInfoResJsonData.code != 0 || !data) {
    e.reply("UID不对啊老兄，别乱搞哦～");
    return true;
  }

  const message = [
    segment.image(data.face),
    `\n昵称：${data.name}\n`,
    `性别：${data.sex}\n`,
    `等级：${data.level}\n`,
    `粉丝人数：${userResJsonData.data.follower}`,
  ];

  if (data.live_room) {
    message.push(
      `\n\n直播信息\n`,
      `直播标题：${accInfoResJsonData.data.live_room.title}\n`,
      `直播状态：${
        accInfoResJsonData.data.live_room.liveStatus ? "直播中" : "未开播"
      }\n`,
      `直播链接：${accInfoResJsonData.data.live_room.url}\n`,
      `直播封面：`,
      segment.image(accInfoResJsonData.data.live_room.cover)
    );
  }

  e.reply(message);

  return true; //返回true 阻挡消息不再往下
}
