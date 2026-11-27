# ATK HUB Wallpaper

为 **ATK HUB 软件界面**加载本地图片、视频、网页和兼容的场景壁纸。仅改变 HUB 软件背景。

本项目为兴趣与娱乐用途开发，**源码公开、限非商业使用**。自有应用代码采用 **PolyForm Noncommercial 1.0.0**，商业用途需要另行取得授权。第三方组件按各自许可证提供。

当前版本：**1.0.0**。适用于 Windows x64，默认安装目录为 `C:\Program Files\ATK HUB`。已在本机 ATK HUB **3.2.33** 上验证接入和网页鼠标命中；其他版本需先用安装器检测，页面结构变化可能需要适配。本项目并非 ATK 官方插件。

## 功能

- 图片和视频使用浏览器原生播放；视频默认静音。
- 网页壁纸直接加载原始 HTML、脚本和图片，支持背景空白区域的悬停与点击。设备卡片、按钮和输入控件优先响应 HUB。
- 支持沙箱内本地图片作为 WebGL 纹理，修复网页项目“Deepseek 图鲸鲸 · 大肥鱼数字生命控制台”因跨域纹理错误导致的互动中断。该网页的摸头、捏脸需要按住对应区域拖动，喂饭使用壁纸自己的按钮。
- 兼容场景使用内置的 WebWallGL 3.0.1 离线渲染，提供省电、均衡、高画质三个档位，目标分别为 15、30、60 FPS。
- 场景画布支持原生鼠标输入，使“DeepSeek 鲸鱼娘 点击互动”等场景项目能触发自带的点击动画。HUB 控件仍优先响应，设备卡片覆盖的位置不会向壁纸传递点击。
- 半透明毛玻璃设置面板，提供搜索、来源筛选、收藏、自动轮换、画面调整、位置预览和可选全局快捷键。默认不注册快捷键。
- 常见壁纸属性及选项显示为中文，未知的作者自定义名称保留原文；不改变壁纸参数键名、类型和数值。
- 支持隐藏窗口时暂停的选项；HUB 未设置官方壁纸时也可显示插件背景。

## 安装与使用

使用已构建的 `ATK-HUB-Wallpaper-Plugin.exe` 安装器；如果获取的是源码，请先按下文构建，生成的安装器位于 `dist/`。源码仓库不包含 `dist/` 中的成品。

1. 运行安装器，确认 ATK HUB 安装目录，选择“检测”，再选择“安装 / 更新”。写入 Program Files 时会请求管理员权限。
2. 若目标 HUB 正在运行，安装器会询问是否强制关闭并继续。关闭可能中断正在进行的设备操作，建议先自行退出 HUB；拒绝强制关闭会取消本次安装。
3. 安装成功后会弹出提示，确认后关闭安装器。重新启动 HUB，点击右上角的**叠层图片图标**，悬停提示为“壁纸设置”。
4. 选择自动发现的 Steam 壁纸，或点“添加壁纸库”选择图片、视频所在目录，或包含 `project.json` 的完整壁纸项目目录。WeGame 和其他目录可手动添加。
5. 新增或下载壁纸后，在“选择壁纸”的筛选栏点击“刷新”。

不需要安装或运行 Wallpaper Engine，但需要已有完整本地壁纸素材。运行安装器及已安装的插件不需要 Node.js、Python 或 npm。动态、交互壁纸需要完整项目，只有预览图无法还原原始效果。插件不负责下载或更新 Steam 创意工坊资源。

## 更新与卸载

更新插件时，运行新版安装器，选择“安装 / 更新”，完成后重启 HUB。从 0.1.x 升级到 1.x 时，壁纸 ID 已改变，需要重新选择壁纸并设置收藏及项目属性；手动目录和画面设置会保留。

卸载时再次运行安装器，选择“卸载还原”。安装器核对 SHA256 后恢复原始归档；如果官方更新已替换归档，则保留新版官方文件并清理插件。归档存在未知修改或备份校验失败时，会拒绝覆盖。

用户配置位于 `%APPDATA%\ATK-HUB\atk-wallpaper\state.json`，原始归档备份位于 `<ATK目录>\resources\atk-wallpaper-backups`，卸载会保留这两者。安装器会对可捕获的安装错误执行回滚；断电或进程被强制终止时，不能保证自动恢复。

官方更新后，如果插件入口被替换，需要重新运行安装器安装。

## 兼容性与限制

