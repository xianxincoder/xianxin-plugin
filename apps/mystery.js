import plugin from "../../../lib/plugins/plugin.js";
import fetch from "node-fetch";
import { segment } from "oicq";
import lodash from "lodash";
import common from "../../../lib/common/common.js";
import xxCfg from "../model/xxCfg.js";
import fs from "node:fs";
import https from "https";
import http from "http";

//项目路径
const _path = process.cwd();

let randomvideo_ = [];

/**
 * 初始化工具设置文件
 */
let toolsSetFile = "./plugins/xianxin-plugin/config/tools.set.yaml";
let mysterySetFile = "./plugins/xianxin-plugin/config/mystery.set.yaml";
if (!fs.existsSync(mysterySetFile)) {
  if (fs.existsSync(toolsSetFile)) {
    fs.copyFileSync(toolsSetFile, mysterySetFile);
  } else {
    fs.copyFileSync(
      "./plugins/xianxin-plugin/defSet/mystery/set.yaml",
      mysterySetFile
    );
  }
}

if (fs.existsSync(mysterySetFile) && fs.existsSync(toolsSetFile)) {
  fs.unlink(toolsSetFile, () => {});
}

let urlTypeCache = {};

let urlCache = {};

export class mystery extends plugin {
  constructor() {
    super({
      name: "神秘指令",
      dsc: "处理神秘指令代码",
      event: "message",
      priority: 4000,
      rule: [
        {
          reg: "^#*(woc|卧槽)\\s*[0-9]*$",
          fnc: "woc",
          permission: "master",
        },
        {
          reg: "^#*(woc|卧槽)\\s*pro$",
          fnc: "wocpro",
          permission: "master",
        },
        {
          reg: "^#*小视频\\s*[\u4e00-\u9fa5a-zA-Z]*\\s*[0-9]*$",
          fnc: "searchpro",
          permission: "master",
        },
        {
          reg: "^#*(l)?sp\\s*[\u4e00-\u9fa5a-zA-Z]*\\s*[0-9]*$",
          fnc: "searchsp",
        },
        {
          reg: "^#*(开|开启|关|关闭)sp\\s*[0-9]*$",
          fnc: "ctrlsp",
          permission: "master",
        },
        {
          reg: "^#*(神秘)?(pro)?换源\\s*.*$",
          fnc: "wocurl",
          permission: "master",
        },
      ],
    });

    /** 读取工具相关设置数据 */
    this.mysterySetData = xxCfg.getConfig("mystery", "set");

    this.rule[0].permission = this.mysterySetData.permission;
    this.rule[0].reg = `^#*(${this.mysterySetData.keywords.join(
      "|"
    )})\\s*[0-9]*$`;
    this.rule[1].permission = this.mysterySetData.permission;
    this.rule[1].reg = `^#*(${this.mysterySetData.keywords.join("|")})\\s*pro$`;
    this.rule[2].permission = this.mysterySetData.permission;

    this.path = "./data/wocmp4/";
  }

  async init() {
    if (!fs.existsSync(this.path)) {
      fs.mkdirSync(this.path);
    }
  }

