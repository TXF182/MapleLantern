# 灯台 · Lantern（MapleLantern 1.5.4）

- **1.5.4 · DolSmartPhone 手机弹窗关闭键修复**：DolSmartPhone 的消息弹窗复用了灯台原生模式的 44px 遮罩关闭区，在 300px 弹窗里被放大成一排大 X、压住正文；现在按手机弹窗容器恢复原版 24px 紧凑 X，灯台自己的遮罩关闭键仍保持 44px 大点击区。真实浏览器计算尺寸 44×44 → 24×24、正文遮挡 12.41px → 0；十文件 **258/258** PASS。

- **1.5.3 · 长列表性能收口**：商店长列表与分批加载只处理新增商品，稳定页不再重复扫描选项链接；商店内点击只补扫一次，关闭原生卡片后不再每拍清理整页标记。九文件 **255/255** PASS。

- **1.5.2 · 商店按钮修复**：修复商店「筛选 / 选项 / 图例」点不动（1.5.1 把按钮收进工具栏时误删内部链接节点）；恢复后可在「选项」里改商品默认主色 / 副色，含黑色、自定义与随机。九文件 **247/247** PASS。

- **1.5.1 · 绿茵与主题边饰**：新增「绿茵」阳光草场浅色主题（割草条纹、斑驳阳光、球场白线、组件青绿描边）；新增「主题边饰」，正文四周随主题换纹样，可总开关；新增「正文文字色」，跟随主题 / 主题预设 / 自定义取色，只改故事正文且按主题底色校验 4.5:1；删除「石墨」主题，旧设置回落默认主题。九文件 **246/246** PASS。

- **1.4.22 · 侧栏金额/时间/日期切换修复**：点 `#stats` 后宿主用 `<<replace #stats>>` 重建统计条，灯台补上点击后重扫；展开态的 `.left-fixed` 开关与 `.second-row` 日期搬回 `.centered-elements`，四格重新按 3×2 排布。图标路径被翻译包改写时，按首尾格与星期文本兜底识别。九文件 **236/236** PASS；真实档展开/收起两态金额完整、日期不竖排。

- **1.4.21 · 商店分类栏与分页器排布修复**：`#shopCategories` 的分类链接不再被正文选项逻辑打包，图标与链接留在 44px 分类格内（6 列 3 行），并复位原版 `skewX`；`#shop-pagination` 链接清掉整宽卡片外观，窄屏保留原版“隐藏文字、只显示箭头”，圆点内链接填满 17px，不再竖排溢出。八文件 **218/218** PASS；真实档 14 个分类格 44×44、分页条 294×34、横向溢出 0。

- **1.4.20 · 箭头归位 / 纸灯时间加深 / 手机侧栏安全布局**：非 CE 弹层的 `numberStepper` 恢复 32×32、零内边距与透明底，作弊核心属性行不再把 `|< … >|` 挤到格子外；纸灯左轨时间与顶部时钟改为墨色；关闭顶部四格时，窄屏仍用 3×2 网格排金额/时间/日期，并取消时间 `scale(1.3)`，金额截断与时间覆盖金额不再出现。八文件 **216/216** PASS。

- **1.4.22 · 侧栏开合、正文入场与按压反馈**：`#ui-bar` 收起/展开当帧同步 `data-ml-sidebar-open`，不再等下一轮补扫；正文入场动画移除 `translateY`，避免 `animation-fill-mode:both` 把 fixed 提示困在 `.passage` 内；所有按钮/选项按压改为只缩放不下沉，按压层抬高避免被相邻卡片盖住；前景背景入口查找扩到 `#overlayButtons` / `#ui-bar` / `#menu`。新增 S12b、B1、A1、D1/D2 回归。

- **1.4.19 · 纸灯深色卡片规则收窄与深色浮窗 `.black` 校正**：移除 1.4.18 对 `.traitList .trait` 的统一浅字，避免基础游戏无背景特质卡在纸灯下浅底浅字；只保留确有深底的便利店容器 `.ConveniencestoreGoodsClass > div`，并补卡内 `.black`。非纸灯主题的 `#customOverlayContent` 内，第三方 `.black` 说明文字改为当前主题正文色，避免黑底黑字。

- **1.4.18 · 手机侧栏点击与浅色主题可读性**：侧栏开合同步收窄到真实 `#ui-bar-toggle`，点金额/时间/状态等侧栏内部区域不再补挂 `data-ml-sidebar-open`、不再把 `#story` 隐藏。纸灯浅色主题下，原版优化便利店 `.ConveniencestoreGood` 深底容器恢复浅字与原生亮色语义变量。新增 S12 行为回归与纸灯深色卡片契约断言；初版对 `.traitList .trait` 的覆盖已在 1.4.19 收窄。

- **1.4.17 · MEE 同载启动崩溃修复**：MEE 1.0.4 的 `mee.excrete = function(){}` 末尾缺分号，紧接着的灯台 `core.js` 以 `(function…)()` 开头，ASI 把 `excrete` 当成被调用者，`V.daily` 缺失时抛 `reading 'excretes'` 并中断灯台脚本。现在 `core.js` 以**前置分号**开头断开连接；`inject-early` 兼容层仅作运行期兜底。新增 ASI 回归测试；全量 **212/212** PASS；真实 `file://` 装载 `ERRORS []`、`mounted=true`。

- **1.4.16 · 成就页图标修复**：成就行图标列固定 30px，但已解锁金币原图 74px 没有被缩放，溢出后压住标题。现在 `.featImage` 按 `border-box` 计算，内部 `img` 统一 22px（实际外框 24px）并 `object-fit:contain`，金币与未解锁圆点都归位。新增 S11 回归；七文件全量 **208/208** PASS；390 与 1080 宽度实测图标列 30px、图片 24px、文字起点在图片右侧。

- **1.4.15 · 随身衣物左侧点击修复**：MEE「随身衣物」页打开后，灯台全屏 `#customOverlayContainer` 的 `pointer-events:all` 会挡住左侧 `#ui-bar` 衣物图标。现在只在该页（桌面 ≥701px）给容器加 `data-ml-overlay-host="carriedclothes"` 并放行指针事件，弹层自身恢复点击；切页撤销标记，其他弹层与手机遮罩不受影响。七文件全量 **207/207** PASS；Edge 真实命中测试通过（修复前点容器、修复后点左侧按钮）。

- **1.4.14 · 电脑端排版与随身衣物**：非 CE 的 `.settingsToggleItem` 恢复块级流，BasicNeeds 膀胱/大便步进器与说明不再和 `<br>` 挤在一行；MEE 随身衣物槽恢复 `auto-fill` 多列，不再纵向塌成一列。灯台按 `#titleCarriedclothes` / `.clothing-takeback-button-container` 识别随身衣物叠层，补写 MEE 依赖的 `T.currentOverlay`，衣服可以正常“放进随身衣物”。桌面正文宽度改为 `min(100%,1100px)`，不再被压成 72ch 手机栏；`#bn-panel` 8 行改成独立卡面（文字换行与 7px 轨道都不再依赖状态卡皮肤开关）；`#mobileStats` 左轨加上下滚动，第三方追加项不再落到视口外。七文件全量 **206/206** PASS；第三方几何仿真 **45/0**。

