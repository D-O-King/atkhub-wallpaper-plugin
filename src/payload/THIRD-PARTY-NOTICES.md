# 第三方组件

1.0.0-private 的应用代码由本项目独立实现，未将旧版插件主程序、界面、内置图片或导入工具打入发布包。历史归档不属于本版本，保留各自原始许可证。本文件不改变历史代码的许可。

当前分发中的独立应用代码采用 PolyForm Noncommercial 1.0.0，见根目录或安装内容中的 `LICENSE`。此非商业限制仅适用于本项目独立应用代码，不改变下列第三方组件的授权，也不撤销此前已经授予的 MIT 权利。

## WebWallGL 3.0.1

- 作者：oneincase <462534624@qq.com>。
- 许可：MIT，全文见 `vendor/webwallgl/LICENSE`（源码目录对应 `src/payload/vendor/webwallgl/LICENSE`）。
- 项目：https://github.com/oneincase/webwallgl
- 本版本直接采用 npm 官方发布的 UMD 文件，未采用旧插件携带的修改文件。
- 发布包：https://registry.npmjs.org/webwallgl/-/webwallgl-3.0.1.tgz
- 发布提交：`ff2d8b7a9c7b79cda61bf00df0264c9f547823ea`。
- UMD SHA256：`ee2fbe9a4d15a9ecca837c08a76b90d8c3d98dd2619976929890c9f51de2ff9c`。

## Mediabunny 1.56.0

WebWallGL 的 UMD 包含该媒体库。对应发布提交的 `pnpm-lock.yaml` 固定为 1.56.0。

- 作者：Vanilagy / Dorian Himmler 及贡献者。
- 许可：Mozilla Public License 2.0，全文见 `vendor/mediabunny/LICENSE`。
- 项目：https://github.com/Vanilagy/mediabunny
- 完整源代码包随安装内容附带于 `vendor/mediabunny/source-1.56.0.tgz`；源码目录对应 `src/payload/vendor/mediabunny/`。
- 同一源代码包下载：https://registry.npmjs.org/mediabunny/-/mediabunny-1.56.0.tgz
- 未修改该组件。该组件的 MPL 义务仍适用，并不要求将独立应用代码按相同许可证公开。

第三方组件继续按各自 MIT 或 MPL 许可证提供。分发时应保留其版权、许可声明和 Mediabunny 对应源码；根目录的非商业许可证不重新许可这些组件，也不限制第三方原许可证授予的权利。

ATK HUB、Electron、用户的壁纸文件均不随发布包分发，各自权利不受本项目声明影响。
