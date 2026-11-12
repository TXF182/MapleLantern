/* 灯台 MapleLantern — jsdom 测试环境 */
"use strict";
const fs = require("fs");
const path = require("path");

/* 复用本机已有的 jsdom（MapleBirchCE 仓库），避免为本工程再装一份 */
const JSDOM_PATH = "C:/Users/27352/Doubao/chats/2026-10-13/new-chat-2/MapleBirchCE/node_modules/jsdom";
const { JSDOM } = require(JSDOM_PATH);

const CORE = fs.readFileSync(path.join(__dirname, "..", "src", "core.js"), "utf8");
const NATIVE = fs.readFileSync(path.join(__dirname, "..", "src", "maplelantern-native.js"), "utf8");
const INDEX = fs.readFileSync(path.join(__dirname, "..", "src", "render.js"), "utf8");

const HTML = "<!doctype html><html><head><meta charset='utf-8'></head><body>" +
  "<div id='ui-bar'><a>状态</a></div><div id='story'><div id='passages'><div class='passage'>走廊尽头" +
  "<a class='link-internal macro-link' data-passage='Garden'>(1) 花园 (0:01)</a>" +
  "<a class='link-internal' data-passage='Inline'>行内</a></div></div></div>" +
  "<div id='stats'><div class='content'><div class='first-row'><div class='centered-elements'>" +
  "<div><img src='sidebar-open.png'></div>" +
  "<div><span class='true'>£9,998.99</span></div>" +
  "<div><span class='clockContainer'>07:48</span></div>" +
  "<div><img src='sidebar-day.png'><span>Sun</span></div>" +
  "</div></div></div></div>" +
  "<div id='statmeters'>" +
  "<div id='paincaption' title='Pain: 0.00'><div>疼痛：</div><span>你感觉良好。</span><div class='meter'><div class='greenbar' style='width:0%'></div></div></div>" +
  "<div id='arousalcaption' title='Arousal: 24.53'><div>性奋：</div><span>情欲在你的体内积累。</span><div class='meter'><div class='tealbar' style='width:24.53%'></div></div></div>" +
  "<div id='tirednesscaption' title='Fatigue: 4.50'><div>疲劳：</div><span>你的精力充沛。</span><div class='meter'><div class='bluebar' style='width:4.5%'></div></div></div>" +
  "<div id='stresscaption' title='Stress: 0.00'><div>压力：</div><span>你心如止水。</span><div class='meter'><div class='purplebar' style='width:0%'></div></div></div>" +
  "<div id='traumacaption' title='Trauma: 39.80'><div>创伤：</div><span>你有些紧张。</span><div class='meter'><div class='pinkbar' style='width:39.8%'></div></div></div>" +
  "<div id='controlcaption' title='Control: 0.00'><div>自控：</div><span>你感到不安。</span><div class='meter'><div class='redbar' style='width:0%'></div></div></div>" +
  "<div id='allurecaption' title='Allure: 0.00'><div>诱惑：</div><span>偶尔会有人偷偷看你几眼。</span><div class='meter'><div class='tealbar' style='width:0%'></div></div></div>" +
  "</div>" +
  "<div id='mobileStats'><div class='weatherIcon'><img src='weather.png'></div><div class='stat time'><span>07</span><span class='vertical'>:</span><span>48</span></div><div class='stat green'>P</div></div>" +
  "<div id='customOverlayContainer' class='customOverlayContainer hidden'><div id='customOverlay' class='customOverlay hidden' data-overlay='options'><div id='customOverlayTitle'>Options</div><div id='customOverlayContent'><p>选项</p></div></div></div>" +
  "</body></html>";

function baseVars() {
  return {
    willpower: 40, willpowermax: 1000,
    stress: 20, stressmax: 10000,
    trauma: 10, traumamax: 5000,
    arousal: 30, arousalmax: 10000,
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
        const caps = Object.assign({
          enabled: true, layout: "desktop", glass: true, motion: true,
          visualTier: "Fancy", backdropFilter: true
        }, opts.hostCaps || {});
        w.DoLGameUI = {
          ui: {
            apiVersion: 1,
            getCapabilities: () => caps,
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
  w.eval(NATIVE);
  w.eval(INDEX);
  if (!w.document.getElementById("ml-root") && w.document.readyState === "loading") {
    w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
  }
  return { dom, w, getWrites: () => w.__writes() };
}

module.exports = { createEnv, JSDOM_PATH };