- **1.4.13 · 第三方模组适配**：BasicNeeds 0.5.0 的背包详情盒原本挂在 `#customOverlay` 右外侧，被灯台面板 `overflow:hidden` 裁掉，「吃掉/喝掉」点不到；现在只在背包页把它收进面板右侧栏，≤760px 改底部抽屉，内容区留出内边距。MyExhibitionism 1.0.4 的「随身衣物」页被其 `left:10px`、窄屏 `left:-17.6em !important`、`height:40%` 推出屏幕，灯台侧用更高特异性拉回居中全高且不覆盖宽度；四条状态行补 1000 上限。另修正自控/氧气被二次反向的问题（原版 `statbarinverted` 只换配色，条宽仍是 current/max）。七文件全量 **205/205** PASS；第三方几何仿真 **84/0**（1280 / 900 / 761 / 760 / 600 / 540 / 390 七档）。

- **1.4.12 · CE 设置页恢复桌面双列**：CheatExtended 1.20.4 的设置页复用 DoL 原生 `.settingsGrid`；此前按 520px 最小列宽在常见桌面面板宽度下退成单列，表现为“作弊菜单像手机端”。现在回到原版 48.5% 双列、同一行等高拉伸，卡片不再 `overflow:hidden` 裁 tooltip/焦点框；规则只挂 `#cheat_extended_options ~ *` 与 `#CE_settingsDiv`，游戏原生 Options 在 900px 宽桌面仍保持双列。新增 CE 设置页几何探针 **24/0**（1280 / 900 / 390，含原生 Options 对照、同行等高、越界与互压）；七文件全量 **201/201** PASS。

- **1.4.11 · 属性卡/社交卡去布局覆盖**：通用 `.characteristic-box-list` 恢复原生 `flex-wrap`，属性、技能、成绩、职业页不再被统一 grid 挤压；`.relation-box-list` 与 `#global-recognition` 同样保留原生网格/换行。`#sex-diagram` 仍保留左右 50% 双列与窄屏 100% 单列。桌面上不再出现「很多选项错位」。属性页几何探针扩到 5 个平铺列表，桌面 + 手机 **73/0**；七文件全量 **201/201** PASS。

- **1.4.10 · 属性页错位修复**：`#sex-diagram` 恢复原版左右两列 50% flex，通用 `.characteristic-box-list` 的 grid 只用于正文/成绩平铺卡；`optOverlay` 扩为「原生弹层/属性卡」，关闭后属性页完全回原版卡片与布局。桌面 1280 与手机 390 几何探针 13/0，七文件全量 **201/201** PASS。

- **1.4.9 · 原生 UI 模块开关**：新增「开关」页，9 项独立控制——顶部四格、金额两位小数、手机左轨外观、左轨百分比、状态大卡外观、状态卡数值、正文选项卡片、侧栏按钮卡片、原生弹层/属性卡。CSS 以 `html[data-ml-native="on"] + data-ml-opt-*` 逐模块 gate，关一项只撤该模块；弹层容器 z-index/可见性、手机视口宽度、`<=899px` 左右归零、侧栏抽屉等结构约束保持常开。单测 **200/200** PASS。

- **1.4.8 · 美化页入口**：检测到 Dynamicest「极致动态」、前景背景 DecoMod 等第三方美化设置页时，仍在该页插入「灯台」入口，不再因为第三方控件存在而整页跳过；只有检测到第三方页且它可见时才默认只插入口、不把原生卡片套到别人的设置页，普通页面仍按「原生卡片」开关立即生效。玩家可在设置「美化页启用灯台 UI」里显式启用，收起第三方页后原生层自动恢复。

- **1.4.7 服饰名接游戏汉化 + 页签光线**：着装页不再只读 `item.name`，改为优先读 ModI18N 追加的 `cn_name_cap` / `cn_name`（中文界面显示“夏日连衣裙 / 发卡 / 校服鞋 / 女式运动袜 / 普通内裤 / 夏日半身裙”，英文界面仍保留游戏原名），缺失或空白时回落原名，不二次翻译、不伪造。取证：`i18n.json` 的 `clothing-upper.js` 补丁 `Sundress → cn_name_cap:"夏日连衣裙"`、`clothing-feet.js` `School shoes → 校服鞋`、16 处 `Naked → 赤裸`，以及正文 `$worn.upper.cn_name_cap` 等 3,187 条引用；实档 `state.delta[0].variables.worn` 14 槽全部带 `cn_name_cap`。页签下划线由每标签独立淡入改为单一 `.ml-tab-glint` 光线，按真实 `offsetLeft/offsetWidth` 滑向当前标签（ColorOS“光承担状态指引”的延伸）。单测 **193/193** PASS。

- **1.4.6 浮窗卡片底图（第三张图）**。设置页「灯台外观」在按钮底纹之后新增第三组：**导入浮窗卡片 / 移除 / 适配（等比 · 拉伸）/ 不透明度 0–100%（默认 70）/ 缩放 50–200%**，图库存键 `card`，与 `bg` / `btn` 互不复用。落点是**游戏原生浮窗的卡片本体** `#customOverlayContent` 与 `#ui-dialog-body`（存档、设置、选项弹窗这一类），外层 `#customOverlay` / `#ui-dialog` 不铺，避免两层底图叠成双影。三条实测口径：① 原生层给这两个容器写的是 `background-attachment: fixed`，换图时必须显式收回 `scroll`，否则图按视口固定、弹窗一动就错位；② 手机端（≤899px）原生还用 **`!important` + 双 ID** 锁死 `fixed/cover/no-repeat`，所以本包规则同样用 `!important` + 双 ID（`#customOverlayContent#customOverlayContent`），并按 Selectors L4 现算特异性做断言（否则手机上必然被反压）；③ 不抢第三方皮肤：ModLoader GUI（`#customOverlay[data-overlay="modloader"]`）与 CE 面板（`#cheat_extended_options / #CE_settingsDiv / .CEtab / .CEbuttonBar / .CEDISPLAY / #mce-root`）整条排除，名单与 native.css 同一份；两条容器规则拆开写，`:has` 不可用的老 WebView 只会「卡片图不出现」，不会把 CE 底板改坏。另：本包只对 `background-size/position/repeat/attachment` 用 `!important` 保证定位，`background-image` 不加，第三方自己写的行内底板仍然优先（CE 面板上卡片图不生效属明确取舍）。预览舞台的样例卡片改为代表浮窗卡片（拖它调 `cardX/cardY`，双击居中），样例选项仍只调按钮底纹；旧档图缺 `w/h` 时按 3:2 估比例，避免拖动余量算出 Infinity。设置键 `cardOn/cardOpacity/cardFit/cardZoom/cardX/cardY`，变量 `--mlc-card-op/-veil/-img/-size/-pos`，属性 `data-mlc-card`（舞台侧 `data-mlc-stage-card`）；复位新增「复位 · 浮窗卡片」。新增 `tests/custom-card.test.js` 10 条（含 mobile 级联对抗），单测 **185/185** PASS；moli 真实浏览器四场景核对：普通浮窗与对话弹窗=卡片图生效（`scroll, scroll / auto, 120% auto / 0px 0px, 30% 80%`），ModLoader GUI=原生 `fixed/cover`，CE 面板=维持原生排除（无卡片图）。



