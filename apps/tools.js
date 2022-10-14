import moment from "moment";
import lodash from "lodash";
import base from "./base.js";
import { segment } from "oicq";
import fetch from "node-fetch";
import puppeteer from "../../../lib/puppeteer/puppeteer.js";
import common from "../../../lib/common/common.js";

const _path = process.cwd();

let emoticon;

export default class Mys extends base {
  constructor(e) {
    super(e);
    this.model = "mysDetail";
  }

  conditionHanle(data) {
    const checkDate =
      moment().subtract(1, "days").format("MM-DD") ===
      moment(data.post.created_at * 1000).format("MM-DD");

    const checkTitle = /^(.*吗.*|.*呢.*|.*吧.*|.*？.*)$/.test(
      data.post.subject
    );

    return checkDate && checkTitle;
  }

  async chatDataHandle() {
    const chatData = []; // 如果过滤后没有数据，那么用全部数据兜底
    const filterChatData = []; // 符合条件的数据
    const data = await fetch(
      `https://bbs-api.mihoyo.com/post/wapi/getForumPostList?forum_id=26&gids=2&is_good=false&is_hot=true&page_size=20&sort_type=2&last_id=1`
    );

    const data1 = await fetch(
      `https://bbs-api.mihoyo.com/post/wapi/getForumPostList?forum_id=26&gids=2&is_good=false&is_hot=true&page_size=20&sort_type=2&last_id=2`
    );
    const data2 = await fetch(
      `https://bbs-api.mihoyo.com/post/wapi/getForumPostList?forum_id=26&gids=2&is_good=false&is_hot=true&page_size=20&sort_type=2&last_id=3`
    );

    const dataResJsonData = await data.json();
    const data1ResJsonData = await data1.json();
    const data2ResJsonData = await data2.json();

    if (
      dataResJsonData &&
      dataResJsonData.retcode === 0 &&
      dataResJsonData.data.list &&
      dataResJsonData.data.list.length
    ) {
      const mergeData = [
        ...dataResJsonData.data.list,
        ...data1ResJsonData.data.list,
        ...data2ResJsonData.data.list,
      ];
      mergeData.map((item) => {
        chatData.push({
          title: item.post.subject,
          url: `https://bbs.mihoyo.com/ys/article/${item.post.post_id}`,
          like: item.stat.like_num,
          reply: item.stat.reply_num,
        });
        // 获取昨天的聊天话题
        if (this.conditionHanle(item)) {
          filterChatData.push({
            title: item.post.subject,
            url: `https://bbs.mihoyo.com/ys/article/${item.post.post_id}`,
            like: item.stat.like_num,
            reply: item.stat.reply_num,
          });
        }
        return item;
      });
    }

    return filterChatData.length ? filterChatData : chatData;
  }

  async getChatData() {
    const data = await this.chatDataHandle();
    const sortData = data.sort(function (a, b) {
      return b.reply - a.reply;
    });
    return sortData;
  }

  async getAcgnData() {
    const cosData = [];
    const fetchData = await fetch(
      `https://bbs-api.mihoyo.com/post/wapi/getImagePostList?forum_id=29&gids=2&page_size=20&type=1`
    );
    const resJsonData = await fetchData.json();

    if (
      resJsonData &&
      resJsonData.retcode === 0 &&
      resJsonData.data.list &&
      resJsonData.data.list.length
    ) {
      resJsonData.data.list.map((item) => {
        cosData.push({
          title: item.post.subject,
          url: `https://bbs.mihoyo.com/ys/article/${item.post.post_id}`,
          cover: item.cover.url,
          images: item.post.images,
          nickname: item.user.nickname,
          like_num: item.stat.like_num,
        });
        return item;
      });
    }
    return cosData;
  }

  async getCosData(key) {
    const urlMap = {
      ys: `https://bbs-api.mihoyo.com/post/wapi/getImagePostList?forum_id=49&gids=2&page_size=20&type=1`,
      dby: `https://bbs-api.mihoyo.com/post/wapi/getImagePostList?forum_id=47&gids=2&page_size=20&type=1`,
    };
    const cosData = [];
    const fetchData = await fetch(urlMap[key]);
    const resJsonData = await fetchData.json();

    if (
      resJsonData &&
      resJsonData.retcode === 0 &&
      resJsonData.data.list &&
      resJsonData.data.list.length
    ) {
      resJsonData.data.list.map((item) => {
        cosData.push({
          title: item.post.subject,
          url: `https://bbs.mihoyo.com/ys/article/${item.post.post_id}`,
          cover: item.cover.url,
          images: item.post.images,
          nickname: item.user.nickname,
          like_num: item.stat.like_num,
        });
        return item;
      });
    }
    return cosData;
  }

