using System;
using System.Diagnostics;
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
            result.focusToken = Token(editor);
            result.fieldSignature = Signature(editor);
            result.canPaste = result.focusToken.Length > 0;
            result.reason = result.canPaste ? "ready" : "unverified_field";
        } catch { result.reason = "accessibility_unavailable"; }
        return result;
    }
    static void Focus() { Emit(Capture()); }
    static INPUT Key(ushort key, bool up) { return new INPUT { type=1, data=new UNION { key=new KEYBDINPUT { vk=key, flags=up ? 2u : 0u } } }; }
    static object Paste(string[] args) {
        if (args.Length < 5) return new {ok=false, reason="no_target"};
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
        var keys=new [] { Key(0x11,false), Key(0x56,false), Key(0x56,true), Key(0x11,true) };
        uint sent = SendInput(4,keys,Marshal.SizeOf(typeof(INPUT)));
        if (sent != 4) {
            // Release keys if Windows accepted only part of the chord. Never retry text insertion.
            var release = new [] { Key(0x56,true), Key(0x11,true) };
            SendInput(2,release,Marshal.SizeOf(typeof(INPUT)));
            return new {ok=false, reason="input_blocked"};
        }
        return new {ok=true, reason=sameField ? "sent" : sameReplacement ? "sent_compatible" : "sent_window"};
    }
    static void Listen(string chord) {
        int[] keys = chord=="F8" ? new[]{0x77} : chord=="F9" ? new[]{0x78} : chord=="Ctrl+Shift+Space" ? new[]{0x11,0x10,0x20} : new[]{0x11,0x12,0x20};
        bool was=false, escapeWas=false;
        while(true) {
            bool down=true; foreach(int k in keys) down &= Down(k);
            if(down!=was) { Emit(new {type=down ? "fnDown" : "fnUp"}); was=down; }
            bool escape=Down(0x1B);
            if(escape && !escapeWas) Emit(new {type="cancel"});
            escapeWas=escape;
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