- **1.4.5 背景图根因锁定：DoL 的 CSP 把 `blob:` 拦掉了**。1.4.0 起图库一律用 `URL.createObjectURL` 出地址，而真实 `Degrees of Lewdity.html` 的 `<head>` 里写着 `<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-eval' 'unsafe-inline' *; img-src 'self' data:; font-src 'self' data:">`——`img-src` 只放 `'self'` 与 `data:`，所以 `--mlc-bg-img` 有值、`#mlc-bg` 的 `background-image` 有值、`opacity:1`、rect 满屏，**像素却一个都不画**（CSP 违规指令实测为 `img-src blob`）。宿主 `tests/custom-host.html` 没有这条 CSP，所以在宿主要是全绿、玩家侧全白——这就是「电脑手机都没用」的真因。修法：`Assets` 新增 `dataUrlFor(key, blob)`（`FileReader.readAsDataURL`，按 blob 缓存，同一张图只编码一次），`custom.js` 启动装配与面板的导入 / 应用背景 / 读图三条路径全部改走它；`urlFor` 降级为同步取已编码结果，不再产 `blob:`。真机取证（`tests/_diag_realinject.py`，注入真实源码到 64 MB 页面）：改前页面像素与判据图（左红右绿）完全不符、舞台内 `(23,28,34)` 一片暗；改后 `--mlc-bg-img = url("data:image/webp;base64,…")`，页面 `(40,300)→(161,38,39)`、`(350,300)→(50,203,77)`，舞台内 `(30,60)→(221,30,31)` 纯红、`(200,60)→(29,200,60)` 纯绿——**图真的画出来了**。宿主新增断言「背景图载体必须是 data: URL（blob: 会被 DoL 的 CSP 拦掉）」并先红后绿；单测 157/157、宿主 58/0、六档视口 49/0。版本双源一致性改由测试强制（`boot.json.version` 必须等于 `dossier-core.js` 的 `VERSION`）。
- **1.4.4 背景真的看得见了（默认不透明度 100 + 承载层归位）**：玩家换真图仍报「还是没有」。用脚本 headless 加载真实的 64 MB `Degrees of Lewdity.html` 逐层 dump，拿到决定性事实：`html` 背景 `none`、`body` 底色 **`rgb(17,17,17)` 不透明**、`#story` 是 **`position:static`**（它的 `z-index:10` 不生效、不建层叠上下文）；`#ui-overlay`(z 100000) / `#ui-bar`(z 298) / `#init-screen`(z 500000) 六个 fixed 浮层都在内容之上但各有明确用途。据此**推翻"被遮挡"的猜测**：`#mlc-bg`（z -1）一直画在 body 底色之上、内容之下，这条路是通的；真因是**背景不透明度只有 45%（旧默认 60%）**，一层同色遮罩压上去，那张深绿立绘直接被洗成背景色，视觉上等于没变。修法三件：① `#mlc-bg` 重新完整承载图（`background-image/position/size/repeat/attachment` + `opacity: var(--mlc-bg-op,1)` + `filter: blur(var(--mlc-bg-soft,0px))`），`body` 回退为 `background-color: transparent !important; background-image: none !important`；② `CUSTOM_DEFAULTS.bgOpacity` 60 → **100**，`planVars` 在 100 时把 `--mlc-bg-veil` 给 `transparent`（不再铺同色遮罩）；③ `alignForBackground()` 扩成两条：面板遮蔽 ≥80 → 45、背景不透明度 <80 → **100**，「导入背景图」与「应用背景」都走它，并在提示行写明顺带改了什么。单测 157/157、真实 DOM 宿主 55/0、六档视口 49/0。导入后实测面板外像素 `(48,49,100)→(91,95,50)`、`(58,69,109)→(83,89,121)`，刷新后保持不变。
- **1.4.3 按钮底纹立成按钮 + 新增「应用背景」**：验收时发现普通选项在原版是**内联文字链接**（宿主实测 rect 107×25），底纹只铺在文字宽度那一条上，看着像"贴着字的色块"而不是按钮——**预览舞台一直画的是盒子，等于预览骗了人**。现在只在 `data-mlc-btn="on"` 时把选项立成整行按钮盒（`display:flex`、`width:100%`、`min-height:44px`、`padding:10px 14px`、描边与圆角），实测 107×25 → **334×49**，关掉开关立刻回原样；对灯台自己的 `.ml-option-group` 另写一条同特异性规则压住它的 `padding:0 !important`。另在「灯台外观」的页面背景下方新增 **「应用背景」** 按钮：从图库重新取出背景/按钮底纹两张图、重建 objectURL、整份设置重放、读一次 body 布局强制同步重排，然后把真实状态写进提示行（`已应用 · 背景 90% · 按钮底纹 70% · 面板遮蔽 45%`；没图会说"还没有图"、开关关着会说"已关闭"）。导入后觉得没变化就点它，不必退出设置页或刷新游戏。宿主断言 52/0，单测 156/156。
- **1.4.2 背景图「导入了却没变化」修复**：图确实铺上了（`data-mlc-bg=on`、`#mlc-bg` 390×844、`background-image` 正常、body 已让位），但**灯台面板自己的底板 `--ml-panel-bg = rgba(主题色, var(--ml-surface-alpha))` 默认 0.92 不透明**，而「底纹遮盖」滑杆写的是 `--mlc-surface-alpha`，两套变量没接上——滑杆只动得了本包舞台，动不了真正盖住背景的那层。同时设置页里的分组卡片写死 88% 不透明，面板调透后卡片仍替它挡图。现在：① `html[data-mlc] #ml-root` 的 `--ml-surface-alpha` 接 `--mlc-surface-alpha`（滑杆 100% = 纯色面板，0% = 全透）；② 分组卡片底色改吃 `--mlc-surface-a`（默认 90% 与原观感一致）；③ 新增 `Core.alignForBackground`：第一次开背景时若遮蔽 ≥80% 自动调到 45%，提示行写明「面板遮蔽已顺带调到 45%，不然背景透不出来」，玩家可再改。滑杆文案改为「面板遮蔽」并加一行说明。宿主新增**像素级断言**（截图取色，要求蓝分量 B−R ≥ 25），从此"图有没有真的画出来"由像素判，不再只信 computed style。
- **1.4.1 图片导入修复与格式矩阵**：修掉「导入必失败」——`dossier-assets.js` 的 `decode()` 在 `createImageBitmap` 分支直接返回 ImageBitmap 本体，而 `process()` 按 `dec.source` 调 `drawImage`，于是主流浏览器上 `dec.source === undefined`，报 `Failed to execute 'drawImage' ... not of type ...`。现统一包成 `{source,width,height,release}`（并 `close()` 释放），错误文案本地化为「图像类型不支持 / 格式不支持或文件已损坏 / 文件过大」。新增 `tests/custom_formats.py` 真实矩阵（390×844 dpr2，File→`Assets.process`，产物再解码复验）：**可用** JPEG（含 CMYK、EXIF Orientation=6 会正确旋转 400×200→200×400）、PNG（透明保 alpha、4000×3000 降到 1200×900、1×1 不崩）、WebP 静态与动图（取首帧）、GIF 动图（取首帧）、BMP、ICO、AVIF、SVG、无 MIME（走内容嗅探）；**被友好拒绝** TIFF。导入后对小图（长边 <200 px）与极端比例（>3:1）给软提示，不拦导入。格式矩阵 18/0。
- **1.4.0 玩家自定义外观（灯台本体功能）**：设置页新增「灯台外观」组，含实时预览舞台（按当前视口比例铺缩样页面，舞台里 2 段样例正文 + 2 条样例选项 + 1 张样例卡片）。玩家可自己导入**页面背景图**与**正文选项底纹**（`<input type=file>` → canvas 降采样 → IndexedDB 图库 `MapleLanternDossier.assets.v1` / store `images`，键 `bg` / `btn`，窄屏压到 1200 px、宽屏 1600 px，单张上限 15 MB）。适配方式（铺满 / 完整 / 拉伸）、缩放、模糊、不透明度实时生效；**拖动**舞台改背景位置、拖样例选项改底纹位置，**双击**回正中，舞台下方常显`位置 · 背景 50% / 42% ｜ 按钮 50% / 50%`。另有正文选项字号 80–140%、底纹遮盖 0–100%、四色（强调 / 面板 / 正文 / 描边，附对比度读数）与「同步给灯台」开关（默认开）；复位是分项（背景 / 按钮底纹 / 颜色 / 字号与遮蔽）+ 恢复出厂，恢复出厂不动已导入的图库。
- **1.4.0 工程要点**：`dossier-core / dossier-assets / dossier-theme / dossier-panel + custom.js + custom.css` 并入 `src/`，本体原三 js 三 css 一字未改；`boot.json` 的 `name` 仍是 `MapleLantern`，玩家导入即顶替 1.3.8，不会多出第二个模组。挂点全用灯台自己的：背景层 `#mlc-bg`（开图时压住 html 的 `--mln-page-texture`），底纹挂 `#passages .passage a.link-internal:not(.macro-link)`，字号 `--mlc-font-scale` 只乘正文选项自身；变量前缀 `--mlc-*`、属性 `data-mlc` / `data-mlc-bg` / `data-mlc-btn`。图库 url 按 blob 复用（换图不再 revoke 新地址导致空白），舞台空态选择器用 `[data-mlc-bg="0"]`。
- **1.3.8 孩子详情配色**：`maplelantern-native.css` 对 `#passages .passage .childDetails` 恢复 `var(--100, #eee)`，类型值不再继承主题青蓝；`Type:` 金色标签、姓名输入框与图标不变。新增契约测试，全量 131/131 PASS。
- **1.3.7 滚动模糊摘除**：≤899px 面板滚动窗口内由 `render.js` 加 `data-scrolling="1"`，`style.css` 双写 `-webkit-backdrop-filter:none` / `backdrop-filter:none !important`；`body` 与 `window` 各挂 `{ passive:true }` 滚动监听，停止 160ms 后摘标记恢复。真实 1.3.7 包面板滚动 5 轮 **3.07–3.77ms，均值约 3.40ms**（1.3.6 同环境 3.63–5.18ms）；A/B 注入基线 `3.69/3.38/4.97ms` → 滚动期关模糊 `3.15/2.92/2.40ms`。滚动中计算值 `none`，停止后恢复 `blur(12px) saturate(1.1)`。
- **1.3.6 手机端再收口**：在 1.3.5 全局静态的基础上，≤600px 再隐藏 `.ml-ambient__veil` 整幅慢流层与 `.ml-ambient::before` / `::after` 两条主题光带，粒子 3→2；只保留静态天空层（星场/天光）和 2 颗静态粒子。实测去首轮页面滚动均值 **6.66ms**（1.3.5 约 13.05ms），面板滚动均值 **13.16ms**（1.3.5 约 14.54ms）；桌面/平板动画与光带不变。
- **1.3.5 性能收口**：星空 `--mln-page-texture` 从 87 层压到 9 层（6 个基础渐变 + 3 个 `html` 底色层），逐点星层改为天空层 `--ml-sky-dust` 的 2 条平铺星尘（220/280px 重复），全屏仍有星场但不再为每颗星建一个 fixed 层。手机 ≤600px：粒子 5→3，环境层整体 `animation:none` + `will-change:auto`，`inset:-6vmax` 收到 0；面板打开时 `display:none`，不再在面板滚动时绘制环境层。面板模糊 ≤899px 由 JS 封顶 12px（不再被 inline `--ml-blur` 绕过），CE `.dol-shadow` `blur(10px)→6px`。
- **1.3.4 天空层**：环境层新增第 10 个节点 `div.ml-ambient__sky[data-layer="sky"]`，放在 8 颗粒子与慢流之后；顶部天光底负责整幅天色与星场，下缘地平光负责空白区，斜向极光带保持 104° 慢流。新增 `ml-sky-glow` / `ml-sky-ribbon` 两条 keyframes（30–44s，只动 `transform/opacity`）。星空主题星点 12→14 颗并提亮；`auto` 四时段补 `--ml-sky-a/b/c/c2`，夜间另补 6 颗星；旧地平光与天光带也改吃同一组变量，夜里不再留固定暖橙；九主题 `--ml-sky-opacity` 独立（赛博 `.58`、琥珀 `.56`、青瓷 `.48`、石墨 `.36`、星空 `.68`、雾港 `.70`、旧校舍 `.40`、纸灯 `.36`、auto `.62`）。三路关断与 `prefers-reduced-motion` 仍整层 `display:none`。
- **1.3.3 顶栏重排**：对照原版把四列定宽改成两行三列：开关跨两行并竖直居中，金额与时间在上（时钟图标与时间同排），日期整行在下。280 宽日期格 44→233px，216 宽仍有 169px；`星期日 9月4日` 与 `£9,474.99` 不再裁切，金额格不会被挤成 `£9,4`。`markStats()` 增加 `ml-src` / `ml-replaced-src` 与中文星期兜底，翻译改图后日期格仍能标记。
- **1.3.2 作弊层修复**：原版 `<=870px` 把 `.customOverlay` 左移 `-17.6em` 贴住 280px 侧栏；灯台已把容器改成全视口 fixed，这条会把 CE 层推出屏幕左侧，表现为“左半屏有内容、右半屏星空空白”。`<=899px` 把 `#customOverlay` 的 `left/right` 归零，540 视口下从 `x=-281.6 / right=242.4` 恢复到 `x=0 / right=524`，360 视口 `x=0 / right=344`。侧栏展开时另给 `#customOverlayContainer` 补 `visibility:visible` / `pointer-events:auto`，避免容器落在 `#passages` 子树内被抽屉隐藏一起吞掉。
- **1.3.1 手机尺寸适配**：侧栏抽屉阈值从 430 提到 560，540 级视口展开侧栏也隐藏正文，不再出现两字列；面板抽屉左右留 `max(safe-area, 8px)` 安全边，320 级收到 6px；844×390 横屏抽屉限宽 560px 并居中，不再拉成整屏横条；≤360 圆环收到 88px、正文内边距 12px。六档 320/360/390/430/540/844×390 面板均不越界、页签 44px、无横向文档溢出。
- **1.3.1 叠加修复**：原生作弊/菜单层由隐藏变可见时自动关闭灯台浮卡；`#customOverlay` 节点换代后观察器重挂；点击原生入口后 80ms 补关。
- **1.3.1 特效增强**：九主题环境层整体提亮，新增整幅 `veil` 慢流（34–46s，只做 transform，不用 blur）；`auto` 按游戏时段 `data-phase`（黎明/白天/黄昏/夜晚）换环境色，并新增 `ml-sky-band 26s` 斜向天光带；雾港环境层 `1.0` + veil `.44` 为最强档。手机 ≤600px 仍只保留 5 颗粒子 + veil，面板打开降 55%，三路关断与 `prefers-reduced-motion` 整层隐藏不变。

