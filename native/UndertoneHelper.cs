using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Runtime.InteropServices;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Automation;

class UndertoneHelper {
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll", SetLastError=true)] static extern uint SendInput(uint n, INPUT[] inputs, int size);
    [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public UNION data; }
    [StructLayout(LayoutKind.Explicit)] struct UNION { [FieldOffset(0)] public KEYBDINPUT key; [FieldOffset(0)] public MOUSEINPUT mouse; }
    [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort vk, scan; public uint flags, time; public UIntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int x,y; public uint data,flags,time; public UIntPtr extra; }
    static void Emit(object o) { Console.WriteLine(new JavaScriptSerializer().Serialize(o)); Console.Out.Flush(); }
    static bool Down(int key) { return (GetAsyncKeyState(key) & 0x8000) != 0; }
    [StructLayout(LayoutKind.Sequential)] struct RECT { public int left, top, right, bottom; }
    [StructLayout(LayoutKind.Sequential)] struct GUITHREADINFO {
        public uint cbSize, flags;
        public IntPtr hwndActive, hwndFocus, hwndCapture, hwndMenuOwner, hwndMoveSize, hwndCaret;
        public RECT rcCaret;
    }
    [DllImport("user32.dll")] static extern bool GetGUIThreadInfo(uint id, ref GUITHREADINFO info);
    class FocusState {
        public bool canPaste;
        public string appName = "", windowHandle = "", focusToken = "", fieldSignature = "", reason = "no_field";
        public uint processIdentifier;
        [ScriptIgnore] public AutomationElement editor;
    }
    static string Token(AutomationElement e) { try { return string.Join(".", e.GetRuntimeId()); } catch { return ""; } }
    static string Signature(AutomationElement e) {
        try {
            var parent = TreeWalker.RawViewWalker.GetParent(e);
            var parentToken = parent == null ? "" : Token(parent);
            var r = e.Current.BoundingRectangle;
            if (parentToken.Length == 0 || r.IsEmpty || r.Width <= 0 || r.Height <= 0) return "";
            // No text/value collection. Parent identity prevents cross-document fallback.
            return parentToken + "|" + e.Current.ControlType.Id + "|" + e.Current.AutomationId + "|" + e.Current.ClassName + "|" +
                Math.Round(r.X) + "," + Math.Round(r.Y) + "," + Math.Round(r.Width) + "," + Math.Round(r.Height);
        } catch { return ""; }
    }
    static FocusState Capture() {
        var result = new FocusState();
        var h = GetForegroundWindow(); uint pid; var thread = GetWindowThreadProcessId(h, out pid);
        result.processIdentifier = pid; result.windowHandle = h.ToInt64().ToString();
        try { result.appName = Process.GetProcessById((int)pid).ProcessName; } catch { }
        try {
            var focused = AutomationElement.FocusedElement;
            if (focused == null) return result;
            var focusedType = focused.Current.ControlType;
            if (focusedType == ControlType.Button || focusedType == ControlType.Hyperlink ||
                focusedType == ControlType.CheckBox || focusedType == ControlType.RadioButton ||
                focusedType == ControlType.MenuItem || focusedType == ControlType.TabItem) return result;
            var e = focused; AutomationElement editor = null;
            for (int depth = 0; e != null && depth < 5; depth++) {
                if (e.Current.IsPassword) { result.reason = "password"; return result; }
                if (!e.Current.IsEnabled) { result.reason = "disabled"; return result; }
                if (e.Current.ControlType == ControlType.Button || e.Current.ControlType == ControlType.Hyperlink ||
                    e.Current.ControlType == ControlType.MenuItem) return result;
                object value;
                bool hasValue = e.TryGetCurrentPattern(ValuePattern.Pattern, out value);
                if (hasValue && ((ValuePattern)value).Current.IsReadOnly) { result.reason = "read_only"; return result; }
                var type = e.Current.ControlType;
                object text;
                bool textPattern = e.TryGetCurrentPattern(TextPattern.Pattern, out text);
                // Rich editors often focus a child rather than the editable document itself.
                if (editor == null && (hasValue || type == ControlType.Edit ||
                    (type == ControlType.Document && (textPattern || e.Current.HasKeyboardFocus)) ||
                    (type == ControlType.Custom && textPattern && e.Current.HasKeyboardFocus))) editor = e;
                if (type == ControlType.Window) break;
                e = TreeWalker.RawViewWalker.GetParent(e);
            }
            if (editor == null) {
                var gui = new GUITHREADINFO(); gui.cbSize = (uint)Marshal.SizeOf(typeof(GUITHREADINFO));
                // Native caret fallback, only when UIA also exposes a focused text-like control.
                var type = focused.Current.ControlType;
                if ((type == ControlType.Custom || type == ControlType.Pane || type == ControlType.Text) &&
                    GetGUIThreadInfo(thread, ref gui) && gui.hwndCaret != IntPtr.Zero && gui.hwndFocus != IntPtr.Zero)
                    editor = focused;
            }
            if (editor == null) return result;
            result.editor = editor;
            result.focusToken = Token(editor);
            result.fieldSignature = Signature(editor);
            result.canPaste = result.focusToken.Length > 0;
            result.reason = result.canPaste ? "ready" : "unverified_field";
        } catch { result.reason = "accessibility_unavailable"; }
        return result;
    }
    static void Focus() { Emit(Capture()); }
    static INPUT Key(ushort key, bool up) { return new INPUT { type=1, data=new UNION { key=new KEYBDINPUT { vk=key, flags=up ? 2u : 0u } } }; }
    const int MaxRead = 200000;
    // Reads the field only to compare it with the dictation; its text is never written out.
    static string ReadField(AutomationElement e) {
        if (e == null) return null;
        try {
            object p;
            if (e.TryGetCurrentPattern(TextPattern.Pattern, out p)) return ((TextPattern)p).DocumentRange.GetText(MaxRead + 1);
            if (e.TryGetCurrentPattern(ValuePattern.Pattern, out p)) return ((ValuePattern)p).Current.Value;
        } catch { }
        return null;
    }
    static string Squash(string s) { return Regex.Replace(s ?? "", @"\s+", " ").Trim(); }
    static bool Readable(string s) { return s != null && s.Length <= MaxRead; }
    static int Count(string text, string part) {
        int n = 0;
        for (int i = text.IndexOf(part, StringComparison.Ordinal); i >= 0; i = text.IndexOf(part, i + 1, StringComparison.Ordinal)) n++;
        return n;
    }
    // confirmed: the dictation now appears once more than before. missing: the field is readable and stayed unchanged for
    // a full second (slow apps get that long before "Not pasted" is claimed, which makes a double paste from the user unlikely).
    // unknown: the app hides its text or changed it some other way.
    static string CheckPasted(AutomationElement field, string before, string expected) {
        var want = Squash(expected);
        if (want.Length == 0 || field == null) return "unknown";
        // The end of the paste sits at the caret and survives editors that reflow the start.
        if (want.Length > 80) want = want.Substring(want.Length - 80);
        var was = Readable(before) ? Squash(before) : null;
        string now = null;
        // Stay well inside Undertone's 5 s helper timeout even when a huge document reads slowly.
        var clock = Stopwatch.StartNew();
        for (int i = 0; i < 10 && clock.ElapsedMilliseconds < 1500; i++) {
            Thread.Sleep(100);
            var after = ReadField(field);
            now = Readable(after) ? Squash(after) : null;
            if (now != null && now.Length > 0 && Count(now, want) > (was == null ? 0 : Count(was, want))) return "confirmed";
        }
        return was != null && now != null && now.Length > 0 && now == was ? "missing" : "unknown";
    }
    static object Paste(string[] args) {
        if (args.Length < 5) return new {ok=false, reason="no_target"};
        // The dictation arrives on stdin (not the command line, which other programs can read).
        string expected = "";
        try { expected = new StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false)).ReadToEnd(); } catch { }
        for (int i=0; i<100 && (Down(0x11)||Down(0x12)||Down(0x10)||Down(0x5B)||Down(0x5C)); i++) Thread.Sleep(10);
        if (Down(0x11)||Down(0x12)||Down(0x10)||Down(0x5B)||Down(0x5C)) return new {ok=false, reason="modifiers_held"};
        var current = Capture();
        if (current.processIdentifier.ToString()!=args[2] || current.windowHandle!=args[3]) return new {ok=false, reason="window_changed"};
        // Block only positively unsafe fields. Chromium apps often expose no field until their
        // accessibility tree is built, so an unidentified field in the same window still gets the paste.
        if (!current.canPaste && (current.reason=="password" || current.reason=="disabled" ||
            current.reason=="read_only" || current.reason=="accessibility_unavailable")) return new {ok=false, reason=current.reason};
        bool sameField = current.canPaste && args[4].Length > 0 && current.focusToken == args[4];
        bool sameReplacement = current.canPaste && args.Length > 5 && args[5].Length > 0 && current.fieldSignature == args[5];
        if (current.canPaste && args[4].Length > 0 && !sameField && !sameReplacement) return new {ok=false, reason="field_changed"};
        // Recheck foreground immediately before input; never activate another window.
        if (GetForegroundWindow().ToInt64().ToString()!=args[3]) return new {ok=false, reason="window_changed"};
        AutomationElement field = current.editor;
        if (field == null) { try { field = AutomationElement.FocusedElement; } catch { } }
        var before = ReadField(field);
        var keys=new [] { Key(0x11,false), Key(0x56,false), Key(0x56,true), Key(0x11,true) };
        uint sent = SendInput(4,keys,Marshal.SizeOf(typeof(INPUT)));
        if (sent != 4) {
            // Release keys if Windows accepted only part of the chord. Never retry text insertion.
            var release = new [] { Key(0x56,true), Key(0x11,true) };
            SendInput(2,release,Marshal.SizeOf(typeof(INPUT)));
            return new {ok=false, reason="input_blocked"};
        }
        return new {ok=true, reason=sameField ? "sent" : sameReplacement ? "sent_compatible" : "sent_window", verified=CheckPasted(field, before, expected)};
    }
    static void Listen(string chord) {
        int[] keys = chord=="F8" ? new[]{0x77} : chord=="F9" ? new[]{0x78} : chord=="Ctrl+Shift+Space" ? new[]{0x11,0x10,0x20} : new[]{0x11,0x12,0x20};
        bool was=false, escapeWas=false, pasteWas=false;
        while(true) {
            bool down=true; foreach(int k in keys) down &= Down(k);
            if(down!=was) { Emit(new {type=down ? "fnDown" : "fnUp"}); was=down; }
            bool escape=Down(0x1B);
            if(escape && !escapeWas) Emit(new {type="cancel"});
            escapeWas=escape;
            // Ctrl+V or Shift+Insert anywhere: lets Undertone take down its "press Ctrl+V" reminder.
            bool paste=(Down(0x11) && Down(0x56)) || (Down(0x10) && Down(0x2D));
            if(paste && !pasteWas) Emit(new {type="pasteKey"});
            pasteWas=paste;
            Thread.Sleep(10);
        }
    }
    [STAThread] static int Main(string[] args) {
        try {
            if(args.Length==0) return 1;
            switch(args[0]) {
                case "permissions": Emit(new {accessibility=true,inputMonitoring=true,postEvents=true,microphone="unknown"}); break;
                case "focus": Focus(); break;
                case "paste": Emit(Paste(args)); break;
                case "listen": Listen(args.Length>1 ? args[1] : "Ctrl+Alt+Space"); break;
                default: return 1;
            } return 0;
        } catch(Exception e) { Console.Error.WriteLine(e.Message); return 1; }
    }
}
