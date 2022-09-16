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

/**
 * 初始化工具设置文件
 */
let toolsSetFile = "./plugins/xianxin-plugin/config/tools.set.yaml";
if (!fs.existsSync(toolsSetFile)) {
  fs.copyFileSync(
    "./plugins/xianxin-plugin/defSet/tools/set.yaml",
    toolsSetFile
  );
}

let fileArr = new Set();

let urlTypeCache = {};

export class mystery extends plugin {
  constructor() {
    super({
      name: "神秘指令",
      dsc: "处理神秘指令代码",
      event: "message",
      priority: 5000,
      rule: [
        {
          reg: "^#*(woc|卧槽)$",
          fnc: "woc",
          permission: "master",
        },
        {
          reg: "^#*(woc|卧槽)\\s*pro$",
          fnc: "wocpro",
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
    this.toolsSetData = xxCfg.getConfig("tools", "set");

    this.rule[0].permission = this.toolsSetData.permission;
    this.rule[0].reg = `^#*(${this.toolsSetData.keywords.join("|")})$`;
    this.rule[1].permission = this.toolsSetData.permission;
    this.rule[1].reg = `^#*(${this.toolsSetData.keywords.join("|")})\\s*pro$`;

    this.path = "./data/wocmp4/";

    if (this.toolsSetData.wocUrl.indexOf("http") == -1) {
      this.resourcesPath = `${_path}${this.toolsSetData.wocUrl}`;
    }
  }

  async init() {
    if (!fs.existsSync(this.path)) {
      fs.mkdirSync(this.path);
    }
    /** 读取工具相关设置数据 */
    this.toolsSetData = xxCfg.getConfig("tools", "set");
    if (this.toolsSetData.wocUrl.indexOf("http") == -1) {
      this.resourcesPath = `${_path}${this.toolsSetData.wocUrl}`;
      this.readdirectory(this.resourcesPath, "img");
      this.watchFile(this.resourcesPath, "img");
    }
  }

  async woc() {
    const isPrivate = this.e.isPrivate;

    if (!this.toolsSetData.isPrivate && isPrivate) {
      return "return";
    }

    // if (this.toolsSetData.permission == "master" && !this.e.isMaster) {
    //   return "return";
    // }

    // if (this.toolsSetData.permission == "admin" && !this.e.member.is_admin) {
    //   return "return";
    // }
    // if (this.toolsSetData.permission == "owner" && !this.e.member.is_owner) {
    //   return "return";
    // }

    if (this.toolsSetData.cd != 0) {
      /** cd */
      let key = `Yz:woc:${this.e.group_id}`;
      if (await redis.get(key)) return;
      redis.set(key, "1", { EX: Number(this.toolsSetData.cd) });
    }

    this.e.reply("触发探索未知的神秘空间，请稍等...");
    let images = [];
    const isDimtown = this.toolsSetData.wocUrl.indexOf("dimtown.com") !== -1;

    if (this.resourcesPath && fileArr.size) {
      images = lodash.sampleSize(
        Array.from(fileArr),
        this.toolsSetData.imageCountLimit || 10
      );
    } else if (this.toolsSetData.wocUrl.indexOf("/wp-json") !== -1) {
      const randomMax = isDimtown ? 400 : 600;

      const randomIndex = Math.floor(Math.random() * randomMax) + 1;

      const page = Math.ceil(randomIndex / 10);

      const fetchData = await fetch(`${this.toolsSetData.wocUrl}${page}`);
      const resJsonData = await fetchData.json();

      const index = randomIndex % 10;

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
      if (urlTypeCache[this.toolsSetData.wocUrl] == "buffer") {
        const image = await this.getBufferImage(`${this.toolsSetData.wocUrl}`);
        images = [image];
      } else {
        try {
          const fetchData = await fetch(`${this.toolsSetData.wocUrl}`);
          const resJsonData = await fetchData.json();

          images = this.getJsonImages(JSON.stringify(resJsonData));
        } catch (error) {
          urlTypeCache[this.toolsSetData.wocUrl] = "buffer";
          const image = await this.getBufferImage(
            `${this.toolsSetData.wocUrl}`
          );
          images = [image];
        }
      }
    }

    if (isDimtown && images.length > 1) {
      images.pop();
    }

    const imageCountLimit = this.toolsSetData.imageCountLimit || 10;

    if (images.length > imageCountLimit) {
      images.length = imageCountLimit;
    }

    const forwarder =
      this.toolsSetData.forwarder == "bot"
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
            recallMsg: this.toolsSetData.delMsg,
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
        recallMsg: this.toolsSetData.delMsg,
      });
      if (!res) {
        if (!res) {
          if (this.e.group.is_admin) {
            if (
              Number(Math.random().toFixed(2)) * 100 <
              this.toolsSetData.mute
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

    if (!this.toolsSetData.isPrivate && isPrivate) {
      return "return";
    }

    let key = `Yz:wocpro:${this.e.group_id}`;

    if (await redis.get(key)) {
      this.e.reply("探索中，请稍等...");
      return;
    }
    // await fs.rmSync(`${this.path}${this.e.group_id}/temp.mp4`);
    redis.set(key, "1", { EX: 60 });

    this.e.reply("触发探索更深层面的未知神秘空间，请稍等...");

    let url = this.toolsSetData.wocproUrl;

    if (
      url.indexOf("https://xiaobai.klizi.cn/API/video/ks_yanzhi.php") !== -1
    ) {
      const fetchData = await fetch(this.toolsSetData.wocproUrl);
      const resJsonData = await fetchData.json();

      url = resJsonData.视频链接;

      if (url.indexOf("alimov2.a.kwimgs.com") !== -1) {
        url = url.replace(
          "alimov2.a.kwimgs.com",
          "v20bgqpl8ho2g96xjjjmilboxw3bxvob7.mobgslb.tbcache.com/alimov2.a.kwimgs.com"
        );
      }
    } else if (url.indexOf("api.wuxixindong.top/api/xjj.php") !== -1) {
      const fetchData = await fetch(`${this.toolsSetData.wocproUrl}`);
      url = await fetchData.text();
    } else if (url.indexOf("xiaobai.klizi.cn/API/video/spzm.php") !== -1) {
      const randomIndex = Math.floor(Math.random() * 10000) + 1;
      const fetchData = await fetch(
        `${this.toolsSetData.wocproUrl}&n=${randomIndex}`
      );
      url = await fetchData.text();
    } else if (url.indexOf("/api/spjh") !== -1) {
      const fetchData = await fetch(`${this.toolsSetData.wocproUrl}`);
      const resTextData = await fetchData.text();

      const fetch302Data = await fetch(resTextData);

      url = fetch302Data.url;
    } else if (url.indexOf("/api/nysp?key=qiqi") !== -1) {
      const fetchData = await fetch(`${this.toolsSetData.wocproUrl}`);
      const resTextData = await fetchData.text();

      const tempurl = resTextData.split("\n")[1];

      const fetch302Data = await fetch(tempurl);

      url = fetch302Data.url;
    } else {
      if (urlTypeCache[this.toolsSetData.wocproUrl] == "buffer") {
        url = this.toolsSetData.wocproUrl;
      } else {
        try {
          const fetchData = await fetch(`${this.toolsSetData.wocproUrl}`);
          const resJsonData = await fetchData.json();

          const urls = this.getJsonMp4(JSON.stringify(resJsonData));
          if (urls && urls.length) {
            url = urls[0];
          }
        } catch (error) {
          url = this.toolsSetData.wocproUrl;
        }
      }
    }

    const filePath = await this.downloadMp4(url);

    await this.e.reply(segment.video(filePath));

    redis.del(key);
  }

  async wocurl() {
    const isPro = this.e.msg.slice(0, 8).indexOf("pro") !== -1;

    let url = this.e.msg.replace(/#*(神秘)?(pro)?换源\s*/g, "") || "";
    if (url == "") {
      url = isPro
        ? "http://api.xn--7gqa009h.top/api/nysp?key=qiqi"
        : "https://yingtall.com/wp-json/wp/v2/posts?page=";
    }

    let obj = {};

    if (isPro) {
      obj = { wocproUrl: url };
    } else {
      obj = { wocUrl: url };
    }

    xxCfg.saveSet("tools", "set", "config", {
      ...this.toolsSetData,
      ...obj,
    });

    this.e.reply(`已更换神秘${isPro ? "pro" : ""}代码源地址为：${url}`);
  }

  async downloadMp4(url) {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(`${this.path}${this.e.group_id}`)) {
        fs.mkdirSync(`${this.path}${this.e.group_id}`);
      }

      var protocol = url.indexOf("https:") !== -1 ? https : http;

      protocol
        .get(url, (res) => {
          const file = fs.createWriteStream(
            `${this.path}${this.e.group_id}/temp.mp4`
          );
          // Write data into local file
          res.pipe(file);
          // Close the file
          file.on("finish", () => {
            file.close();
            resolve(`${this.path}${this.e.group_id}/temp.mp4`);
          });
        })
        .on("error", (err) => {
          logger.error(`视频下载失败：${JSON.stringify(err)}`);
        });
    });
  }

  readdirectory(dir, type) {
    let files = fs.readdirSync(dir, { withFileTypes: true });
    for (let val of files) {
      let filepath = dir + `/` + val.name;
      if (!val.isFile()) {
        this.readdirectory(filepath, type);
        continue;
      }
      let re;

      if (type == "img") {
        re = new RegExp(`.(jpg|jpeg|png|gif|bmp)$`, "i");
      }
      if (!re.test(val.name)) {
        continue;
      }
      fileArr.add(filepath);
    }
  }

  watchFile(dir, type) {
    let fsTimeout = {};
    let recursive = false;
    fs.watch(dir, { recursive: recursive }, async (eventType, filename) => {
      if (fsTimeout[type]) return;

      let re;
      if (type == "img") {
        Bot.logger.mark("更新神秘空间图片");
        re = new RegExp(`.(jpg|jpeg|png|gif|bmp)$`, "i");
        fileArr.clear();
      }

      if (!re.test(filename)) return;

      fsTimeout[type] = true;

      setTimeout(async () => {
        this.readdirectory(dir, type);
        fsTimeout[type] = null;
      }, 5000);
    });
  }

  getImages(string) {
    const imgRex = /<img.*?src="(.*?)"[^>]+>/g;
    const images = [];
    let img;
    while ((img = imgRex.exec(string))) {
      images.push(img[1]);
    }
    return images;
  }

  getJsonImages(string) {
    const imgRex = /https?:\/\/.*?\.(jpg|JPG|png|PNG|gif|GIF|jpeg|JPEG)/g;
    const images = [];
    let img;
    while ((img = imgRex.exec(string))) {
      images.push(img[0]);
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
