import base from "./base.js";

export default class Game extends base {
  constructor(e) {
    super(e);
    this.model = "game";
  }

  async getRankData(rankData) {
    return {
      ...this.screenData,
      saveId: "game",
      rankData,
    };
  }
}
