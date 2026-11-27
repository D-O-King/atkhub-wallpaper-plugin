using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace AtkWallpaper {
  internal static class Archive {
    internal const string Marker = "ATK-WALLPAPER-BOOTSTRAP-v1";
    internal const string Entry = "dist-electron/main/index.js";
    internal static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = int.MaxValue, RecursionLimit = 256 };
    internal static string Hash(byte[] bytes) {
      using (var sha = SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-", "").ToLowerInvariant();
    }
    internal static string FileHash(string file) {
      using (var sha = SHA256.Create()) using (var stream = File.OpenRead(file))
        return BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
    }
    internal static Dictionary<string, object> Object(object value) { return (Dictionary<string, object>)value; }
    internal static Dictionary<string, object> Header(byte[] bytes, out int start) {
      if (bytes.Length < 16 || BitConverter.ToUInt32(bytes, 0) != 4) throw new Exception("不是有效的 ASAR 归档。");
      int length = checked((int)BitConverter.ToUInt32(bytes, 12));
      start = checked(8 + (int)BitConverter.ToUInt32(bytes, 4));
      if (length <= 0 || start > bytes.Length || 16L + length > start) throw new Exception("ASAR 头部损坏。");
      return Json.Deserialize<Dictionary<string, object>>(Encoding.UTF8.GetString(bytes, 16, length));
    }
    internal static Dictionary<string, object> Node(Dictionary<string, object> header, string file) {
      var node = header;
      foreach (var segment in file.Split('/')) node = Object(Object(node["files"])[segment]);
      return node;
    }
    internal static byte[] Read(byte[] bytes, int start, Dictionary<string, object> node) {
      if (node.ContainsKey("unpacked") || node.ContainsKey("link")) throw new Exception("入口必须位于 ASAR 内部。");
      int offset = checked(start + int.Parse((string)node["offset"]));
      int size = Convert.ToInt32(node["size"]);
      if (size < 0 || offset < start || (long)offset + size > bytes.Length) throw new Exception("ASAR 文件范围损坏。");
      var result = new byte[size]; Buffer.BlockCopy(bytes, offset, result, 0, size); return result;
    }
    internal static bool HasMarker(string file) {
      var bytes = File.ReadAllBytes(file); int start;
      var header = Header(bytes, out start);
      return Encoding.UTF8.GetString(Read(bytes, start, Node(header, Entry))).Contains(Marker);
    }
    internal static string Validate(string file) {
      var bytes = File.ReadAllBytes(file); int start;
      var header = Header(bytes, out start);
      var package = Json.Deserialize<Dictionary<string, object>>(Encoding.UTF8.GetString(Read(bytes, start, Node(header, "package.json"))));
      if (!package.ContainsKey("name") || !string.Equals(Convert.ToString(package["name"]), "ATK-HUB", StringComparison.OrdinalIgnoreCase) ||
          !package.ContainsKey("main") || Convert.ToString(package["main"]).Replace('\\', '/') != Entry)
        throw new Exception("仅支持 ATK HUB Electron（ATK-HUB，入口 dist-electron/main/index.js）。");
      Read(bytes, start, Node(header, Entry));
      return package.ContainsKey("version") ? Convert.ToString(package["version"]) : "unknown";
    }
    static void Shift(Dictionary<string, object> node, long offset, long oldSize, long delta) {
      if (node.ContainsKey("files")) {
        foreach (var child in Object(node["files"]).Values) Shift(Object(child), offset, oldSize, delta);
      } else if (node.ContainsKey("offset") && !node.ContainsKey("unpacked")) {
        long current = long.Parse((string)node["offset"]);
        if (current > offset && current < offset + oldSize) throw new Exception("ASAR 文件范围重叠。");
        if (current >= offset + oldSize) node["offset"] = (current + delta).ToString(System.Globalization.CultureInfo.InvariantCulture);
      }
    }
    internal static void Patch(string source, string destination) {
      Validate(source);
      var bytes = File.ReadAllBytes(source); int start;
      var header = Header(bytes, out start); var entry = Node(header, Entry);
      var original = Read(bytes, start, entry);
      if (Encoding.UTF8.GetString(original).Contains(Marker)) throw new Exception("归档已包含本插件入口；请使用已校验的备份。");
      string prefix = "\"use strict\";/* " + Marker + " */try{require(require('path').join(process.resourcesPath,'atk-wallpaper','index.js'));}catch(e){console.error('[atk-wallpaper]',e);}\n";
      var prefixBytes = Encoding.UTF8.GetBytes(prefix);
      var patched = new byte[prefixBytes.Length + original.Length];
      Buffer.BlockCopy(prefixBytes, 0, patched, 0, prefixBytes.Length);
      Buffer.BlockCopy(original, 0, patched, prefixBytes.Length, original.Length);
      long offset = long.Parse((string)entry["offset"]);
      Shift(header, offset, original.Length, prefixBytes.Length);
      entry["size"] = patched.Length;
      int blockSize = 4 * 1024 * 1024;
      if (entry.ContainsKey("integrity")) {
        var previous = Object(entry["integrity"]);
        if (previous.ContainsKey("algorithm") && Convert.ToString(previous["algorithm"]) != "SHA256") throw new Exception("不支持此 ASAR 完整性算法。");
        if (previous.ContainsKey("blockSize")) blockSize = Convert.ToInt32(previous["blockSize"]);
      }
      if (blockSize <= 0 || blockSize > 64 * 1024 * 1024) throw new Exception("无效的 ASAR 分块大小。");
      var blocks = new List<string>();
      for (int i = 0; i < patched.Length; i += blockSize) {
        var block = new byte[Math.Min(blockSize, patched.Length - i)]; Buffer.BlockCopy(patched, i, block, 0, block.Length); blocks.Add(Hash(block));
      }
      entry["integrity"] = new Dictionary<string, object> { { "algorithm", "SHA256" }, { "hash", Hash(patched) }, { "blockSize", blockSize }, { "blocks", blocks } };
      var json = Encoding.UTF8.GetBytes(Json.Serialize(header)); int padded = checked((json.Length + 3) / 4 * 4);
      using (var output = new FileStream(destination, FileMode.CreateNew, FileAccess.Write)) using (var writer = new BinaryWriter(output)) {
        writer.Write(4); writer.Write(8 + padded); writer.Write(4 + padded); writer.Write(json.Length); writer.Write(json);
        writer.Write(new byte[padded - json.Length]);
        writer.Write(bytes, start, checked((int)offset)); writer.Write(patched);
        int tail = checked(start + (int)offset + original.Length); writer.Write(bytes, tail, bytes.Length - tail);
        output.Flush(true);
      }
      if (!HasMarker(destination)) throw new Exception("写入后的归档校验失败。");
    }
  }

  internal static class Installer {
    const string Owner = "atk-hub-wallpaper-plugin/v1";
    internal static string Resources(string dir) { return Path.Combine(Path.GetFullPath(dir), "resources"); }
    static string Manifest(string dir) { return Path.Combine(Resources(dir), "atk-wallpaper-install.json"); }
    static string Plugin(string dir) { return Path.Combine(Resources(dir), "atk-wallpaper"); }
    static Dictionary<string, object> ReadManifest(string dir) {
      string file = Manifest(dir); if (!File.Exists(file)) return null;
      var data = Archive.Json.Deserialize<Dictionary<string, object>>(File.ReadAllText(file));
      if (Convert.ToString(data["Owner"]) != Owner) throw new Exception("安装清单不属于本插件。");
      return data;
    }
    static string BackupPath(string dir, Dictionary<string, object> data) {
      string root = Path.Combine(Resources(dir), "atk-wallpaper-backups") + Path.DirectorySeparatorChar;
      string backup = Path.GetFullPath(Path.Combine(Resources(dir), Convert.ToString(data["Backup"])));
      if (!backup.StartsWith(root, StringComparison.OrdinalIgnoreCase)) throw new Exception("备份路径不合法。");
      return backup;
    }
    internal static string Check(string dir) {
      dir = Path.GetFullPath(dir);
      if (!File.Exists(Path.Combine(dir, "ATK HUB.exe"))) throw new Exception("目录内未找到 ATK HUB.exe。");
      string archive = Path.Combine(Resources(dir), "app.asar");
      string version = Archive.Validate(archive);
      var state = ReadManifest(dir);
      return Archive.Json.Serialize(new { Directory = dir, Version = version, Sha256 = Archive.FileHash(archive), Installed = state != null, Bootstrap = Archive.HasMarker(archive) });
    }
    [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] static extern bool QueryFullProcessImageName(IntPtr process, int flags, StringBuilder path, ref int length);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool TerminateProcess(IntPtr process, uint exitCode);
    [DllImport("kernel32.dll", SetLastError = true)] static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
    static string ImagePath(IntPtr handle) {
      var name = new StringBuilder(32768); int length = name.Capacity;
      if (!QueryFullProcessImageName(handle, 0, name, ref length)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), "无法读取 ATK HUB 进程路径，请以管理员身份重试。");
      return name.ToString();
    }
    static List<int> RunningHubIds(string dir) {
      var ids = new List<int>();
      string target = Path.Combine(Path.GetFullPath(dir), "ATK HUB.exe");
      foreach (var process in Process.GetProcessesByName("ATK HUB")) {
        using (process) {
          IntPtr handle = OpenProcess(0x1000, false, process.Id);
          if (handle == IntPtr.Zero) { if (Marshal.GetLastWin32Error() == 87 || process.HasExited) continue; throw new InvalidOperationException("无法确认 ATK HUB 是否已退出，请以管理员身份重试。"); }
          try {
            if (string.Equals(ImagePath(handle), target, StringComparison.OrdinalIgnoreCase)) ids.Add(process.Id);
          } finally { CloseHandle(handle); }
        }
      }
      return ids;
    }
    static void RequireClosed(string dir, Func<bool> confirmClose = null) {
      if (RunningHubIds(dir).Count == 0) return;
      if (confirmClose == null) throw new InvalidOperationException("请先完全退出 ATK HUB（包括托盘），再安装或卸载。");
      if (!confirmClose()) throw new OperationCanceledException("已取消操作。");
      string target = Path.Combine(Path.GetFullPath(dir), "ATK HUB.exe");
      var deadline = DateTime.UtcNow.AddSeconds(5);
      // Re-enumerate after consent, then verify and terminate through the SAME
      // process handle so PID reuse cannot target an unrelated application.
      foreach (int pid in RunningHubIds(dir)) {
        IntPtr handle = OpenProcess(0x1000 | 0x100000 | 0x0001, false, pid);
        if (handle == IntPtr.Zero) {
          int error = Marshal.GetLastWin32Error();
          if (error == 87) continue;
          throw new System.ComponentModel.Win32Exception(error, "无法强制关闭 ATK HUB，请以管理员身份重试。");
        }
        try {
          if (WaitForSingleObject(handle, 0) == 0) continue;
          if (!string.Equals(ImagePath(handle), target, StringComparison.OrdinalIgnoreCase)) continue;
          if (!TerminateProcess(handle, 1) && WaitForSingleObject(handle, 0) != 0)
            throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), "强制关闭 ATK HUB 失败。");
          uint remaining = (uint)Math.Max(0, (deadline - DateTime.UtcNow).TotalMilliseconds);
          if (WaitForSingleObject(handle, remaining) != 0) throw new Exception("等待 ATK HUB 退出超时，请手动关闭后重试。");
        } finally { CloseHandle(handle); }
      }
      if (RunningHubIds(dir).Count != 0) throw new Exception("ATK HUB 仍在运行或已重新启动，请关闭后重试。");
    }
    static void Extract(string destination) {
      Directory.CreateDirectory(destination);
      File.WriteAllText(Path.Combine(destination, ".owner"), Owner);
      using (var resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip")) {
        if (resource == null) throw new Exception("安装器缺少 payload.zip。");
        using (var zip = new ZipArchive(resource, ZipArchiveMode.Read)) {
          string root = Path.GetFullPath(destination) + Path.DirectorySeparatorChar;
          foreach (var entry in zip.Entries) {
            string file = Path.GetFullPath(Path.Combine(root, entry.FullName.Replace('/', Path.DirectorySeparatorChar)));
            if (!file.StartsWith(root, StringComparison.OrdinalIgnoreCase)) throw new Exception("安装包中含有越界路径。");
            if (string.IsNullOrEmpty(entry.Name)) { Directory.CreateDirectory(file); continue; }
            Directory.CreateDirectory(Path.GetDirectoryName(file));
            using (var input = entry.Open()) using (var output = new FileStream(file, FileMode.CreateNew)) input.CopyTo(output);
          }
        }
      }
      if (!File.Exists(Path.Combine(destination, "index.js")) || !File.Exists(Path.Combine(destination, "renderer", "shell.js"))) throw new Exception("插件资源不完整。");
      File.WriteAllText(Path.Combine(destination, ".owner"), Owner);
    }
    static void RequireOwned(string folder) {
      if (!Directory.Exists(folder)) return;
      string marker = Path.Combine(folder, ".owner");
      if (!File.Exists(marker) || File.ReadAllText(marker) != Owner) throw new Exception("插件目录中有未知文件，拒绝覆盖：" + folder);
      if ((File.GetAttributes(folder) & FileAttributes.ReparsePoint) != 0) throw new Exception("插件目录不能是链接。");
      RequireNoLinks(folder);
    }
    static void RequireNoLinks(string folder) {
      foreach (var path in Directory.EnumerateFileSystemEntries(folder)) {
        var attrs = File.GetAttributes(path);
        if ((attrs & FileAttributes.ReparsePoint) != 0) throw new Exception("插件目录包含链接，拒绝递归操作。");
        if ((attrs & FileAttributes.Directory) != 0) RequireNoLinks(path);
      }
    }
    static void Exclusive(string dir, Action action) {
      string key = Archive.Hash(Encoding.UTF8.GetBytes(Path.GetFullPath(dir).ToUpperInvariant()));
      using (var mutex = new Mutex(false, "Local\\ATK-Wallpaper-" + key)) {
        bool acquired;
        try { acquired = mutex.WaitOne(0); } catch (AbandonedMutexException) { acquired = true; }
        if (!acquired) throw new Exception("此目录正在执行另一项安装或卸载操作。");
        try { action(); } finally { mutex.ReleaseMutex(); }
      }
    }
    internal static void Install(string dir, Func<bool> confirmClose = null) { Exclusive(dir, delegate { InstallCore(dir, confirmClose); }); }
    internal static void Uninstall(string dir, Func<bool> confirmClose = null) { Exclusive(dir, delegate { UninstallCore(dir, confirmClose); }); }
    static void InstallCore(string dir, Func<bool> confirmClose) {
      Check(dir); RequireClosed(dir, confirmClose);
      string resources = Resources(dir), archive = Path.Combine(resources, "app.asar"), plugin = Plugin(dir);
      string token = Guid.NewGuid().ToString("N");
      string stage = Path.Combine(resources, "atk-wallpaper-stage-" + token), old = Path.Combine(resources, "atk-wallpaper-old-" + token);
      string next = Path.Combine(resources, "atk-wallpaper-" + token + ".asar");
      string manifestNext = Manifest(dir) + "." + token + ".tmp";
      var previous = ReadManifest(dir); string currentHash = Archive.FileHash(archive), source = archive;
      RequireOwned(plugin);
      if (Archive.HasMarker(archive)) {
        if (previous == null || Convert.ToString(previous["InstalledHash"]) != currentHash) throw new Exception("插件入口已被其他程序修改，拒绝覆盖。请先检查备份与清单。");
        source = BackupPath(dir, previous);
        if (!File.Exists(source) || Archive.FileHash(source) != Convert.ToString(previous["OriginalHash"])) throw new Exception("原始备份丢失或校验失败。");
      }
      bool movedOld = false, movedNew = false, replaced = false;
      string rollback = Path.Combine(resources, "atk-wallpaper-rollback-" + token + ".asar");
      try {
        Extract(stage);
        Archive.Patch(source, next);
        string originalHash = Archive.FileHash(source);
        string backupRelative = Path.Combine("atk-wallpaper-backups", originalHash, "app.asar");
        string backup = Path.Combine(resources, backupRelative);
        Directory.CreateDirectory(Path.GetDirectoryName(backup));
        if (!File.Exists(backup)) File.Copy(source, backup);
        if (Archive.FileHash(backup) != originalHash) throw new Exception("备份校验失败。");
        var state = new Dictionary<string, object> { { "Owner", Owner }, { "Version", "1.0.0" }, { "OriginalHash", originalHash }, { "InstalledHash", Archive.FileHash(next) }, { "Backup", backupRelative }, { "InstalledAt", DateTime.UtcNow.ToString("o") } };
        File.WriteAllText(manifestNext, Archive.Json.Serialize(state), new UTF8Encoding(false));
        RequireClosed(dir);
        if (Directory.Exists(plugin)) { Directory.Move(plugin, old); movedOld = true; }
        Directory.Move(stage, plugin); movedNew = true;
        File.Replace(next, archive, rollback); replaced = true;
        if (File.Exists(Manifest(dir))) File.Replace(manifestNext, Manifest(dir), null); else File.Move(manifestNext, Manifest(dir));
      } catch {
        if (replaced && File.Exists(rollback)) File.Replace(rollback, archive, null);
        if (movedNew) { RequireOwned(plugin); Directory.Delete(plugin, true); }
        if (movedOld) Directory.Move(old, plugin);
        throw;
      } finally {
        if (Directory.Exists(stage)) { RequireOwned(stage); Directory.Delete(stage, true); }
        if (File.Exists(next)) File.Delete(next);
        if (File.Exists(manifestNext)) File.Delete(manifestNext);
      }
      if (Directory.Exists(old)) { RequireOwned(old); Directory.Delete(old, true); }
      if (File.Exists(rollback)) File.Delete(rollback);
    }
    static void UninstallCore(string dir, Func<bool> confirmClose) {
      Check(dir); RequireClosed(dir, confirmClose);
      var state = ReadManifest(dir); if (state == null) throw new Exception("此目录没有本插件的安装清单。");
      string archive = Path.Combine(Resources(dir), "app.asar"), plugin = Plugin(dir);
      RequireOwned(plugin);
      string current = Archive.FileHash(archive);
      if (current != Convert.ToString(state["InstalledHash"])) {
        if (Archive.HasMarker(archive)) throw new Exception("归档已被修改，拒绝用旧备份覆盖。请保留备份并检查差异。");
        // Official updater replaced the archive: remove only our files and keep the new official app.
      } else {
        string backup = BackupPath(dir, state);
        if (!File.Exists(backup) || Archive.FileHash(backup) != Convert.ToString(state["OriginalHash"])) throw new Exception("备份丢失或校验失败，无法还原。");
        string temp = archive + "." + Guid.NewGuid().ToString("N") + ".restore";
        try { File.Copy(backup, temp); File.Replace(temp, archive, null); }
        finally { if (File.Exists(temp)) File.Delete(temp); }
      }
      if (Directory.Exists(plugin)) Directory.Delete(plugin, true);
      File.Delete(Manifest(dir));
    }
  }

  internal static class Program {
    static string DefaultDirectory { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "ATK HUB"); } }
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool AttachConsole(uint processId);
    [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int handle);
    [DllImport("kernel32.dll")] static extern uint GetFileType(IntPtr handle);
    static void InitializeCommandLine() {
      // Keep redirected pipes intact for scripts. A GUI-subsystem executable can
      // attach to an existing terminal without creating a console window of its own.
      uint outputType = GetFileType(GetStdHandle(-11));
      if (outputType != 1 && outputType != 3) AttachConsole(uint.MaxValue);
      Console.SetOut(new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false)) { AutoFlush = true });
      Console.SetError(new StreamWriter(Console.OpenStandardError(), new UTF8Encoding(false)) { AutoFlush = true });
    }
    static void ShowSuccessAndClose(Form form, bool uninstall) {
      string message = uninstall
        ? "卸载完成，已还原 ATK HUB。\n原始备份和用户配置已保留。"
        : "安装成功！\n重新启动 ATK HUB，点击右上角「壁纸」即可使用。";
      MessageBox.Show(form, message, uninstall ? "卸载完成" : "安装成功", MessageBoxButtons.OK, MessageBoxIcon.Information);
      form.Close();
    }
    static bool ConfirmCloseRunningHub(IWin32Window owner) {
      return MessageBox.Show(owner,
        "检测到所选目录的 ATK HUB 正在运行，是否强制关闭并继续？\n\n强制关闭可能丢失尚未保存的设置。选择“否”将取消本次操作。",
        "ATK HUB 正在运行", MessageBoxButtons.YesNo, MessageBoxIcon.Warning, MessageBoxDefaultButton.Button2) == DialogResult.Yes;
    }
    [STAThread] static int Main(string[] args) {
      try {
        if (args.Length > 0) {
          string command = args[0].ToLowerInvariant();
          if (!command.EndsWith("-ui")) InitializeCommandLine();
          string dir = args.Length > 1 ? args[1] : DefaultDirectory;
          if (command == "--check" || command == "/check") Console.WriteLine(Installer.Check(dir));
          else if (command == "--install" || command == "/install" || command == "--install-ui") { Installer.Install(dir, command.EndsWith("-ui") ? (Func<bool>)(() => ConfirmCloseRunningHub(null)) : null); Console.WriteLine("安装完成。重新启动 ATK HUB，点击右上角「壁纸」。"); }
          else if (command == "--uninstall" || command == "/uninstall" || command == "--uninstall-ui") { Installer.Uninstall(dir, command.EndsWith("-ui") ? (Func<bool>)(() => ConfirmCloseRunningHub(null)) : null); Console.WriteLine("已卸载。原始备份与用户配置已保留。"); }
          else if (command == "--prepare" && args.Length == 3) { Installer.Check(dir); Archive.Patch(Path.Combine(Installer.Resources(dir), "app.asar"), Path.GetFullPath(args[2])); Console.WriteLine("已生成待审查归档，未修改安装目录。"); }
          else throw new Exception("用法：--check [目录] | --install [目录] | --uninstall [目录] | --prepare <目录> <输出.asar>");
          return 0;
        }
        Application.EnableVisualStyles();
        var form = new Form { Text = "ATK HUB Wallpaper 1.0.0", ClientSize = new Size(620, 290), StartPosition = FormStartPosition.CenterScreen, FormBorderStyle = FormBorderStyle.FixedDialog, MaximizeBox = false, Font = new Font("Microsoft YaHei UI", 9) };
        var title = new Label { Text = "ATK HUB Wallpaper", Left = 22, Top = 22, Width = 570, Height = 30, Font = new Font("Microsoft YaHei UI", 13, FontStyle.Bold) };
        var hint = new Label { Text = "支持图片、视频与兼容场景。检测到 ATK HUB 运行时可确认强制关闭。\n安装自动备份，卸载核对 SHA256；官方更新后可重新安装。", Left = 24, Top = 65, Width = 570, Height = 48 };
        var input = new TextBox { Text = DefaultDirectory, Left = 24, Top = 125, Width = 475 };
        var browse = new Button { Text = "浏览…", Left = 510, Top = 122, Width = 85, Height = 30 };
        browse.Click += delegate { using (var dialog = new FolderBrowserDialog { SelectedPath = input.Text }) if (dialog.ShowDialog(form) == DialogResult.OK) input.Text = dialog.SelectedPath; };
        var status = new Label { Text = "配置保留在 %APPDATA%\\ATK-HUB\\atk-wallpaper", Left = 24, Top = 240, Width = 570, Height = 24 };
        int left = 24;
        foreach (string action in new[] { "检测", "安装 / 更新", "卸载还原" }) {
          string selected = action;
          var button = new Button { Text = action, Left = left, Top = 180, Width = 175, Height = 38 }; left += 194;
          button.Click += delegate {
            try {
              if (selected == "检测") { MessageBox.Show(form, Installer.Check(input.Text), "兼容性检测"); return; }
              var identity = System.Security.Principal.WindowsIdentity.GetCurrent();
              bool admin = new System.Security.Principal.WindowsPrincipal(identity).IsInRole(System.Security.Principal.WindowsBuiltInRole.Administrator);
              if (!admin) {
                var info = new ProcessStartInfo(Assembly.GetExecutingAssembly().Location, (selected == "卸载还原" ? "--uninstall-ui" : "--install-ui") + " \"" + input.Text.TrimEnd('\\') + "\"") { UseShellExecute = true, Verb = "runas" };
                using (var process = Process.Start(info)) { process.WaitForExit(); if (process.ExitCode == 2) { status.Text = "已取消操作。"; return; } if (process.ExitCode != 0) throw new Exception("操作未完成，退出码 " + process.ExitCode + "。可在管理员终端运行命令查看详情。"); }
              } else if (selected == "卸载还原") Installer.Uninstall(input.Text, () => ConfirmCloseRunningHub(form)); else Installer.Install(input.Text, () => ConfirmCloseRunningHub(form));
              ShowSuccessAndClose(form, selected == "卸载还原");
            } catch (OperationCanceledException) { status.Text = "已取消操作。"; }
            catch (Exception error) { MessageBox.Show(form, error.Message, "操作未完成", MessageBoxButtons.OK, MessageBoxIcon.Error); }
          };
          form.Controls.Add(button);
        }
        form.Controls.AddRange(new Control[] { title, hint, input, browse, status }); Application.Run(form); return 0;
      } catch (OperationCanceledException) { return 2; }
      catch (Exception error) {
        Console.Error.WriteLine(error.Message);
        if (args.Length > 0 && args[0].EndsWith("-ui")) MessageBox.Show(error.Message, "ATK 壁纸插件：操作未完成", MessageBoxButtons.OK, MessageBoxIcon.Error);
        return 1;
      }
    }
  }
}
