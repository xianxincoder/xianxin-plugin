import moment from "moment";
import lodash from "lodash";
import base from "./base.js";
import fetch from "node-fetch";

export default class Mys extends base {
  constructor(e) {
    super(e);
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
          nickname: item.user.nickname,
          like_num: item.stat.like_num,
        });
        return item;
      });
    }
    return cosData;
  }

  async getCosData() {
    const cosData = [];
    const fetchData = await fetch(
      `https://bbs-api.mihoyo.com/post/wapi/getImagePostList?forum_id=49&gids=2&page_size=20&type=1`
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
          nickname: item.user.nickname,
          like_num: item.stat.like_num,
        });
        return item;
      });
    }
    return cosData;
  }
}