- **1.3.0 主题与动效收口**：新增雾港 / 旧校舍 / 纸灯三套主题；动效 token、24 个 keyframes 与 4 个可选工具类独立到 `effects.css`；原生 280/64/256 几何保持不变。
- **保住的窄屏修复**：顶栏四格、金额 nowrap 单行、日期横排、状态卡 `#stats 100%`、状态条 200px/轨道 64px、选项单列 20px 图标。
- **回归护栏**：单测新增“不得再次覆盖 #img / canvas / #ui-bar 宽度”，原生几何被改写会直接失败。

Degrees of Lewdity `0.5.12.13` / SugarCube `2.36.1` 的**只读信息台 + 原生 UI 替换层** UI 模组。

- **默认直接替换原版呈现**：顶栏金钱/时间/星期改四格卡片，七行状态数值收进一张状态大卡，正文选项改整行卡片，侧栏按钮、弹层、对话框统一卡片语言。只改呈现，不碰业务数值与存档。
- 原生卡片开关默认**开**；悬浮灯台默认**关**，入口在 `OPTIONS` 弹层顶部「灯台」行，也可用 `Alt+L` 唤起。
- 此刻 / 身心 / 着装 / 系统 / 设置 五个页签；「此刻」页保留时间、金钱、场景与身心速览。
- 自动跟随 DoLGameUI 4.x 的强调色与圆角；**检测到主 UI 时不再关闭本包原生层**（1.1.6 及以前会整层让位，导致 Android 上面板已更新、正文却退回宿主卡片）。
- **默认主题为赛博朋克**：深蓝黑底、青蓝主光、洋红副光、静态网格与霓虹描边；琥珀 / 青瓷 / 星空 / 雾港 / 旧校舍 / 纸灯 / 绿茵仍可在设置里切回。
- **主题纹理层**：琥珀为暖金纸纤维 + 斜细纹，赛博为霓虹网格 + 斜线，青瓷为斜丝 + 织纹 + 釉光带，星空为紫蓝星云 + 星点 + 银河带，雾港为冷青海雾横纹 + 暖金雾灯，旧校舍为粉笔格 + 旧木纹，纸灯为宣纸纤维 + 朱红，绿茵为割草条纹 + 斑驳阳光 + 球场白线；面板、正文、卡片三层分别落点，原生顶栏 / 弹层 / 状态卡 / 正文同步换纹理。
- **主题环境层（1.3.0）**：九套主题各有边缘粒子与专属伪层，统一 `#ml-root .ml-ambient` 固定底层，`pointer-events:none`、`contain:layout paint style`，中央正文留空；≤600px 只留 5 颗，动效关闭或系统减少动态时整层 `display:none`。雾港额外一层呼吸雾带；8 颗粒子的位置/尺寸/相位在每次挂载时做一次边缘随机抖动，只在 CSS 变量上写一次，不进每帧循环。面板打开时环境层降到 55%（220ms），标题栏同时一次 420ms 细光扫过；星空每 15s 一颗右上流星，雾港第二层雾带再叠第三团下缘远景雾。
- **动效层（1.3.0）**：三套面板环境光 26/31/22s、发丝线 7s、页签 200ms、表盘 5.6s；原生侧栏 28/32/24s 光带，`background-image` 用 `ambient + texture` 五层合成，不能为动效丢掉纹理；按钮/分段/卡片 hover 1–2px。三路关断（`data-motion=off` / `data-ml-motion=off` / `prefers-reduced-motion`）全部 `none`。
- **动效库分区（`effects.css`，1.3.0）**：`--ml-fx-dur-*` 时间、`--ml-fx-ease-*` 缓动、24 个公共 keyframes 与 `.ml-fx-pane/.ml-fx-hairline/.ml-fx-breathe/.ml-fx-drift` 工具类独立成文件；`style.css` / `maplelantern-native.css` 只保留组件选择器，加载顺序 `style.css → maplelantern-native.css → effects.css`。以后新面板可直接引用 token 或工具类，不再复制动画定义。
- **1.1.24 游戏缩放布局收口**：DoL 的「游戏缩放」实际是 `body.style.zoom`，`getBoundingClientRect()` 返回已缩放视觉坐标，而 `--ml-caption-top` 写在父容器本地像素。85% 下把 163.2 直接写入会被再缩成 138.5，顶部四格/状态卡上移 24.7px 压住立绘，右侧 `#storyCaptionDiv` 整列随之错位。现在按 `#img` 的「视觉高 / 布局高」求有效 zoom，把视觉差值换算回本地像素（163.2/0.85=192），并观察 `body[style]`：zoom 从 100 切到 85 或反向时立即重算一次，不再等下一次 passage。
- **1.1.23 联动按钮样式收口**：`#ml-root .ml-btn.ml-bridge-open` 提高特异性，避免后置 `.ml-btn` 的 `padding: 8px 14px` 覆盖联动按钮的 `0 12px`；44px 触控高度与紧凑行高保持不变。
- **1.1.22 第三方只读联动**：读 `V.Dynamicest.Settings` 与 `foreground_image1` / `background_image1` 等公开字段，在「此刻」页显示摘要（动态提醒 / 时段条 / 透明度；前景 / 背景 / 自动背景），点击「打开设置」跳到 Dynamicest「极致动态」页或前景背景入口。没有第三方时整块隐藏；不写第三方状态。
- **1.1.21 第三方层级与交互收口**：`#customOverlayContainer` 从 1200 降到 1000，Dynamicest 的 `#display-dynamicest`（1001）重新浮在弹层之上，弹层打开时不再吞掉动态提醒；新增契约断言锁住「容器 1000 / 内容 1201 / 提醒 1001」。联合冒烟增加 Dynamicest 复选框真实点击、前景背景 radio 真实点击与 `foreground_image1` 状态断言，并支持 `COMPAT_HOSTS=1` 的 6 包（含 StoneFreeHost + DoLGameUI）组合。
- **1.1.20 第三方设置页兼容**：Dynamicest 3.3 的「极致动态」页与前景背景 5.12 的「DecoMod」页都会复用 OPTIONS 的 `#customOverlay` / `#customOverlayContent`。原生层现在只在真正的 OPTIONS 主菜单注入「灯台」入口；识别到 `#decoImageSelector` / `#decoImagePreset` / `#decoAutoBgSettings` 或 Dynamicest logo / 「极致动态」标题时，不往第三方控件流里插按钮，并在 overlay 上标记 `data-ml-thirdparty`。新增单测与实机联合冒烟。
- **1.1.19 浮层复用二次收口**：1.1.18 已记录并还原 CE 打开前的完整 inline style；但 CE 若在记录前自己写了 `width:auto`，还原后这个值仍会留给主菜单。现在关闭时额外清掉 `width`、`max-width`、`box-sizing`、`overflow-x` 四个布局属性，让主菜单回到 CSS 的整宽布局；新增“CE 自带 width:auto”回归测试。
- **1.1.18 浮层复用收口**：CE 面板打开时原生层会写 `#customOverlay` / `#customOverlayContent` 的 `width`、`max-width`、`overflow-x` 内联 `!important`；CE 关闭后同一个 `#customOverlay` 被主菜单复用，旧内联值残留，窗口被压到屏幕左侧且按钮命中区异常。现在打开前先记录原始 inline style，CE 关闭、隐藏或切走时整体还原；手机端宽度改为明确的 `calc(100vw - 16px)`，不再依赖 `width:auto` 收缩。新增契约断言锁住还原路径。
- **1.1.17 电脑端 CE 状态页收口**：CE「状态」页沿用 `.settingsGrid`，桌面两列时格子内容会横向撑破邻格。现在格子按可容纳 520px 自适应，格子内卡片强制 `overflow:hidden`，`numberStepperContainer` 允许 `flex-wrap:wrap`，桌面箭头固定 28px、`margin/padding` 归零，中央数值区允许收缩并省略；新增契约断言与 1200px 两列几何验证（card gap 12px、零矩形重叠）。
- **1.1.16 原生弹层点击收口**：`#customOverlayContainer` 由 PassageFooter 渲染在 `#passages` 内，旧 `#passages button` 规则会把 44px 触控尺寸与 `9px 14px` 内边距套到原版/枯木逢春作弊面板；`numberStepper` 内容区被压到 2px，视觉箭头溢出到命中区外，密集行互相覆盖，点「固定触发」这类小按钮会落到邻格。现在正文按钮规则排除整个弹层子树，并对非 CE 的 `.settingsGrid` 恢复 32px 紧凑几何、`padding:0` 与 `transform:none`，弹层内部只走已排除 CE 的专用规则；新增契约断言锁住这条。
- **1.1.15 图标按钮收口**：正文「换姿势」等原版图标按钮靠 `background-image` 画图标，本包通用 `#passages button` 之前用 `background` 简写，会把 image/size/position/repeat 一并清成 `none`，按钮只剩一个带焦点环的空框。现改为只设 `background-color`，hover 同样不再用简写，图标与原有尺寸/定位完整保留；新增契约断言锁住这条，防止回归。
- **1.1.14 桌面收口**：CE「状态」页沿用 DoL 原版 `.settingsGrid` + `numberStepper`，桌面两列时每格只有半宽，六枚箭头在大字体/高缩放下横向撑破格子，右列左箭头侵入左列。现在格子按可容纳 460px 的宽度自适应（窄桌面自动降为单列），stepper 容器收回格子宽，箭头在桌面固定 30px（手机端仍保持 34px 触控区），并去掉按钮外距；新增契约断言与 900/960/1000/1100/1280/1600 六档几何验证。
- **1.1.13 自查收口**：① 传送页按原始 `<<icon>><<link>>` 结构把相邻「图标 + 链接」包成一行，避免直接撑满子项导致图标与地名各占一行；分组标题仍保留。② 选中页签识别扩到 `.CEtabActive/.CEtabSel/.CEtabOn/[aria-selected]/[data-selected]`，class 改名时传送页标记仍能生效。③ 新增图标+链接平铺、标题保留、选中态兜底三条断言；100/100 单测。
- **1.1.12 视觉收口**：① 手机端根背景恢复视口锚定（`background-attachment: fixed`），长 passage 滚到底与 CE 面板内部滚到底都不再出现渐变截止后的整段纯色断层；面板同步恢复。② CE 1.20.4 七页签容器被改成 grid 导致 5+2 折行，这里改回 flex 等分单行。③ 传送页的地点行内列表按实测结构收成纵向行，每项占满一行，长地名不再贴右缘或越界。
- **1.1.11 性能收口**：① 分组稳定后 `packStable` 直接跳过整轮 pack，含两次签名扫描与三轮全页遍历；用首个选项链接做锚点，`innerHTML` 直接替换时不会误判稳定。② CE 面板加 `ceDirty/ceReady/ceSig` 脏检查，正文 refresh 不再重复重排。③ 补扫压缩为「立即 + 140ms」固定拍，之后 600ms 起自适应、连续两拍无变化即停。④ `setAttr()` 同值不写：状态卡、左轨百分比、侧栏字号、标题锚点均先比对再写；200 选项页 20 次 apply 从 251ms 降到 64ms（jsdom 逻辑层）。
- **1.1.10 二次收口**：① 修掉页签被“内容按钮通扫”二次改写（11px→13px、宽度 65→81）的回归，页签与关闭按钮加标记跳过；分类栏收窄 36px 给 ✖ 留真实缺口，右缘加 26px 渐隐提示横向滚动。② 平铺六胶囊解除 CE 固定 `width:100px`，`flex:1 1 0` 等分单行。③ 状态条箭头补充识别 `<div>/<span>` 叶子节点，统一 34×34。④ 分组后双向清理组前后空 `<p>`/`<br>`（含图标的段落不删），3px 间距不再被空段落撑大。
- **1.1.9 Android 真机收口**：① 选项候补链接类名扩到 `a.link-internal`，并在 `passageend` 后补扫 1200/2400ms + 约 6s 的受控补扫 + `MutationObserver`；汉化或 TweeReplacer 晚一步重建链接时，`repairGroups()` / `adoptOrphanIcons()` 会把新链接接回原图标卡，图标不再单独浮在卡外；卡片间距 3px。② CE overlay 不再依赖 `:has()`：`watchOverlay()` 在面板异步挂载后重算，页签强制单行（旧版平铺等分、两层横向滚动且给关闭按钮留 36px），内容网格单列（用「纯箭头按钮」识别并跳过状态条），状态条箭头压到 34px，`#customOverlay` 手机端硬限 `calc(100vw - 16px)`，关闭按钮 28×28 不再被裁。③ 所有 `color-mix()` 前补 `rgba()` 兜底；旧 WebView 不支持混色时背景不会整条失效。④ 背景再加主题顶部光/底部回光/暗角与不透明底兜底，并降低弹层遮蔽（普通弹层 58% / 内容 62%，CE 60/64）。
- **1.1.8 背景增强**：整页新增「边缘暗角 + 主题顶部光 + 底部回光」三层；普通 `#customOverlay` / `#ui-dialog` 改为 **68% 半透明**，内容层 **78% / 82%** 并叠页纹理；CheatExtended 的 overlay **66%**、`.dol-shadow` **64%**，面板不再是一块实色，星空/纸纹/网格能从弹层与 CE 面板透上来。
- **点击/按压反馈**：按钮、页签、分段控件、图标、开关与快捷项按下时轻微缩放提亮，不下沉；面板内生成短涟漪，松手后自动移除。系统「减少动态效果」或设置关闭动效时不播放，操作仍完整。
- **不写存档、不改数值、不接管任何第三方业务。**
- **1.1.3 热修**：关掉「原生卡片」再开回来时，`OPTIONS` 弹层不再被游戏 `closeOverlay()` 收掉，「灯台」入口保留，页签 `T.tab` 不被清空。
- **1.1.4 主题迭代**：降低琥珀纸纹与石墨碳纤的细线密度，补青瓷开片斜纹、石墨拉丝与星空底部星云；六套主题面板补内缘高光/主题阴影；按压涟漪改为贴合控件的亮环，原生标题栏同步铺纹理。二次增强再补青瓷釉光、石墨金属光带、星空银河带、卡片内缘光与 20px→3.4 倍双层涟漪。
- **整页主题背景**：`html` 承担固定整页纹理，`body` / `#passages` / `.passage` 全部透明；六主题不再只是面板换色。
- **1.1.7 体验收口**：移除“检测到宿主即关闭原生层”的让位逻辑；`native.js` / `native.css` 改为唯一文件名 `maplelantern-native.js` / `maplelantern-native.css`，避免多包同装时通用脚本名被静默跳过；六主题重写高对比度页面纹理（琥珀纸纤维、赛博霓虹网格、青瓷釉面冰裂、石墨拉丝、星空约 70 星点+银河带+十字星芒）；正文选项按压加入缩放与主题辉光（1.4.22 起不再下沉）。

