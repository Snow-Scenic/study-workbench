Option Explicit
Dim fso, ws, scriptDir, bat, result, failure
Set fso = CreateObject("Scripting.FileSystemObject")
Set ws = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
On Error Resume Next
ws.CurrentDirectory = scriptDir
failure = Err.Number
Err.Clear
On Error GoTo 0
If failure <> 0 Then
    MsgBox "Cannot open application directory: " & scriptDir, vbCritical, "Study Workbench"
    WScript.Quit 1
End If
bat = fso.BuildPath(scriptDir, "run_desktop.bat")
If Not fso.FileExists(bat) Then
    MsgBox "Missing run_desktop.bat: " & bat, vbCritical, "Study Workbench"
    WScript.Quit 1
End If
On Error Resume Next
result = ws.Run("cmd.exe /d /c """ & bat & """ --silent", 0, True)
failure = Err.Number
Err.Clear
On Error GoTo 0
If failure <> 0 Or result <> 0 Then
    MsgBox "Startup failed. Check desktop_startup.log and error.log.", vbCritical, "Study Workbench"
    WScript.Quit 1
End If
WScript.Quit 0
