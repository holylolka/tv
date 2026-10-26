# Рисует тёмный фон img/bg.jpg: ночное небо, горы и озеро.
# Запуск: powershell -ExecutionPolicy Bypass -File tools\make-bg.ps1
Add-Type -AssemblyName System.Drawing

$W = 1920; $H = 1080
$out = Join-Path $PSScriptRoot '..\img\bg.jpg'
$bmp = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'

function C($hex) { [System.Drawing.ColorTranslator]::FromHtml($hex) }

# Небо
$sky = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Rectangle 0, 0, $W, 760), (C '#05070f'), (C '#1b2440'), 90
$g.FillRectangle($sky, 0, 0, $W, 760)

# Мягкое свечение луны справа
$glow = New-Object System.Drawing.Drawing2D.GraphicsPath
$glow.AddEllipse(1180, 40, 560, 560)
$pgb = New-Object System.Drawing.Drawing2D.PathGradientBrush $glow
$pgb.CenterColor = [System.Drawing.Color]::FromArgb(70, 150, 170, 220)
$pgb.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 27, 36, 64))
$g.FillPath($pgb, $glow)
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(235, 225, 230, 245))), 1430, 290, 60, 60)

# Звёзды
$rnd = New-Object System.Random 27
for ($i = 0; $i -lt 260; $i++) {
    $x = $rnd.Next(0, $W); $y = $rnd.Next(0, 620)
    $a = $rnd.Next(40, 200); $s = $rnd.NextDouble() * 2 + 0.6
    $g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($a, 220, 228, 255))), $x, $y, $s, $s)
}

# Хребты: от дальнего к ближнему
function Ridge($base, $amp, $seed, $color) {
    $r = New-Object System.Random $seed
    $pts = New-Object System.Collections.Generic.List[System.Drawing.PointF]
    $pts.Add((New-Object System.Drawing.PointF 0, 760))
    $y = $base
    for ($x = 0; $x -le $W; $x += 40) {
        $y = [Math]::Max($base - $amp, [Math]::Min($base + $amp / 3, $y + $r.Next(-$amp / 3, $amp / 3)))
        $pts.Add((New-Object System.Drawing.PointF $x, $y))
    }
    $pts.Add((New-Object System.Drawing.PointF $W, 760))
    $g.FillPolygon((New-Object System.Drawing.SolidBrush (C $color)), $pts.ToArray())
}
Ridge 600 120 3 '#161d33'
Ridge 650 90 11 '#10162a'
Ridge 700 60 19 '#0a0f1e'

# Озеро с лёгким отражением
$lake = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Rectangle 0, 758, $W, 322), (C '#0d1324'), (C '#03050b'), 90
$g.FillRectangle($lake, 0, 758, $W, 322)
$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(60, 190, 200, 235)), 2
for ($i = 0; $i -lt 9; $i++) {
    $yy = 780 + $i * 22; $len = 160 - $i * 14
    $g.DrawLine($pen, 1460 - $len / 2, $yy, 1460 + $len / 2, $yy)
}

# Затемнение слева, чтобы текст читался
$shade = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Rectangle 0, 0, 1100, $H), ([System.Drawing.Color]::FromArgb(150, 0, 0, 0)), ([System.Drawing.Color]::FromArgb(0, 0, 0, 0)), 0
$g.FillRectangle($shade, 0, 0, 1100, $H)

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters 1
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 88L
$bmp.Save([System.IO.Path]::GetFullPath($out), $codec, $ep)
$g.Dispose(); $bmp.Dispose()