## 安装

1. 打开游戏，`Alt+M` 呼出 ModLoader。
2. 「添加旁加载 Mod」选择 `MapleLantern-1.5.4.mod.zip`；如果已装旧包（含 1.4.12 及更早），先停用旧包，再导入新包；同名技术身份只能启用一个版本。
3. 刷新页面。安装后无需重启游戏。

> 直接把 zip 复制进 `game\` 目录**不等于安装**：玩家侧 Mod 来自 `file://` origin 的 IndexedDB。

## 入口

| 入口 | 行为 |
|---|---|
| `OPTIONS` 弹层顶部「灯台」行 | **默认形态**下打开悬浮灯台面板；不改变游戏设置 |
| 右下悬浮球 | 仅在设置里打开「悬浮灯台」后显示；单击开合；拖动超过 6px 视为移动，不触发开合 |
| `Alt+L` | 开合灯台面板（输入框内不抢键） |
| `Esc` / 外部点击 / 抽屉下滑 >64px | 关闭 |

移动端（`≤560px` 或高度 `≤520px`）自动改为底部抽屉，打开时悬浮球让位，关闭后焦点交还游戏正文。

## 设置

| 项 | 范围 | 默认 |
|---|---|---|
| 原生卡片 | 开 / 关 | **开** |
| 悬浮灯台 | 开 / 关 | **关** |
| 主题 | 自动 / 赛博朋克 / 琥珀 / 青瓷 / 星空 / 雾港 / 旧校舍 / 纸灯 / 绿茵 | 赛博朋克 |
| 主题边饰 | 开 / 关 | **开** |
| 字号 | 80–140%，5% 步进 | 100% |
| 通透度 | 0–100，5% 步进 | 60 |
| 密度 | 舒适 / 紧凑 | 舒适 |
| 动效 | 开 / 关 | 开 |
| 语言 | 自动 / 中文 / English | 自动 |
| 悬浮球位置 | 左下 / 右下 | 右下 |

