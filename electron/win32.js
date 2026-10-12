"use strict";

// Тонкая обёртка над WinAPI через koffi (без PowerShell и внешних exe).
// Все координаты — физические пиксели экрана.

const koffi = require("koffi");

const user32 = koffi.load("user32.dll");

const RECT = koffi.struct("RECT", { left: "int32", top: "int32", right: "int32", bottom: "int32" });
const POINT = koffi.struct("POINT", { x: "int32", y: "int32" });

const FindWindowW = user32.func("intptr_t __stdcall FindWindowW(str16 cls, str16 title)");
const GetForegroundWindow = user32.func("intptr_t __stdcall GetForegroundWindow()");
const SetForegroundWindow = user32.func("bool __stdcall SetForegroundWindow(intptr_t h)");
const IsWindow = user32.func("bool __stdcall IsWindow(intptr_t h)");
const IsIconic = user32.func("bool __stdcall IsIconic(intptr_t h)");
const ShowWindow = user32.func("bool __stdcall ShowWindow(intptr_t h, int cmd)");
const GetClientRect = user32.func("bool __stdcall GetClientRect(intptr_t h, _Out_ RECT* r)");
const ClientToScreen = user32.func("bool __stdcall ClientToScreen(intptr_t h, _Inout_ POINT* p)");
const GetCursorPos = user32.func("bool __stdcall GetCursorPos(_Out_ POINT* p)");
const SetCursorPos = user32.func("bool __stdcall SetCursorPos(int x, int y)");
const mouse_event = user32.func(
  "void __stdcall mouse_event(uint32 flags, uint32 dx, uint32 dy, uint32 data, uintptr_t extra)"
);
const keybd_event = user32.func("void __stdcall keybd_event(uint8 vk, uint8 scan, uint32 flags, uintptr_t extra)");

const SW_RESTORE = 9;
const MOUSEEVENTF_LEFTDOWN = 0x0002;
const MOUSEEVENTF_LEFTUP = 0x0004;
const KEYEVENTF_KEYUP = 0x0002;
const VK_MENU = 0x12;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Окно Dota 2 (SDL-окно с заголовком «Dota 2»), либо 0. */
function findDotaWindow() {
  const h = FindWindowW("SDL_app", "Dota 2");
  return h && IsWindow(h) ? h : 0;
}

function isForeground(hwnd) {
  return GetForegroundWindow() === hwnd;
}

/** Клиентская область окна в координатах экрана, либо null. */
function getClientRectOnScreen(hwnd) {
  if (!hwnd || IsIconic(hwnd)) return null;
  const r = {};
  if (!GetClientRect(hwnd, r)) return null;
  const width = r.right - r.left;
  const height = r.bottom - r.top;
  if (width <= 0 || height <= 0) return null;
  const p = { x: 0, y: 0 };
  ClientToScreen(hwnd, p);
  return { x: p.x, y: p.y, width, height };
}

/** Вернуть окно на передний план (обычный трюк с Alt, иначе Windows не даст). */
async function bringToForeground(hwnd) {
  if (IsIconic(hwnd)) ShowWindow(hwnd, SW_RESTORE);
  keybd_event(VK_MENU, 0, 0, 0);
  keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, 0);
  SetForegroundWindow(hwnd);
  await sleep(150);
  return isForeground(hwnd);
}

/** Клик левой кнопкой в точку экрана; курсор возвращается на место. */
async function clickAt(x, y) {
  const prev = {};
  const hadPrev = GetCursorPos(prev);
  SetCursorPos(Math.round(x), Math.round(y));
  await sleep(60);
  mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
  await sleep(45);
  mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
  await sleep(60);
  if (hadPrev) SetCursorPos(prev.x, prev.y);
}

module.exports = { findDotaWindow, isForeground, getClientRectOnScreen, bringToForeground, clickAt, sleep };