  async woc() {
    const isPrivate = this.e.isPrivate;

    if (!this.mysterySetData.isPrivate && isPrivate) {
      return "return";
    }

    // if (this.mysterySetData.permission == "master" && !this.e.isMaster) {
    //   return "return";
    // }

    // if (this.mysterySetData.permission == "admin" && !this.e.member.is_admin) {
    //   return "return";
    // }
    // if (this.mysterySetData.permission == "owner" && !this.e.member.is_owner) {
    //   return "return";
    // }

    if (this.mysterySetData.cd != 0) {
      /** cd */
      let key = `Yz:woc:${this.e.group_id}`;
      if (await redis.get(key)) return;
      redis.set(key, "1", { EX: Number(this.mysterySetData.cd) });
    }

    this.e.reply("触发探索未知的神秘空间，请稍等...");
    let images = [];
    const isDimtown = this.mysterySetData.wocUrl.indexOf("dimtown.com") !== -1;

    const isCcy = this.mysterySetData.wocUrl.indexOf("ccy.moe") !== -1;

    if (this.mysterySetData.wocUrl.indexOf("/wp-json") !== -1) {
      const idx =
        this.e.msg.replace(
          new RegExp(`#*(${this.mysterySetData.keywords.join("|")})\s*`),
          ""
        ) || 0;

      const randomMax = isDimtown ? 400 : 500;

      const randomIndex = Math.floor(Math.random() * randomMax) + 1;

      const page = Math.ceil((idx || randomIndex) / 10);

      const fetchData = await fetch(`${this.mysterySetData.wocUrl}${page}`);
      const resJsonData = await fetchData.json();

      const index = idx ? idx % 10 : randomIndex % 10;

      if (!resJsonData.length) {
        this.e.reply("额。没有探索到，换个姿势再来一次吧～");
        return "return";
      }

      const content = resJsonData[index].content;

      if (!content || !content.rendered) {
        this.e.reply("额。没有探索到，换个姿势再来一次吧～");
        return "return";
      }

      images = this.getImages(content.rendered);
    } else {
      if (urlTypeCache[this.mysterySetData.wocUrl] == "buffer") {
        const image = await this.getBufferImage(
          `${this.mysterySetData.wocUrl}`
        );
        images = [image];
      } else {
        try {
          const fetchData = await fetch(`${this.mysterySetData.wocUrl}`);
          const resJsonData = await fetchData.json();

          images = this.getJsonImages(JSON.stringify(resJsonData));
        } catch (error) {
          urlTypeCache[this.mysterySetData.wocUrl] = "buffer";
          const image = await this.getBufferImage(
            `${this.mysterySetData.wocUrl}`
          );
          images = [image];
        }
      }
    }

    if (isDimtown && images.length > 1) {
      images.pop();
    }

    const imageCountLimit = this.mysterySetData.imageCountLimit || 10;

    if (images.length > imageCountLimit) {
      images = lodash.sampleSize(images, imageCountLimit);
    }

    const forwarder =
      this.mysterySetData.forwarder == "bot"
        ? { nickname: Bot.nickname, user_id: Bot.uin }
        : {
            nickname: this.e.sender.card || this.e.user_id,
            user_id: this.e.user_id,
          };

    if (images && images.length) {
      let msgList = [];
      for (let imageItem of images) {
        const temp = isCcy
          ? segment.image(imageItem, false, 10000, {
              referer: "https://www.ccy.moe/",
            })
          : segment.image(imageItem);
        if (isPrivate) {
          await this.e.reply(temp, false, {
            recallMsg: this.mysterySetData.delMsg,
          });
          await common.sleep(600);
        } else {
          msgList.push({
            message: temp,
            ...forwarder,
          });
        }
      }
      if (isPrivate) {
        return;
      }
      const res = await this.e.reply(await Bot.makeForwardMsg(msgList), false, {
        recallMsg: this.mysterySetData.delMsg,
      });
      if (!res) {
        if (!res) {
          if (this.e.group && this.e.group.is_admin) {
            if (
              Number(Math.random().toFixed(2)) * 100 <
              this.mysterySetData.mute
            ) {
              let duration = Math.floor(Math.random() * 600) + 1;
              this.e.group.muteMember(this.e.sender.user_id, duration);
              await this.e.reply(
                `不用等了，你想要的已经被神秘的力量吞噬了～ 并随手将你禁锢${duration}秒`
              );
            } else {
              this.reply("不用等了，你想要的已经被神秘的力量吞噬了～");
            }
          } else {
            this.reply("不用等了，你想要的已经被神秘的力量吞噬了～");
          }
        }
      }
    } else {
      this.reply("额。没有探索到，换个姿势再来一次吧～");
    }
  }

