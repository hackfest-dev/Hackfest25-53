import platform
import subprocess

import psutil


def get_platform():
    return platform.system().lower()


def get_active_window():
    try:
        current_platform = get_platform()
        if current_platform == 'linux':
            window_id = subprocess.check_output(["xdotool", "getactivewindow"]).strip().decode()
            window_name = subprocess.check_output(["xdotool", "getwindowname", window_id]).strip().decode()
            pid = subprocess.check_output(["xdotool", "getwindowpid", window_id]).strip().decode()
            process_name = psutil.Process(int(pid)).name()
        elif current_platform == 'windows':
            import win32gui
            import win32process
            hwnd = win32gui.GetForegroundWindow()
            window_name = win32gui.GetWindowText(hwnd)
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            process_name = psutil.Process(pid).name()
        else:
            return None, None
        return window_name, process_name
    except Exception:
        return None, None


def get_idle_time():
    try:
        current_platform = get_platform()
        if current_platform == 'linux':
            idle_time = subprocess.check_output("xprintidle").strip().decode("utf-8")
            return int(idle_time) / 1000
        elif current_platform == 'windows':
            import ctypes
            class LASTINPUTINFO(ctypes.Structure):
                _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_ulong)]
            lii = LASTINPUTINFO()
            lii.cbSize = ctypes.sizeof(LASTINPUTINFO)
            ctypes.windll.user32.GetLastInputInfo(ctypes.byref(lii))
            millis = ctypes.windll.kernel32.GetTickCount() - lii.dwTime
            return millis / 1000.0
        return 0
    except Exception:
        return 0