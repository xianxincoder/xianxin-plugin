import lodash from "lodash";

import { forge } from "./apps/forge.js";
import { bilibiliUpDetail } from "./apps/bilibili.js";

export { forge, bilibiliUpDetail };

let rule = {
  forge: {
    reg: "^#伪造信息.*$", //匹配消息正则，命令正则
    priority: 500, //优先级，越小优先度越高
    describe: "【#伪造信息@群成员 信息】", //【命令】功能说明
  },
  bilibiliUpDetail: {
    reg: "^#up.*$",
    priority: 5000,
    describe: "【#up+uid】查看up信息",
  },
};

lodash.forEach(rule, (r) => {
  r.priority = r.priority || 50;
  r.prehash = true;
  r.hashMark = true;
});

export { rule };

console.log(`闲心插件初始化~`);
setTimeout(async function () {
  let msgStr = await redis.get("xianxin:restart-msg");
  if (msgStr) {
    let msg = JSON.parse(msgStr);
    await common.relpyPrivate(msg.qq, msg.msg);
    await redis.del("xianxin:restart-msg");
    let msgs = [
      // `当前版本: ${currentVersion}`,
      `您可使用 #闲心版本 命令查看更新信息`,
    ];
    await common.relpyPrivate(msg.qq, msgs.join("\n"));
  }
}, 1000);