设置存 `localStorage["MapleLantern.settings.v1"]`；逐字段修复，坏一个字段不会整包丢弃。

通透度只改**表面遮蔽 / 模糊 / 边缘层次**三项，不改文字与按钮透明度；0 更沉稳、100 更通透。关掉玻璃模糊后再开，数值保留；「通透度回 60」只重置这一项。

## 原生 UI 替换层（1.1.17）

只挂标记与属性，不重建原版节点、不改原版事件，因此游戏推进/读档/换装时不会与 SugarCube 抢同一段内容。

| 原版位置 | 标记 | 呈现 |
|---|---|---|
| `#stats .centered-elements` 四块 | `data-ml-chip=toggle/money/time/day` | 四格：开合 / 金钱 / 时间 / 星期；金额整数补 `.00`，数字用等宽数字 |
| `#mobileStats` 左轨 | 无标记，CSS | 32px 宽度不变；28×36 胶囊，每格 2px 左侧状态色条，标签下方再加 24×5 数值条（深青轨道 + 当前值填充），字号 12.5 / 字重 700 / 文字描边提升暗底可读性；时间块 60px 高并带金棕强调 |
| `#statmeters` 七行 | `data-ml-stat-card` + `data-ml-stat-key` + `data-ml-value/current/percent/total/readout` | **一张状态大卡**：7 行「标签 + 长条 + 右侧 当前/上限」，上限读 `State.variables.*max`，缺失才回退常量；整卡随侧栏滚动 |
| `#passages a.link-internal.macro-link` | `data-ml-option="1"`；有前置 `img.icon` 时加 `data-ml-option-group="1"` | 整行卡片，序号与时耗保持原文本，不重写 passage；「图标 + 选项」收进同一张 `ml-option-group` 卡，图标 30px 在左、文字在右，并摘掉组前空行；无图标选项保持整行卡 |
| `#overlayButtons` / `#menu` 按钮 | 双 ID 反制 + `data-ml-label` | 两列卡片按钮，≥44px；`sidebarButtonSplit` 拆平为 `display:contents`，清掉原版占格 `<br>`，8 个入口四行对齐，`JOURNAL` / `OPTIONS` 不再退省略号 |
| `#customOverlay` / `#ui-dialog` | `data-ml-overlay` / `data-ml-dialog` | 圆角外壳、固定 48px 上下留白、单轴滚动、44×44 关闭按钮 |
| `#customOverlayTitle` / `#overlayTabs` | 无标记，纯选择器 | 标题栏按页签自动增高，6 个页签不裁切；`OPTIONS` 的 Date Format 三段等宽胶囊、分隔符不占宽 |
| `#customOverlayContent` 内层 | 无标记，纯选择器 | `settingsGrid` 分节卡片、`settingsToggleItem` 行、自绘 checkbox/radio、`select` 与段落/表格统一配色；`statistics` 下 11 个 `.foldout` 改折叠卡，展开体按「标签 : 值」拆成两栏行并带 160ms 逐行淡入；`gameFeats` 顶部科普包成 `data-ml-feats-intro` 说明卡 |
| `#ui-bar` 窄屏档 | 无标记，原生几何 | **1.3.0 不覆盖侧栏宽度**：`#ui-bar` 保持原生 280px，`#img left:64`、canvas 256 不回退；顶栏四格、金额单行、日期横排、状态卡 `#stats 100%` 保留，窄屏选项单列。 |
| 衣柜内层（`Wardrobe`） | `data-ml-option` + `tidySeparators` | warmth 50px 条压成 16px 圆角条，温度说明独立卡；`Close wardrobe` / `Strip all` 等动作两列，裸 `\|` 全清；`#listoutfits` 双列、四张 outfit 卡左对齐等宽 |
| 商店目录（`Clothing Shop`） | `markShopCats` | 15 组「图标 + 文字」收进两列胶囊卡，去掉原版 `<br><br>` 撑出的断行；warmth / 说明卡与衣柜同材质 |
| 商店列表（`View All` 等） | `markShopCats` + `markEmptyDetails` + `tidyShopText` + `markShopTools` | `Back to shop` 取消原版绝对定位与气泡描边，回到正常流；分类图标去斜切、44×44 方卡；商品行成网格卡：48×48 图标 + 名称 + 右上价签胶囊 + 三行 stats-ball；空 `.clothing-details` 隐去；中文环境把原版硬编码 `Filters` / `Opt.` / `Legend` 换成「筛选 / 选项 / 图例」，已本地化的原文保持不动 |
| `SAVES` 弹层 | `markSaveRows` | 去掉 `&nbsp;` 后判定空槽：隐藏名称/详情，槽位号与保存/读取/删除同排，行高 46px；非空行保留两行详情。底部 `saveMenuButton` 与行内保存/读取按钮跨主题统一，`全部删除` 保留红色危险语义 |

