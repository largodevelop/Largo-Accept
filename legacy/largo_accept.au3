; Largo Accept — только автопринятие (без мыши)
; Когда на экране зелёная «ПРИНЯТЬ» → Enter в окно Dota
#NoTrayIcon

DllCall("user32.dll", "bool", "SetProcessDPIAware")

Opt("PixelCoordMode", 1)
Opt("WinTitleMatchMode", 2)

HotKeySet("{F11}", "_exit")

Global Const $acceptGreens[6] = [0x66C810, 0x7ED321, 0xA8D208, 0x5CB20A, 0x8BC34A, 0x4CAF00]
Global $lastAcceptAt = 0

While 1
	Sleep(100)
	_acceptInvite()
WEnd

Func _findAcceptGreen()
	Local $i, $pos
	For $i = 0 To UBound($acceptGreens) - 1
		$pos = PixelSearch(640, 400, 1280, 720, $acceptGreens[$i], 40, 2)
		If IsArray($pos) Then Return $pos
	Next
	Return 0
EndFunc

Func _pushAcceptKey()
	Local $h = WinGetHandle("Dota 2")
	If $h = 0 Then $h = WinGetHandle("[CLASS:SDL_app]")
	If $h <> 0 Then
		ControlSend($h, "", "", "{ENTER}")
		Sleep(50)
		ControlSend($h, "", "", "{ENTER}")
		Return True
	EndIf
	Send("{ENTER}")
	Return True
EndFunc

Func _acceptInvite()
	If TimerDiff($lastAcceptAt) < 1800 And $lastAcceptAt > 0 Then Return False
	If Not IsArray(_findAcceptGreen()) Then Return False
	_pushAcceptKey()
	$lastAcceptAt = TimerInit()
	Sleep(200)
	Return True
EndFunc

Func _exit()
	Exit
EndFunc