  async getCosSearchData(keyword, last_id, key) {
    const cosData = [];

    const urlMap = {
      ys: `https://bbs-api.mihoyo.com/post/wapi/searchPosts?forum_id=49&gids=2&keyword=${keyword}&last_id=${last_id}&size=20`,
      dby: `https://bbs-api.mihoyo.com/post/wapi/searchPosts?forum_id=47&gids=5&keyword=${keyword}&last_id=${last_id}&size=20`,
    };

    const fetchData = await fetch(urlMap[key]);
    const resJsonData = await fetchData.json();

    if (
      resJsonData &&
      resJsonData.retcode === 0 &&
      resJsonData.data.posts &&
      resJsonData.data.posts.length
    ) {
      resJsonData.data.posts.map((item) => {
        cosData.push({
          title: item.post.subject,
          url: `https://bbs.mihoyo.com/ys/article/${item.post.post_id}`,
          cover: item.cover && item.cover.url,
          images: item.post.images,
          nickname: item.user.nickname,
          like_num: item.stat.like_num,
        });
        return item;
      });
    }
    return cosData;
  }

  async getAcgnSearchData(keyword, last_id) {
    const cosData = [];

    const url = `https://bbs-api.mihoyo.com/post/wapi/searchPosts?forum_id=29&gids=2&keyword=${keyword}&last_id=${last_id}&size=20`;

    const fetchData = await fetch(url);
    const resJsonData = await fetchData.json();

    if (
      resJsonData &&
      resJsonData.retcode === 0 &&
      resJsonData.data.posts &&
      resJsonData.data.posts.length
    ) {
      resJsonData.data.posts.map((item) => {
        cosData.push({
          title: item.post.subject,
          url: `https://bbs.mihoyo.com/ys/article/${item.post.post_id}`,
          cover: item.cover.url,
          images: item.post.images,
          nickname: item.user.nickname,
          like_num: item.stat.like_num,
        });
        return item;
      });
    }
    return cosData;
  }

  async getWikiSearchData(keyword, type) {
    const wikiData = [];

    const urlMap = {
      wiki: `https://api-takumi.mihoyo.com/common/blackboard/ys_obc/v1/search/content?app_sn=ys_obc&keyword=${keyword}&page=1`,
      strategy: `https://api-takumi.mihoyo.com/common/blackboard/ys_strategy/v1/search/content?app_sn=ys_strategy&keyword=${keyword}&page=1`,
    };

    const fetchData = await fetch(urlMap[type]);

    const resJsonData = await fetchData.json();

    if (
      resJsonData &&
      resJsonData.retcode === 0 &&
      resJsonData.data.list &&
      resJsonData.data.list.length
    ) {
      resJsonData.data.list.map((item) => {
        wikiData.push({
          title: item.title,
          href: item.bbs_url,
          tags: item.channels.map((channel) => channel.name),
          id: item.id,
        });
        return item;
      });
    }

    return wikiData;
  }

  async getWikiPage(data, isSplit) {
    const id = data.id;

    const param = await this.wikiDetail(id);

    const renderInfo = await this.render(param, isSplit, true);

    return renderInfo;
  }

  async wikiDetail(id) {
    const res = await this.postData("wiki", {
      content_id: id,
    });

    this.model = "wikiDetail";
    const data = res;

    const content = this.GetTagByClassUsingRegex(
      "div",
      "wiki-map-card",
      data.data.content.contents[0].text
    );

    return {
      ...this.screenData,
      saveId: id,
      dataConent: content,
      data,
    };
  }

  GetTagByClassUsingRegex(tag, cls, html) {
    // tag:标签名，cls：类名，html：要处理的字符串
    var reg = new RegExp(
      "<" +
        tag +
        "[^>]*class[\\s]?=[\\s]?['\"]" +
        cls +
        "[^'\"]*['\"][\\s\\S]*?</" +
        tag +
        ">",
      "g"
    );
    return html.replace(reg, "");
  }

  async strategySearch(data, isSplit) {
    const url = data.href;

    const matchArr = url.match(/[^\/]*$/);
    const postId = matchArr[0];

    if (!/^\d+$/.test(postId)) {
      return { img: [], code: "limit" };
    }

    const param = await this.newsDetail(postId);

    const renderInfo = await this.render(param, isSplit, false);

    return renderInfo;
  }

  async newsDetail(postId) {
    const res = await this.postData("getPostFull", {
      gids: 2,
      read: 1,
      post_id: postId,
    });
    this.model = "mysDetail";
    const data = await this.detalData(res.data.post);

    return {
      ...this.screenData,
      saveId: postId,
      dataConent: data.post.content,
      data,
    };
  }

  postApi(type, data) {
    let host = "https://bbs-api.mihoyo.com/";
    let param = [];
    lodash.forEach(data, (v, i) => param.push(`${i}=${v}`));
    param = param.join("&");
    switch (type) {
      // 帖子详情
      case "getPostFull":
        host += "post/wapi/getPostFull?";
        break;
      case "emoticon":
        host = "https://bbs-api-static.mihoyo.com/misc/api/emoticon_set?";
        break;
      case "wiki":
        host =
          "https://api-static.mihoyo.com/common/blackboard/ys_obc/v1/content/info?app_sn=ys_obc&";
        break;
    }
    return host + param;
  }