- 让位：`window.DoLGameUI.ui.apiVersion === 1 && getCapabilities().enabled` 时不挂 `data-ml-native`，并清掉全部标记/入口，恢复原版。
- 零轮询：无 `setInterval`；侧栏开合用 `#ui-bar` 的 `MutationObserver` 当帧同步，外观设置页用 `#ml-pane-host` 观察器 + 点击节流重绘，均按需断开。只在 `:passageend`、`#overlayButtons` / `#menu` / `#customOverlay` / `#passages` 的点击捕获和设置切换时重扫，单飞 rAF，点击后 0 / 150ms 各补扫一次（等游戏异步换 DOM）。
- 动效：仅 `transition` / 入场 `opacity`，不再保留 `translateY`；尊重 `prefers-reduced-motion`、宿主 `data-dol-midnight:not([data-dgu-visualMotion])` 与本包 `data-ml-motion="off"`。

## 性能

- `:passageend` 只做一次 `requestAnimationFrame` 合帧：同一帧内连续事件合并，面板只重绘一次。
- 面板关闭时不再预渲染内容，首次打开才构建当前页签；启动只更新悬浮球时钟。
- 只重绘当前页签；设置里的滑块拖动只推 CSS 变量，不整页重建。
- 主题 / 密度 / 动效切换只改 CSS 属性，不重建设置页；剧情推进时也不重建该页，保留焦点与滚动位置。
- 宿主 `visualTier` 为 `Smooth` / `Balanced` 时自动把模糊收窄到 10px / 16px；`backdropFilter` 为 false 时直接关闭模糊。
- 面板 `contain: layout style`、内容区 `contain: layout paint style`，把重排/重绘限制在面板内。
- 移动端高度优先 `dvh`（`vh` 兜底），避免地址栏伸缩时抽屉跳动。
- 实机实测：剧情切换后面板单次刷新 **0.2–0.4 ms**（纯净档与宿主档同口径，断言上限 16 ms）。

