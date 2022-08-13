import moment from "moment";
import lodash from "lodash";
import base from "./base.js";
import fetch from "node-fetch";

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
}