  async wocpro() {
    const isPrivate = this.e.isPrivate;

    if (!this.mysterySetData.isPrivate && isPrivate && !this.e.isMaster) {
      return "return";
    }

    let key = `Yz:wocpro:${this.e.group_id || this.e.user_id}`;

    if (await redis.get(key)) {
      this.e.reply("探索中，请稍等...");
      return;
    }
    // await fs.rmSync(`${this.path}${this.e.group_id}/temp.mp4`);
    redis.set(key, "1", { EX: 60 });

    this.e.reply("触发探索更深层面的未知神秘空间，请稍等...");

    let url = this.mysterySetData.wocproUrl;

    // 借助渔火佬代码支持wocplus的源视频播放
    if (url.indexOf("gitee.com") !== -1) {
      if (urlCache != url || !randomvideo_.length) {
        let raw = await fetch(url);
        const videolist_ = await raw.json();
        randomvideo_ = videolist_.sort(function () {
          return Math.random() < 0.5 ? -1 : 1;
        });
      }

      urlCache = url;

      let res = await this.e.reply([randomvideo_.splice(0, 1)[0]], false, {
        recallMsg: this.mysterySetData.delMsg,
      });

      redis.del(key);
      if (!res) {
        this.e.reply("视频发送失败，可能被风控");
        return;
      }
      return;
    } else if (
      url.indexOf("https://xiaobai.klizi.cn/API/video/ks_yanzhi.php") !== -1
    ) {
      const fetchData = await fetch(this.mysterySetData.wocproUrl);
      if (!fetchData.ok) {
        this.e.reply("诶嘿，网络或者源接口出了点问题，等会再试试吧~");
        return;
      }
      const resJsonData = await fetchData.json();

      url = resJsonData.视频链接;

      if (url.indexOf("alimov2.a.kwimgs.com") !== -1) {
        url = url.replace(
          "alimov2.a.kwimgs.com",
          "v20bgqpl8ho2g96xjjjmilboxw3bxvob7.mobgslb.tbcache.com/alimov2.a.kwimgs.com"
        );
      }
    } else if (url.indexOf("api.wuxixindong.top/api/xjj.php") !== -1) {
      const fetchData = await fetch(`${this.mysterySetData.wocproUrl}`);
      if (!fetchData.ok) {
        this.e.reply("诶嘿，网络或者源接口出了点问题，等会再试试吧~");
        return;
      }
      url = await fetchData.text();
    } else if (url.indexOf("xiaobai.klizi.cn/API/video/spzm.php") !== -1) {
      let max = url.indexOf("美女") !== -1 ? 10000 : 2300;

      const randomIndex = Math.floor(Math.random() * max) + 1;
      const fetchData = await fetch(
        `${this.mysterySetData.wocproUrl}&n=${randomIndex}`
      );
      if (!fetchData.ok) {
        this.e.reply("诶嘿，网络或者源接口出了点问题，等会再试试吧~");
        return;
      }
      url = await fetchData.text();
    } else if (url.indexOf("/api/spjh") !== -1) {
      const fetchData = await fetch(`${this.mysterySetData.wocproUrl}`);
      if (!fetchData.ok) {
        this.e.reply("诶嘿，网络或者源接口出了点问题，等会再试试吧~");
        return;
      }
      const resTextData = await fetchData.text();

      const fetch302Data = await fetch(resTextData);

      url = fetch302Data.url;
    } else if (url.indexOf("/api/nysp?key=qiqi") !== -1) {
      const fetchData = await fetch(`${this.mysterySetData.wocproUrl}`);
      if (!fetchData.ok) {
        this.e.reply("诶嘿，网络或者源接口出了点问题，等会再试试吧~");
        return;
      }
      const resTextData = await fetchData.text();

      const tempurl = resTextData.split("\n")[1];

      const fetch302Data = await fetch(tempurl);

      url = fetch302Data.url;
    } else if (url.indexOf("v.api.aa1.cn/api/api-dy-girl") !== -1) {
      const fetch302Data = await fetch(url);

      const urls = this.getJsonMp4(fetch302Data.url);

      url = urls[0] + "11包%20api.aa1.cn%20%20免费视频API.mp4";
    } else {
      if (urlTypeCache[this.mysterySetData.wocproUrl] == "buffer") {
        url = this.mysterySetData.wocproUrl;
      } else {
        try {
          const fetchData = await fetch(`${this.mysterySetData.wocproUrl}`);
          if (!fetchData.ok) {
            this.e.reply("诶嘿，网络或者源接口出了点问题，等会再试试吧~");
            return;
          }
          const resJsonData = await fetchData.json();

          const urls = this.getJsonMp4(JSON.stringify(resJsonData));
          if (urls && urls.length) {
            url = urls[0];
          }
        } catch (error) {
          url = this.mysterySetData.wocproUrl;
        }
      }
    }

    const filePath = await this.downloadMp4(url);

    const res = await this.e.reply(segment.video(filePath), false, {
      recallMsg: this.mysterySetData.delMsg,
    });

    redis.del(key);

    if (!res) {
      this.reply("不用等了，pro的力量需要ffmpeg驾驭哦");
    }
  }