> 脚本文件名不要用 `index.js`：它与 DoLGameUI / StoneFreeHost 的 `index.js` 撞名时，本包渲染层会被整段跳过（`core.js` 能跑、`window.MapleLantern` 不存在、无报错）。本包固定为 `core.js` + `render.js`。

- 只读 `window.SugarCube.State.variables`（或 `window.State.variables`）、`window.Time`、`window.Constants`、`Window.StartConfig.version`。
- 不展示 `butt_plug` / `genitals` 两个私密槽位。
- 不提供传送、推进时间、交易、穿戴、战斗操作。
- 单测用 `Proxy` 的 `set` 陷阱证明：开面板、切页签、改设置、取诊断，全程零写入。

## 兼容与降级

- **未装 DoLGameUI**：用自带八主题（赛博朋克 / 琥珀 / 青瓷 / 星空 / 雾港 / 旧校舍 / 纸灯 / 绿茵），功能完整；`html[data-dgu-*]` 反制规则零匹配。
- **装了 DoLGameUI**：只转发 `--dgu-accent` / `--dgu-radius` / `--dgu-card-radius`，并逐类封回被全局按钮规则改写的 padding / min-height。
- **读不到存档字段**：面板仍可打开，显示「读取降级」，不抛错。
- **存储不可用**：设置只在本次会话生效，并提示一次。

## 无障碍

- 面板 `role="dialog" aria-modal="true"`，页签 `role="tablist"` + 左右键 / Home / End，焦点陷阱，`Esc` 关闭。
- 全部主操作区 ≥44px；字号走 `calc(px × --dgu-font-scale × --ml-scale)`。
- 三条零 JS 动效关断：`prefers-reduced-motion`、`html[data-dol-midnight]:not([data-dgu-visualMotion])`、自有 `data-motion="off"`。

## 验证

本轮（2026-11-22，Windows）实测；205–209 为历史专项读数：

- `node --test tests\*.test.js`：**258 / 258 PASS**（10 个测试文件；1.5.1 绿茵/边饰/文字色；1.5.2 商店按钮链接；1.5.3 原生长列表性能与关闭态清标回归；1.5.4 DolSmartPhone 手机弹窗关闭键）
- 实机安装探针（真实导入页 → `file://` IndexedDB → 游戏，Edge headless 全新 profile）：**PASS**——包版本三源 1.5.4（core/native/panel 一致）；原生层默认挂载、根节点已就位；零 pageerror
- `node tools\bench-native.js`：静态 6 选项页单次换页 **apply 5 次 / 补扫 2 拍 / pack 1 次 / 必要写入 6 次（跳过 345 次同值写）**；CE 面板打开后正文 refresh 20 次 **ceNorm +0**；200 选项页连续 20 次 apply **39ms、pack 0 次、写入 0 次（跳过 1380 次同值写）**
- 移动端（≤899px）`html` 与弹层背景改为 `background-attachment: scroll`，避免固定背景在弹层内滚动时每帧重绘；桌面仍 `fixed`
- 真实 `Lake Shore`（390×844，Edge 隔离 profile，宿主 DoLGameUI 4.2.0 启用，1.1.8 包）：**4 个选项全部为 `.ml-option-group`**，卡片高 44px、组间距 4px、`strayIcons=[]`；`img.icon` 与 `.icon-container` 图标均在卡内 28×28；`html` 背景 `rgb(5,8,19)` + 82 层星场、`backgroundAttachment=fixed`，`body` 与 `#passages` 均透明
- CE 1.20.3.1 合成 DOM（390 宽）：`#customOverlayContent` padding 0、CE 页签 47×30 / padding 4px 8px / min-height auto、`.settingsGrid` 334px 单列、72% 半透明主题底 + 星空纹理；桌面 1280 不命中单列、保持 CE 两列
- 普通 OPTIONS 弹层（390 宽）：`#customOverlay` / `#customOverlayContent` 68% / 78% 半透明主题底 + 页纹理，8 个原生入口几何不变
- 真实正文按压：`pointerdown` 后 `pressed:true` / `ring:true`，`mln-press-ring` 出现在卡片内
- 8 个侧栏入口逐页走查：**CHARACTERISTICS / SOCIAL / TRAITS / JOURNAL / STATS / FEATS / OPTIONS / SAVES**，8/8 `clicked:true`、`overlayHidden:false`、`errors:[]`；OPTIONS 页灯台入口保留
- `check_ui_mod.py`：**14 PASS / 1 WARN / 0 FAIL**（WARN 为「未声明 StoneFreeHost」，属可选接入）
- 动效实机（540×1170，Edge 隔离 profile，三套主题）：`#ml-panel::after` `ml-panel-ambient` 26/31/22s、`::before` `ml-hairline`、`.ml-pane` `ml-pane-in`、`.ml-ring::after` `ml-ring-breathe` 5.6s；`#ui-bar` `mln-bar-drift` 28/32/24s，`background-size` 5 层（2 环境光 + 3 纹理）；hover `matrix(1,0,0,1,0,-1)`；关断后 panel/ring/bar/pane 全 `none`；0 pageerror。
- 窄屏回归（390×844、320×568，paper）：面板宽 390/320，6 个页签等分且全部可见；320 主题网格 3×91×44，文档无横向溢出；`ml-pane-in` / `ml-panel-ambient` / `mln-bar-drift` 仍运行，0 pageerror。面板 `scrollWidth` 的额外值来自 `::after ambient` 负 inset，不是内容溢出。

- Edge 隔离 profile 纯净档：`#ml-root` 注入、面板 380×504、z 89900、0 未捕获异常，**18 项 PASS**
- 宿主档（DoLGameUI 4.2.0 启用）：**23 项 PASS**，含「宿主下原生层仍按玩家开关挂载」、宿主 token 已读、面板仍 380×504
- 原生按钮关→开回归：`NATIVE_OFF` / `NATIVE_ON` 均 `overlayHidden:false`、`entryCount:1`、`ttab:true`，随后点 Theme 页签无 `<<toggleTab>>` 报错
- 1.1.4 阶段留存的六主题原型截图：6/6 面板 380×620；按压涟漪实测 `ring:true`、空心主题色亮环不遮字
- 设置页实测：切主题不重建、剧情推进不冲掉焦点；`backdrop-filter: blur(20px) saturate(1.1)` 在纯净档与宿主档一致
- 剧情切换实战：`Start → Start2`，面板场景同步 `Start2`
- 包内 7 个条目，确定性命中（固定 mtime、正斜杠）；体积与 SHA256 见 `dist\SHA256-1.1.16-theme.txt`

```powershell
node --test tests\*.test.js
pwsh -NoProfile -File .\pack.ps1
python <dol-ui-design>\scripts\check_ui_mod.py dist\MapleLantern-1.1.17-theme.mod.zip
node tools\game-smoke.js
$env:HOST='1'; node tools\game-smoke.js
```

## 已知限制

- 未在 Android / iOS 真机验证；移动端结论来自 390 / 320 / 844×390 视口模拟与 Edge 桌面渲染。
- 页签条在 `320px + 140% 字号` 下需要横向滚动（内容区不溢出；选中页签会自动滚入视野）。
- 宿主视觉证据来自 Windows + Edge 隔离 profile（Dynamicest + StoneFreeHost + DoLGameUI 四包同装），未覆盖 macOS / Android。
- 身心页仍只展示 5 项（意志 / 压力 / 创伤 / 兴奋 / 疲惫），不纳入 `pain` / `hygiene` / `oxygen`。


