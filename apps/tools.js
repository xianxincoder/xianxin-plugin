import plugin from "../../../lib/plugins/plugin.js";
import fetch from "node-fetch";
import puppeteer from "../../../lib/puppeteer/puppeteer.js";
import Tools from "../model/tools.js";

export class tools extends plugin {
  constructor() {
    super({
      name: "闲心小工具",
      dsc: "处理一些杂项小工具",
      event: "message",
      priority: 5000,
      rule: [
        {
          reg: "^#*赞我$",
          fnc: "thumbsUpMe",
        },
        {
          reg: "^#*(闲心)?发电榜$",
          fnc: "fdrank",
        },
        {
          reg: "^#*最近发电$",
          fnc: "lately",
        },
      ],
    });
  }

  async thumbsUpMe() {
    Bot.pickFriend(this.e.user_id).thumbUp(10);
    this.reply("已给你点赞");
  }

  async fdrank() {
    const fetchData = await fetch(
      "https://afdian.net/api/creator/get-sponsors?user_id=2248d8420da611edb68952540025c377&type=amount&page=1"
    );
    const fetchPageTwoData = await fetch(
      "https://afdian.net/api/creator/get-sponsors?user_id=2248d8420da611edb68952540025c377&type=amount&page=2"
    );
    const resJsonData = await fetchData.json();

    const resPageTwoJsonData = await fetchPageTwoData.json();

    const data = await new Tools(this.e).getRankData([
      ...resJsonData.data.list,
      ...resPageTwoJsonData.data.list,
    ]);

    let img = await puppeteer.screenshot("fdrank", {
      ...data,
      type: "rank",
      limitTop: 20,
    });
    this.e.reply(img);
  }

  async lately() {
    const fetchData = await fetch(
      "https://afdian.net/api/creator/get-sponsors?user_id=2248d8420da611edb68952540025c377&type=new&page=1"
    );
    const resJsonData = await fetchData.json();

    const data = await new Tools(this.e).getRankData(resJsonData.data.list);

    let img = await puppeteer.screenshot("fdrank", {
      ...data,
      type: "lately",
      limitTop: 10,
    });
    this.e.reply(img);
  }
}
