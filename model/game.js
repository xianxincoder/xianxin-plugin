import base from "./base.js";

export default class Game extends base {
  constructor(e) {
    super(e);
    this.model = "game";
  }

  async getRankData(rankData) {
    this.model = "rank";
    return {
      ...this.screenData,
      saveId: "rank",
      rankData,
    };
  }

  async getMyPkData(mypkData) {
    this.model = "mypk";
    return {
      ...this.screenData,
      saveId: "mypk",
      ...mypkData,
    };
  }

  async getTimeData(timeData) {
    this.model = "time";
    return {
      ...this.screenData,
      saveId: "time",
      ...timeData,
    };
  }

  async getGobangData(gobangData) {
    this.model = "gobang";
    return {
      ...this.screenData,
      saveId: "gobang",
      ...gobangData,
    };
  }
}