  async searchpro() {
    let index =
      this.e.msg.replace(/#*小视频\s*[\u4e00-\u9fa5a-zA-Z]*\s*/g, "").trim() ||
      1;

    let keyword =
      this.e.msg
        .replace(/#*小视频\s*/g, "")
        .replace(index, "")
        .trim() || "热舞";

    const isPrivate = this.e.isPrivate;

    if (!this.mysterySetData.isPrivate && isPrivate && !this.e.isMaster) {
      return "return";
    }

    let key = `Yz:wocpro:${this.e.group_id || this.e.user_id}`;

    if (await redis.get(key)) {
      this.e.reply("探索中，请稍等...");
      return;
    }

    redis.set(key, "1", { EX: 60 });

    this.e.reply("触发探索更深层面的未知神秘空间，请稍等...");

    let url = `https://xiaobai.klizi.cn/API/video/spzm.php?data=&msg=${keyword}&n=${index}`;

    const fetchData = await fetch(url);
    if (!fetchData.ok) {
      this.e.reply("诶嘿，网络或者源接口出了点问题，等会再试试吧~");
      return;
    }
    url = await fetchData.text();

    const filePath = await this.downloadMp4(url);

    const res = await this.e.reply(segment.video(filePath), false, {
      recallMsg: this.mysterySetData.delMsg,
    });

    redis.del(key);

    if (!res) {
      this.reply("不用等了，pro的力量需要ffmpeg驾驭哦");
    }
  }

  async ctrlsp() {
    let key = `Yz:lspstatus:${this.e.group_id || this.e.user_id}`;

    let qq = this.e.msg.replace(/#*(开|开启|关|关闭)sp\s*/g, "");

    if (qq) {
      key = `Yz:lspstatus:${qq}`;
    }

    if (this.e.msg.indexOf("开") !== -1) {
      redis.set(key, "1");
      this.e.reply(
        qq +
          "已开启sp功能\n#sp  -- 随机p站图\n#sp 2  -- 随机2张p站图\n#sp 雷神 2  -- 雷神相关2张p站图\n#lsp 雷神 2  -- 雷神相关2张p站r18图"
      );
    } else {
      redis.del(key);
      this.e.reply("sp功能已关闭");
    }
  }

  async searchsp() {
    let key = `Yz:lspstatus:${this.e.group_id || this.e.user_id}`;

    const isPrivate = this.e.isPrivate;

    if (
      !this.mysterySetData.isPrivate &&
      isPrivate &&
      !(await redis.get(key))
    ) {
      return "return";
    }

    if (this.mysterySetData.cd != 0) {
      /** cd */
      let key = `Yz:sp:${this.e.group_id}`;
      if (await redis.get(key)) return;
      redis.set(key, "1", { EX: Number(this.mysterySetData.cd) });
    }

    if (!(await redis.get(key))) {
      this.e.reply("未开启sp功能，请发送 #开sp 进行开启");
      return;
    }

    let num =
      this.e.msg.replace(/#*(l)?sp\s*[\u4e00-\u9fa5a-zA-Z]*\s*/g, "").trim() ||
      1;

    let keyword =
      this.e.msg
        .replace(/#*(l)?sp\s*/g, "")
        .replace(num, "")
        .trim() || "黑丝|白丝";

    this.e.reply("触发探索未知的神秘空间，请稍等...");

    const fetchData = await fetch(
      `https://api.lolicon.app/setu/v2?tag=${keyword}&proxy=sex.nyan.xyz&num=${num}&r18=${
        this.e.msg.indexOf("lsp") !== -1 ? 1 : 0
      }`
    );
    const resJsonData = await fetchData.json();

    let images = this.getJsonImages(JSON.stringify(resJsonData));

    const forwarder =
      this.mysterySetData.forwarder == "bot"
        ? { nickname: Bot.nickname, user_id: Bot.uin }
        : {
            nickname: this.e.sender.card || this.e.user_id,
            user_id: this.e.user_id,
          };

    if (images && images.length) {
      let msgList = [];
      for (let imageItem of images) {
        if (isPrivate) {
          await this.e.reply(segment.image(imageItem), false, {
            recallMsg: this.mysterySetData.delMsg,
          });
          await common.sleep(600);
        } else {
          msgList.push({
            message: segment.image(imageItem),
            ...forwarder,
          });
        }
      }

      if (isPrivate) {
        return;
      }

      const res = await this.e.reply(await Bot.makeForwardMsg(msgList), false, {
        recallMsg: this.mysterySetData.delMsg,
      });
      if (!res) {
        if (!res) {
          if (this.e.group && this.e.group.is_admin) {
            if (
              Number(Math.random().toFixed(2)) * 100 <
              this.mysterySetData.mute
            ) {
              let duration = Math.floor(Math.random() * 600) + 1;
              this.e.group.muteMember(this.e.sender.user_id, duration);
              await this.e.reply(
                `不用等了，你想要的已经被神秘的力量吞噬了～ 并随手将你禁锢${duration}秒`
              );
            } else {
              this.reply("不用等了，你想要的已经被神秘的力量吞噬了～");
            }
          } else {
            this.reply("不用等了，你想要的已经被神秘的力量吞噬了～");
          }
        }
      }
    } else {
      this.reply("额。没有探索到，换个姿势再来一次吧～");
    }
  }

  async wocurl() {
    const isPro = this.e.msg.slice(0, 8).indexOf("pro") !== -1;

    let url = this.e.msg.replace(/#*(神秘)?(pro)?换源\s*/g, "") || "";
    if (url == "") {
      url = isPro
        ? "https://gitee.com/xianxincoder/data/raw/master/wocplus.json"
        : "https://yingtall.com/wp-json/wp/v2/posts?page=";
    }

    let obj = {};

    if (isPro) {
      obj = { wocproUrl: url };
    } else {
      obj = { wocUrl: url };
    }

    xxCfg.saveSet("mystery", "set", "config", {
      ...this.mysterySetData,
      ...obj,
    });

    this.e.reply(`已更换神秘${isPro ? "pro" : ""}代码源地址为：${url}`);
  }

  async downloadMp4(url) {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(`${this.path}${this.e.group_id || this.e.user_id}`)) {
        fs.mkdirSync(`${this.path}${this.e.group_id || this.e.user_id}`);
      }

      var protocol = url.indexOf("https:") !== -1 ? https : http;

      protocol
        .get(url, (res) => {
          const file = fs.createWriteStream(
            `${this.path}${this.e.group_id || this.e.user_id}/temp.mp4`
          );
          // Write data into local file
          res.pipe(file);
          // Close the file
          file.on("finish", () => {
            file.close();
            resolve(
              `${this.path}${this.e.group_id || this.e.user_id}/temp.mp4`
            );
          });
        })
        .on("error", (err) => {
          logger.error(`视频下载失败：${JSON.stringify(err)}`);
        });
    });
  }

  getImages(string) {
    const imgRex = /<img.*?src="(.*?)"[^>]+>/g;
    const images = [];
    let img;
    while ((img = imgRex.exec(string))) {
      images.push(encodeURI(img[1]));
    }
    return images;
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

  getJsonMp4(string) {
    const mp4Rex = /https?:\/\/.*?\.(mp4|m3u8)/g;
    const mp4s = [];
    let mp4;
    while ((mp4 = mp4Rex.exec(string))) {
      mp4s.push(mp4[0]);
    }
    return mp4s;
  }

  // 获取图片
  async getBufferImage(url) {
    let response = await fetch(url, {
      method: "get",
      responseType: "arraybuffer",
    });

    const buffer = await response.arrayBuffer();

    return (
      "base64://" +
      btoa(
        new Uint8Array(buffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      )
    );
  }
}
