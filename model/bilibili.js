import moment from "moment";
import lodash from "lodash";
import xxCfg from "../model/xxCfg.js";
import { segment } from "oicq";
import base from "./base.js";
import fetch from "node-fetch";
import common from "../../../lib/common/common.js";

export default class Bilibili extends base {
  constructor(e) {
    super(e);
  }

  async getBilibiliUserInfo(uid) {
    let url = `https://api.bilibili.com/x/space/acc/info?mid=${uid}&jsonp=jsonp`;
    const response = await fetch(url, { method: "get" });
    return response;
  }

  async getBilibiliDynamicInfo(uid) {
    let url = `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?host_mid=${uid}`;
    const response = await fetch(url, { method: "get" });
    return response;
  }

  async getBilibiliUp(keyword) {
    let url = `https://api.bilibili.com/x/web-interface/search/type?keyword=${keyword}&page=1&search_type=bili_user&order=totalrank&pagesize=5`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        authority: "api.bilibili.com",
        cookie:
          "_uuid=04A91AF9-817E-5568-C260-F738C6992B3E65500infoc; buvid3=89F4F8FC-EC89-F339-53E0-BEB8917E839A65849infoc; buvid4=2D3B9929-A59A-751A-A267-64B84561875568042-022072912-ptQYXgw9NYmp0JTqr/FVmw%3D%3D; PVID=1; CURRENT_FNVAL=4048; nostalgia_conf=-1; i-wanna-go-back=-1; b_ut=7; innersign=0; b_lsid=D95BBB69_182DE35FC2B; fingerprint=8d0ef00128271df9bb681430277b95d0; buvid_fp_plain=undefined; buvid_fp=8d0ef00128271df9bb681430277b95d0",
        "User-Agent": "apifox/1.0.0 (https://www.apifox.cn)",
      },
      redirect: "follow",
    });
    return response;
  }

  async upTask() {
    let setData = xxCfg.getConfig("bilibili", "set");
    let pushData = xxCfg.getConfig("bilibili", "push");

    // 推送2小时内的B站动态
    let interval = 7200;

    // 存放直播状态信息
    let lastLiveStatusInfo = {};

    let lastTemp = await redis.get("xianxin:bililive:lastlivestatus");

    if (lastTemp) {
      lastLiveStatusInfo = JSON.parse(lastTemp);
    }

    const uidMap = new Map();

    // 存放获取的所有动态 key为uid value为数组
    const dynamicList = {};
    for (let key in pushData) {
      const ups = pushData[key] || [];
      for (let up of ups) {
        if (!lastTemp) {
          lastLiveStatusInfo[`${up.uid}`] = 0;
        }

        const response = await this.getBilibiliDynamicInfo(up.uid);

        if (response.ok) {
          const res = await response.json();
          if (res.code == 0) {
            const dynamicData = res?.data?.items || [];
            dynamicList[up.uid] = dynamicData;
          }
        }
        uidMap.set(up.uid, {
          groupIds: Array.from(
            new Set([
              ...((uidMap.get(up.uid) && uidMap.get(up.uid).groupIds) || []),
              key,
            ])
          ),
          upName: up.name,
          type: up.type || [],
        });

        await common.sleep(2000);
      }
    }

    let now = Date.now() / 1000;

    this.key = "Yz:xianxin:bilibili:upPush:";

    for (let [key, value] of uidMap) {
      const accInfoRes = await fetch(
        `https://api.bilibili.com/x/space/acc/info?mid=${key}&jsonp=jsonp`
      );

      const tempDynamicList = dynamicList[key] || [];

      const willPushDynamicList = [];

      for (let dynamicItem of tempDynamicList) {
        let author = dynamicItem?.modules?.module_author || {};
        if (!author?.pub_ts) continue;
        if (Number(now - author.pub_ts) > interval) {
          continue;
        }
        if (dynamicItem.type == "DYNAMIC_TYPE_LIVE_RCMD") {
          continue;
        }
        willPushDynamicList.push(dynamicItem);
      }

      const pushMapInfo = value || {};

      const { groupIds, upName, type } = pushMapInfo;

      if (accInfoRes.ok) {
        const accInfoResJsonData = await accInfoRes.json();

        const data = accInfoResJsonData?.data || null;
        if (data && data.live_room) {
          if (
            `${lastLiveStatusInfo[key] || 0}${data.live_room.liveStatus}` ==
            "01"
          ) {
            willPushDynamicList.push({
              id_str: `${new Date().getTime()}`,
              type: "DYNAMIC_TYPE_LIVE_RCMD",
              title: data.live_room.title,
              url: this.resetLinkUrl(data.live_room.url),
              cover: data.live_room.cover,
            });
          }
          lastLiveStatusInfo[key] = data.live_room.liveStatus;

          await redis.set(
            "xianxin:bililive:lastlivestatus",
            JSON.stringify(lastLiveStatusInfo),
            { EX: 60 * 60 }
          );
        }
      }

      for (let pushDynamicData of willPushDynamicList) {
        if (groupIds && groupIds.length) {
          for (let groupId of groupIds) {
            /** 如果禁用了type那么不发送指令 */
            if (type && type.length && !type.includes(pushDynamicData.type)) {
              continue;
            }

            await this.sendDynamic(groupId, upName, pushDynamicData, setData);
          }
        }
      }
      await common.sleep(1000);
    }
  }

  async sendDynamic(groupId, upName, pushDynamicData, setData) {
    const id_str = pushDynamicData.id_str;

    let sended = await redis.get(`${this.key}${groupId}:${id_str}`);
    if (sended) return;

    this.e.group = Bot.pickGroup(Number(groupId));

    const dynamicMsg = this.buildSendDynamic(
      upName,
      pushDynamicData,
      false,
      setData
    );

    redis.set(`${this.key}${groupId}:${id_str}`, "1", { EX: 3600 * 10 });

    if (dynamicMsg == "continue") {
      return "return";
    }

    // 包含关键字不推送
    let banWords = eval(`/${setData.banWords.join("|")}/g`);
    if (new RegExp(banWords).test(dynamicMsg.join(""))) {
      return "return";
    }
    await this.e.group.sendMsg(dynamicMsg);
    await common.sleep(1000);
  }

  // 构建动态消息
  buildSendDynamic(upName, dynamic, isForward, setData) {
    const BiliDrawDynamicLinkUrl = "https://m.bilibili.com/dynamic/";
    let desc, msg, pics, author;
    let title = `B站【${upName}】动态推送：\n`;

    // 以下对象结构参考米游社接口，接口在顶部定义了
    switch (dynamic.type) {
      case "DYNAMIC_TYPE_AV":
        desc = dynamic?.modules?.module_dynamic?.major?.archive;
        author = dynamic?.modules?.module_author;
        if (!desc && !author) return;

        title = `B站【${upName}】视频动态推送：\n`;
        // 视频动态仅由标题、封面、链接组成
        msg = [
          title,
          `-----------------------------\n`,
          `标题：${desc.title}\n`,
          `${desc.desc}\n`,
          `链接：${this.resetLinkUrl(desc.jump_url)}\n`,
          `时间：${
            author
              ? moment(author.pub_ts * 1000).format("YYYY年MM月DD日 HH:mm:ss")
              : ""
          }\n`,
          segment.image(desc.cover),
        ];

        return msg;
      case "DYNAMIC_TYPE_WORD":
        desc = dynamic?.modules?.module_dynamic?.desc;
        author = dynamic?.modules?.module_author;
        if (!desc && !author) return;

        title = `B站【${upName}】动态推送：\n`;
        msg = [
          title,
          `-----------------------------\n`,
          `内容：${this.dynamicContentLimit(desc.text, setData)}\n`,
          `链接：${BiliDrawDynamicLinkUrl}${dynamic.id_str}\n`,
          `时间：${
            author
              ? moment(author.pub_ts * 1000).format("YYYY年MM月DD日 HH:mm:ss")
              : ""
          }`,
        ];

        return msg;
      case "DYNAMIC_TYPE_DRAW":
        desc = dynamic?.modules?.module_dynamic?.desc;
        pics = dynamic?.modules?.module_dynamic?.major?.draw?.items;
        author = dynamic?.modules?.module_author;
        if (!desc && !pics && !author) return;

        const DynamicPicCountLimit = setData.pushPicCountLimit || 3;

        if (pics.length > DynamicPicCountLimit)
          pics.length = DynamicPicCountLimit; // 最多发DynamicPicCountLimit张图，不然要霸屏了

        pics = pics.map((item) => {
          return segment.image(item.src);
        });

        title = `B站【${upName}】图文动态推送：\n`;
        // 图文动态由内容（经过删减避免过长）、图片、链接组成
        msg = [
          title,
          `-----------------------------\n`,
          `${this.dynamicContentLimit(desc.text, setData)}\n`,
          `链接：${BiliDrawDynamicLinkUrl}${dynamic.id_str}\n`,
          `时间：${
            author
              ? moment(author.pub_ts * 1000).format("YYYY年MM月DD日 HH:mm:ss")
              : ""
          }\n`,
          ...pics,
        ];

        return msg;
      case "DYNAMIC_TYPE_ARTICLE":
        desc = dynamic?.modules?.module_dynamic?.major?.article;
        author = dynamic?.modules?.module_author;
        if (!desc && !author) return;

        pics = [];
        if (desc.covers && desc.covers.length) {
          pics = desc.covers.map((item) => {
            return segment.image(item);
          });
        }

        title = `B站【${upName}】文章动态推送：\n`;
        // 专栏/文章动态由标题、图片、链接组成
        msg = [
          title,
          `-----------------------------\n`,
          `标题：${desc.title}\n`,
          `链接：${this.resetLinkUrl(desc.jump_url)}\n`,
          `时间：${
            author
              ? moment(author.pub_ts * 1000).format("YYYY年MM月DD日 HH:mm:ss")
              : ""
          }\n`,
          ...pics,
        ];

        return msg;
      case "DYNAMIC_TYPE_FORWARD": // 转发的动态
        if (!setData.pushTransmit) {
          return "continue";
        }

        desc = dynamic?.modules?.module_dynamic?.desc;
        author = dynamic?.modules?.module_author;
        if (!desc && !author) return;
        if (!dynamic.orig) return;

        let orig = this.buildSendDynamic(upName, dynamic.orig, true, setData);
        if (orig && orig.length) {
          // 掐头去尾
          orig = orig.slice(2);
          // orig.shift();
          // orig.pop();
        } else {
          return false;
        }

        title = `B站【${upName}】转发动态推送：\n`;
        msg = [
          title,
          `-----------------------------\n`,
          `${this.dynamicContentLimit(desc.text, setData)}\n`,
          `链接：${BiliDrawDynamicLinkUrl}${dynamic.id_str}\n`,
          `时间：${
            author
              ? moment(author.pub_ts * 1000).format("YYYY年MM月DD日 HH:mm:ss")
              : ""
          }\n`,
          "\n---以下为转发内容---\n",
          ...orig,
        ];

        return msg;
      case "DYNAMIC_TYPE_LIVE_RCMD":
        title = `B站【${upName}】直播动态推送：\n`;
        // 直播动态由标题、封面、链接组成
        msg = [
          title,
          `-----------------------------\n`,
          `标题：${dynamic.title}\n`,
          `链接：${dynamic.url}\n`,
          segment.image(dynamic.cover),
        ];

        return msg;
      default:
        Bot.logger.mark(`未处理的B站推送【${upName}】：${dynamic.type}`);
        return "continue";
    }
  }

  // 限制动态字数/行数，避免过长影响观感（霸屏）
  dynamicContentLimit(content, setData) {
    content = content.split("\n");

    const DynamicContentLenLimit = setData.pushContentLenLimit || 100;

    const DynamicContentLineLimit = setData.pushContentLineLimit || 5;

    let lenLimit = DynamicContentLenLimit;
    let lineLimit = DynamicContentLineLimit;

    if (content.length > lineLimit) content.length = lineLimit;

    let contentLen = 0; // 内容总长度
    let outLen = false; // 溢出 flag
    for (let i = 0; i < content.length; i++) {
      let len = lenLimit - contentLen; // 这一段内容允许的最大长度

      if (outLen) {
        // 溢出了，后面的直接删掉
        content.splice(i--, 1);
        continue;
      }
      if (content[i].length > len) {
        content[i] = content[i].substr(0, len);
        content[i] = `${content[i]}...`;
        contentLen = lenLimit;
        outLen = true;
      }
      contentLen += content[i].length;
    }

    return content.join("\n");
  }

  // B站返回的url有时候多两斜杠，去掉
  resetLinkUrl(url) {
    if (url.indexOf("//") === 0) {
      return url.substr(2);
    }

    return url;
  }
}