  async postData(type, data) {
    const url = this.postApi(type, data);
    const headers = {
      Referer: "https://bbs.mihoyo.com/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36",
    };
    let response;
    try {
      response = await fetch(url, { method: "get", headers });
    } catch (error) {
      logger.error(error.toString());
      return false;
    }

    if (!response.ok) {
      logger.error(
        `[米游社接口错误][${type}] ${response.status} ${response.statusText}`
      );
      return false;
    }
    const res = await response.json();
    return res;
  }

  async detalData(data) {
    let json;
    try {
      json = JSON.parse(data.post.content);
    } catch (error) {}

    if (typeof json == "object") {
      if (json.imgs && json.imgs.length > 0) {
        for (const val of json.imgs) {
          data.post.content = ` <div class="ql-image-box"><img src="${val}?x-oss-process=image//resize,s_600/quality,q_80/auto-orient,0/interlace,1/format,png"></div>`;
        }
      }
    } else {
      for (const img of data.post.images) {
        data.post.content = data.post.content.replace(
          img,
          img +
            "?x-oss-process=image//resize,s_600/quality,q_80/auto-orient,0/interlace,1/format,jpg"
        );
      }

      if (!emoticon) {
        emoticon = await this.mysEmoticon();
      }

      data.post.content = data.post.content.replace(
        /_\([^)]*\)/g,
        function (t, e) {
          t = t.replace(/_\(|\)/g, "");
          if (emoticon.has(t)) {
            return `<img class="emoticon-image" src="${emoticon.get(t)}"/>`;
          } else {
            return "";
          }
        }
      );

      const arrEntities = { lt: "<", gt: ">", nbsp: " ", amp: "&", quot: '"' };
      data.post.content = data.post.content.replace(
        /&(lt|gt|nbsp|amp|quot);/gi,
        function (all, t) {
          return arrEntities[t];
        }
      );
    }

    data.post.created_time = new Date(
      data.post.created_at * 1000
    ).toLocaleString();

    for (const i in data.stat) {
      data.stat[i] =
        data.stat[i] > 10000
          ? (data.stat[i] / 10000).toFixed(2) + "万"
          : data.stat[i];
    }

    return data;
  }

  async mysEmoticon() {
    const emp = new Map();

    const res = await this.postData("emoticon", { gids: 2 });

    if (res.retcode != 0) {
      return emp;
    }

    for (const val of res.data.list) {
      if (!val.icon) continue;
      for (const list of val.list) {
        if (!list.icon) continue;
        emp.set(list.name, list.icon);
      }
    }

    return emp;
  }

  /**
   * 处理米游社详情页图片生成
   * @param {object} param
   * @param {boolean} isSplit 是否为分片截图
   * @returns {img: string[], code: string}
   */
  async render(param, isSplit, isWiki) {
    const pageHeight = 8000;

    await puppeteer.browserInit();

    if (!puppeteer.browser) return false;

    const savePath = puppeteer.dealTpl(
      isWiki ? "wikiDetail" : "mysDetail",
      param
    );

    if (!savePath) return false;

    const page = await puppeteer.browser.newPage();

    try {
      await page.goto(`file://${_path}${lodash.trim(savePath, ".")}`, {
        timeout: 120000,
      });
      const body = (await page.$("#container")) || (await page.$("body"));
      const boundingBox = await body.boundingBox();

      const num = isSplit
        ? Math.round(boundingBox.height / pageHeight) || 1
        : 1;

      if (num > 1) {
        await page.setViewport({
          width: Math.round(boundingBox.width),
          height: pageHeight + 100,
        });
      }

      const img = [];
      let code = "success";
      for (let i = 1; i <= num; i++) {
        const randData = {
          type: "jpeg",
          quality: 90,
        };

        if (i != 1 && i == num) {
          await page.setViewport({
            width: Math.round(boundingBox.width),
            height: parseInt(boundingBox.height) - pageHeight * (num - 1),
          });
        }

        if (i != 1 && i <= num) {
          await page.evaluate(() => window.scrollBy(0, 8000));
        }

        let buff;
        if (num == 1) {
          buff = await body.screenshot(randData);
        } else {
          buff = await page.screenshot(randData);
        }

        if (num > 2) await common.sleep(200);

        puppeteer.renderNum++;
        /** 计算图片大小 */
        const kb = (buff.length / 1024).toFixed(2) + "kb";
        if ((buff.length / 1024).toFixed(2) > 3500) {
          code = "limit";
        }

        logger.mark(
          `[图片生成][${this.model}][${puppeteer.renderNum}次] ${kb}`
        );

        img.push(segment.image(buff));
      }
      page.close().catch((err) => logger.error(err));

      if (num > 1) {
        logger.mark(`[图片生成][${this.model}] 处理完成`);
      }
      return { img: img, code: code };
    } catch (error) {
      logger.error(`图片生成失败:${this.model}:${error}`);
      /** 关闭浏览器 */
      if (puppeteer.browser) {
        await puppeteer.browser.close().catch((err) => logger.error(err));
      }
      puppeteer.browser = false;
      return { img: [], code: "limit" };
    }
  }
}
