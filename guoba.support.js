import path from "path";
const _path = process.cwd() + "/plugins/xianxin-plugin";
import xxCfg from "./model/xxCfg.js";

/**
 *  支持锅巴配置
 */
export function supportGuoba() {
  return {
    pluginInfo: {
      name: "xianxin-plugin",
      title: "xianxin-plugin",
      author: "@闲心",
      authorLink: "https://gitee.com/xianxincoder",
      link: "https://gitee.com/xianxincoder/xianxin-plugin",
      isV3: true,
      isV2: false,
      description: "提供B站推送、群战小游戏、米游社cos、米游社wiki攻略等功能",
      // 显示图标，此为个性化配置
      // 图标可在 https://icon-sets.iconify.design 这里进行搜索
      icon: "mdi:stove",
      // 图标颜色，例：#FF0000 或 rgb(255, 0, 0)
      iconColor: "#d19f56",
      // 如果想要显示成图片，也可以填写图标路径（绝对路径）
      iconPath: path.join(_path, "resources/img/rank/top.png"),
    },
    // 配置项信息
    configInfo: {
      // 配置项 schemas
      schemas: [
        {
          field: "bilibili.pushStatus",
          label: "B站推送状态",
          bottomHelpMessage: "B站推送任务状态",
          component: "Select",
          componentProps: {
            options: [
              { label: "不推送", value: 0 },
              { label: "推送", value: 1 },
            ],
            placeholder: "请选择B站推送状态",
          },
        },
        {
          field: "bilibili.pushTime",
          label: "B站定时任务",
          bottomHelpMessage: "检测b站推送定时任务，Cron表达式",
          component: "Input",
          componentProps: {
            placeholder: "请输入检测b站推送定时任务",
          },
        },
        {
          field: "bilibili.pushTransmit",
          label: "推送转发动态",
          bottomHelpMessage: "推送转发动态设置",
          component: "Select",
          componentProps: {
            options: [
              { label: "不推送", value: 0 },
              { label: "推送", value: 1 },
            ],
            placeholder: "请选择推送转发动态设置",
          },
        },
        {
          field: "bilibili.pushMsgMode",
          label: "B站推送消息模式",
          bottomHelpMessage: "设置B站动态推送消息模式",
          component: "Select",
          componentProps: {
            options: [
              { label: "文字模式", value: 0 },
              { label: "图片模式", value: 1 },
            ],
            placeholder: "请选择B站动态推送消息模式",
          },
        },
        {
          field: "mystery.permission",
          label: "woc权限",
          bottomHelpMessage: "设置woc权限",
          component: "Select",
          componentProps: {
            options: [
              { label: "所有人", value: "all" },
              { label: "主人", value: "master" },
              { label: "群主", value: "owner" },
              { label: "管理员", value: "admin" },
            ],
            placeholder: "请选择设置woc权限",
          },
        },
        {
          field: "mystery.forwarder",
          label: "转发谁的消息",
          bottomHelpMessage: "转发的消息中 谁发的消息",
          component: "Select",
          componentProps: {
            options: [
              { label: "触发该命令的人", value: "replyer" },
              { label: "机器人", value: "bot" },
            ],
            placeholder: "转发的消息中 谁发的消息",
          },
        },
        {
          field: "mystery.delMsg",
          label: "woc撤回时间",
          bottomHelpMessage: "自动撤回消息时间，单位秒， 0:不撤回",
          component: "InputNumber",
          componentProps: {
            min: 0,
            max: 65535,
            placeholder: "请输入自动撤回消息时间",
          },
        },
        {
          field: "mystery.wocUrl",
          label: "woc源地址",
          bottomHelpMessage: "自助换图片源，理论上支持市面上的图片接口",
          component: "Input",
          componentProps: {
            placeholder: "请输入woc源地址",
          },
        },
        {
          field: "mystery.imageCountLimit",
          label: "woc图片数限制",
          bottomHelpMessage: "限制图片数量",
          component: "InputNumber",
          componentProps: {
            min: 0,
            max: 100,
            placeholder: "请输入限制图片数量",
          },
        },
        {
          field: "mys.wikiMode",
          label: "wiki消息模式",
          bottomHelpMessage: "设置wiki消息模式",
          component: "Select",
          componentProps: {
            options: [
              { label: "图片模式", value: 0 },
              { label: "文字模式", value: 1 },
            ],
            placeholder: "设置wiki消息模式",
          },
        },
        {
          field: "mys.strategyMode",
          label: "攻略消息模式",
          bottomHelpMessage: "设置攻略消息模式",
          component: "Select",
          componentProps: {
            options: [
              { label: "图片模式", value: 0 },
              { label: "文字模式", value: 1 },
              { label: "分片式图片模式", value: 2 },
            ],
            placeholder: "设置攻略消息模式",
          },
        },
        {
          field: "game.limitTimes",
          label: "群战次数限制",
          bottomHelpMessage: "每人每天最多战斗次数",
          component: "InputNumber",
          componentProps: {
            min: 1,
            max: 65535,
            placeholder: "请输入群战次数限制",
          },
        },
        {
          field: "game.limitTop",
          label: "群战Top人数",
          bottomHelpMessage: "展示排行榜人数",
          component: "InputNumber",
          componentProps: {
            min: 1,
            max: 65535,
            placeholder: "群战Top人数",
          },
        },
      ],
      // 获取配置数据方法（用于前端填充显示数据）
      getConfigData() {
        const bilibiliSetData = {
          bilibili: xxCfg.getConfig("bilibili", "set"),
        };
        const gameSetData = {
          game: xxCfg.getConfig("game", "set"),
        };
        const mysSetData = {
          mys: xxCfg.getConfig("mys", "set"),
        };
        const mysterySetData = {
          mystery: xxCfg.getConfig("mystery", "set"),
        };

        return {
          ...bilibiliSetData,
          ...gameSetData,
          ...mysSetData,
          ...mysterySetData,
        };
      },
      // 设置配置的方法（前端点确定后调用的方法）
      setConfigData(data, { Result }) {
        const bilibiliSetData = xxCfg.getConfig("bilibili", "set");
        const gameSetData = xxCfg.getConfig("game", "set");
        const mysSetData = xxCfg.getConfig("mys", "set");
        const mysterySetData = xxCfg.getConfig("mystery", "set");

        const mergedData = {
          ...bilibiliSetData,
          ...gameSetData,
          ...mysSetData,
          ...mysterySetData,
        };

        const setedData = { bilibili: {}, game: {}, mys: {}, mystery: {} };

        for (let key in mergedData) {
          if (typeof data[`bilibili.${key}`] != "undefined") {
            setedData.bilibili[key] = data[`bilibili.${key}`];
          }
          if (typeof data[`game.${key}`] != "undefined") {
            setedData.game[key] = data[`game.${key}`];
          }
          if (typeof data[`mys.${key}`] != "undefined") {
            setedData.mys[key] = data[`mys.${key}`];
          }
          if (typeof data[`mystery.${key}`] != "undefined") {
            setedData.mystery[key] = data[`mystery.${key}`];
          }
        }

        xxCfg.saveSet("bilibili", "set", "config", {
          ...bilibiliSetData,
          ...setedData.bilibili,
        });

        xxCfg.saveSet("game", "set", "config", {
          ...gameSetData,
          ...setedData.game,
        });

        xxCfg.saveSet("mys", "set", "config", {
          ...mysSetData,
          ...setedData.mys,
        });
        xxCfg.saveSet("mystery", "set", "config", {
          ...mysterySetData,
          ...setedData.mystery,
        });
        return Result.ok({}, "保存成功~");
      },
    },
  };
}