- 本项目不具备 Wallpaper Engine 原生引擎的全部能力。专有系统接口、部分场景效果及依赖外部网络资源的网页可能无法正常工作；有可用预览图时，加载失败会回退预览。
- 网页运行在独立沙箱中，禁止访问 Node 和父页面 DOM；资源策略主要允许本地壁纸协议及部分 `data:`、`blob:` 资源，依赖外部站点的效果需要额外适配。
- 网页沿用项目自身的视口布局。图片和视频支持填充方式与位置调整；场景的画面适配取决于渲染器，网页和场景不保证支持全部图片裁剪设置。
- 高画质的 60 FPS 是目标值，不是性能保证。场景 DPR 上限为 1.25，渲染像素预算约为 2560×1440，以限制高分辨率窗口的开销。
- 1.0.8 修复了本机 HUB 标题栏透明拖动层覆盖整个窗口的问题。网页交互区域位于 HUB 控件之外，设备卡片和滚动区域仍由 HUB 响应。

## 从源码构建

需要 **Windows x64、Node.js 18 或更高版本、PowerShell，以及 .NET Framework 4.x 的 C# 编译器**。构建脚本使用 `%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe`，并调用 Node.js 校验第三方组件和构建边界；无需运行 `npm install`。

在项目根目录执行：

```powershell
node tools/check.cjs
powershell -NoProfile -ExecutionPolicy Bypass -File build/build.ps1
```

输出包括：

- `dist/ATK-HUB-Wallpaper-Plugin.exe`：安装器。
- `dist/ATK-HUB-Wallpaper-Plugin-1.0.0.zip`：安装器、README 和许可说明。
- `dist/SHA256SUMS.txt`：本次构建产物的校验值。

默认生成安装器和说明。需要同时生成可分发的源码 ZIP 时运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File build/build.ps1 -IncludeSource
```

第三方 Mediabunny 对应源码包始终随组件提供，不受此开关影响。构建不依赖被忽略的 `.reference/` 和 `.work/`，不要将这些本机目录加入源码提交。包含第三方壁纸素材的本机验证截图 `docs/images/properties-chinese.png` 不进入源码 ZIP 或 Git 提交。

## 验证

先完成构建，再运行自动化测试：

```powershell
node --test test/*.test.cjs
```

可选的界面测试需要另外提供一个标准 Electron 运行时，项目不会自动下载：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File test/run-electron.ps1 -ElectronExecutable "C:\path\to\electron.exe"
```

可额外传入 `-WebWallpaperDirectory "D:\path\to\Hyakkano-project"`、`-SceneWallpaperDirectory "D:\path\to\scene-project"` 或 `-InteractiveWallpaperDirectory "D:\path\to\DeepSeek-project"`，只读加载本机已有的完整壁纸项目。Hyakkano 和 DeepSeek 参数分别检查对应项目的悬停及角色互动。测试会短暂显示窗口，随后自动退出；运行时和临时数据位于 `.work/private-electron-harness/`。

默认自动化测试使用临时安装夹具和模拟 HUB 页面，不修改实际 ATK 安装，也不等同于所有设备、页面和版本的完整验收。真实 HUB 临时诊断的范围、还原结果及各版本验证记录见 [验证记录](docs/VALIDATION.md)。

## 许可与来源

当前分发中的独立应用代码采用 [PolyForm Noncommercial 1.0.0](LICENSE)，包元数据标识为 `PolyForm-Noncommercial-1.0.0`。允许个人娱乐、学习、实验和其他符合许可证的非商业用途，以及按条款修改和再分发。商业用途不在本许可证授权范围内，需要另行取得权利人的许可；具体允许用途及非商业机构条款以 LICENSE 原文为准。

再分发时须保留许可证及 `Required Notice:` 版权通知。软件按原样提供，不作担保。因为含非商业限制，本项目属于源码公开项目，不是 OSI 定义的开源软件。

此前已合法取得的 MIT 授权副本及其衍生作品仍可按相应 MIT 授权使用；本次变更不撤销既有授权。版本号保持 1.0.0，请以所获副本随附的许可证为准。

第三方组件仍按各自许可证提供，见 [第三方组件说明](THIRD-PARTY-NOTICES.md)。本项目应用代码的重写范围及历史版本处理见 [代码来源记录](docs/PROVENANCE.md)；新版本声明不追溯改变旧版本的许可。ATK HUB、Electron 运行时和用户壁纸素材不包含在发布包中。

公开仓库与版本发布的操作说明见 [GitHub 发布准备](docs/PUBLISHING.md)。
