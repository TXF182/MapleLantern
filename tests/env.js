/* 灯台 MapleLantern — jsdom 测试环境 */
"use strict";
const fs = require("fs");
const path = require("path");

/* 复用本机已有的 jsdom（MapleBirchCE 仓库），避免为本工程再装一份 */
const JSDOM_PATH = "C:/Users/27352/Doubao/chats/2026-10-13/new-chat-2/MapleBirchCE/node_modules/jsdom";
const { JSDOM } = require(JSDOM_PATH);

const CORE = fs.readFileSync(path.join(__dirname, "..", "src", "core.js"), "utf8");
const INDEX = fs.readFileSync(path.join(__dirname, "..", "src", "render.js"), "utf8");

const HTML = "<!doctype html><html><head><meta charset='utf-8'></head><body>" +
  "<div id='ui-bar'><a>状态</a></div><div id='story'><div id='passages'>走廊尽头</div></div></body></html>";

function baseVars() {
  return {
    willpower: 40, willpowermax: 100,
    stress: 20, stressmax: 100,
    trauma: 10, traumamax: 100,
    arousal: 30, arousalmax: 100,
    tiredness: 600,
    money: 1234,
    worn: { upper: { name: "Shirt" }, lower: { name: "Skirt" }, butt_plug: { name: "SECRET-PLUG" }, genitals: { name: "SECRET-GENITAL" } }
  };
}

function createEnv(opts) {
  opts = opts || {};
  const seed = opts.seed || { v: 1, lang: "zh", motion: false };
  const vars = opts.vars || baseVars();
  let writes = 0;

  const dom = new JSDOM(HTML, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: "http://localhost/",
    beforeParse(w) {
      const proxied = new Proxy(vars, {
        set() { writes++; throw new Error("writes are forbidden"); },
        defineProperty() { writes++; throw new Error("writes are forbidden"); },
        deleteProperty() { writes++; throw new Error("writes are forbidden"); }
      });
      w.SugarCube = { State: { variables: proxied, passage: "School Hallway" }, Version: { major: 2, minor: 36, patch: 1 } };
      w.Time = { hour: 8, minute: 20, month: 3, monthDay: 14, weekDay: 1, dayState: "dawn" };
      w.Constants = { tiredness: { max: 2000 } };
      w.StartConfig = { version: "0.5.12.13" };
      w.__writes = () => writes;
      /* jsdom 没有真实布局：offsetParent 恒为 null，会让“可见性过滤”把面板内所有控件判成不可见 */
      Object.defineProperty(w.HTMLElement.prototype, "offsetParent", {
        configurable: true,
        get() { return this.isConnected ? (this.parentNode || w.document.body) : null; }
      });
      if (opts.host) {
        w.DoLGameUI = {
          ui: {
            apiVersion: 1,
            getCapabilities: () => ({ enabled: true, layout: "desktop", glass: true, motion: true, visualTier: "Fancy", backdropFilter: true }),
            getTheme: () => ({ id: "soft-wet", enabled: true, tokens: { neutral: "--dgu-surface", card: "--dgu-card", ocean: "--dgu-accent", mist: "--dgu-secondary", text: "--dgu-text", danger: "--dgu-danger", radius: "--dgu-radius", cardRadius: "--dgu-card-radius" } })
          },
          wardrobe: { apiVersion: 1 }
        };
      }
      if (seed !== null) {
        w.localStorage.setItem("MapleLantern.settings.v1", typeof seed === "string" ? seed : JSON.stringify(seed));
      }
    }
  });

  const w = dom.window;
  w.eval(CORE);
  w.eval(INDEX);
  if (!w.document.getElementById("ml-root") && w.document.readyState === "loading") {
    w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
  }
  return { dom, w, getWrites: () => w.__writes() };
}

module.exports = { createEnv, JSDOM_PATH };
