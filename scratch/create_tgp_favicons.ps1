Add-Type -AssemblyName System.Drawing

# 1. High-quality responsive SVG Favicon
$svgContent = @'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
  <!-- Dark backdrop circle / soft square for high contrast -->
  <rect width="120" height="120" rx="28" fill="#0A0A0B" />
  
  <!-- Subtle inner border -->
  <rect x="1" y="1" width="118" height="118" rx="27" stroke="rgba(255,255,255,0.08)" stroke-width="1.5" />

  <!-- TGP Iconic Puzzle Piece (White Neon Stroke with Rounded Terminations) -->
  <path
    d="M 40 32
       L 51 32
       C 54.5 32 52.5 27 50.5 24
       C 48 20 50.5 14 60 14
       C 69.5 14 72 20 69.5 24
       C 67.5 27 65.5 32 69 32
       L 80 32
       A 8 8 0 0 1 88 40
       L 88 80
       A 8 8 0 0 1 80 88
       L 69 88
       C 65.5 88 67.5 93 69.5 96
       C 72 100 69.5 106 60 106
       C 50.5 106 48 100 50.5 96
       C 52.5 93 54.5 88 51 88
       L 40 88
       A 8 8 0 0 1 32 80
       L 32 69
       C 32 65.5 37 67.5 40 69.5
       C 44 72 50 69.5 50 60
       C 50 50.5 44 48 40 50.5
       C 37 52.5 32 54.5 32 51
       L 32 40
       A 8 8 0 0 1 40 32 Z"
    stroke="#F5F5F7"
    stroke-width="5.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
  />
</svg>
'@

Set-Content -Path "c:\Users\ygnat\tgp-hemeroteca\public\favicon.svg" -Value $svgContent -Encoding UTF8
Write-Host "Created public/favicon.svg"

# 2. Render PNG 512x512 and 192x192 and favicon.ico using System.Drawing
$width = 512
$height = 512
$bmp = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)

# Background rounded rect
$bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 10, 10, 11))
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$r = 120
$rect = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
$path.AddArc($rect.X, $rect.Y, $r, $r, 180, 90)
$path.AddArc($rect.Right - $r, $rect.Y, $r, $r, 270, 90)
$path.AddArc($rect.Right - $r, $rect.Bottom - $r, $r, $r, 0, 90)
$path.AddArc($rect.X, $rect.Bottom - $r, $r, $r, 90, 90)
$path.CloseFigure()
$g.FillPath($bgBrush, $path)

# Border
$borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(40, 255, 255, 255), 6)
$g.DrawPath($borderPen, $path)

# Draw puzzle path scaled to 512x512 (scale factor = 512 / 120 = 4.266)
$scale = 512.0 / 120.0
$puzzlePath = New-Object System.Drawing.Drawing2D.GraphicsPath

# Function to scale point
function Pt($x, $y) {
    return New-Object System.Drawing.PointF(($x * $scale), ($y * $scale))
}

$puzzlePath.StartFigure()
# Start at (40, 32)
$puzzlePath.AddLine((Pt 40 32), (Pt 51 32))
$puzzlePath.AddBezier((Pt 51 32), (Pt 54.5 32), (Pt 52.5 27), (Pt 50.5 24))
$puzzlePath.AddBezier((Pt 50.5 24), (Pt 48 20), (Pt 50.5 14), (Pt 60 14))
$puzzlePath.AddBezier((Pt 60 14), (Pt 69.5 14), (Pt 72 20), (Pt 69.5 24))
$puzzlePath.AddBezier((Pt 69.5 24), (Pt 67.5 27), (Pt 65.5 32), (Pt 69 32))
$puzzlePath.AddLine((Pt 69 32), (Pt 80 32))
# Top right corner
$puzzlePath.AddArc((80 - 8)*$scale, (32)*$scale, 16*$scale, 16*$scale, 270, 90)
# Right side
$puzzlePath.AddLine((Pt 88 40), (Pt 88 80))
# Bottom right corner
$puzzlePath.AddArc((80 - 8)*$scale, (80 - 8)*$scale, 16*$scale, 16*$scale, 0, 90)
# Bottom side
$puzzlePath.AddLine((Pt 80 88), (Pt 69 88))
$puzzlePath.AddBezier((Pt 69 88), (Pt 65.5 88), (Pt 67.5 93), (Pt 69.5 96))
$puzzlePath.AddBezier((Pt 69.5 96), (Pt 72 100), (Pt 69.5 106), (Pt 60 106))
$puzzlePath.AddBezier((Pt 60 106), (Pt 50.5 106), (Pt 48 100), (Pt 50.5 96))
$puzzlePath.AddBezier((Pt 50.5 96), (Pt 52.5 93), (Pt 54.5 88), (Pt 51 88))
$puzzlePath.AddLine((Pt 51 88), (Pt 40 88))
# Bottom left corner
$puzzlePath.AddArc((32)*$scale, (80 - 8)*$scale, 16*$scale, 16*$scale, 90, 90)
# Left side
$puzzlePath.AddLine((Pt 32 80), (Pt 32 69))
$puzzlePath.AddBezier((Pt 32 69), (Pt 32 65.5), (Pt 37 67.5), (Pt 40 69.5))
$puzzlePath.AddBezier((Pt 40 69.5), (Pt 44 72), (Pt 50 69.5), (Pt 50 60))
$puzzlePath.AddBezier((Pt 50 60), (Pt 50 50.5), (Pt 44 48), (Pt 40 50.5))
$puzzlePath.AddBezier((Pt 40 50.5), (Pt 37 52.5), (Pt 32 54.5), (Pt 32 51))
$puzzlePath.AddLine((Pt 32 51), (Pt 32 40))
# Top left corner
$puzzlePath.AddArc((32)*$scale, (32)*$scale, 16*$scale, 16*$scale, 180, 90)
$puzzlePath.CloseFigure()

# Neon puzzle stroke
$puzzlePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 245, 245, 247), (5.5 * $scale))
$puzzlePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$puzzlePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$puzzlePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

# Draw glow
$glowPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(50, 255, 255, 255), (9.0 * $scale))
$glowPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$g.DrawPath($glowPen, $puzzlePath)

$g.DrawPath($puzzlePen, $puzzlePath)

# Save PNG
$bmp.Save("c:\Users\ygnat\tgp-hemeroteca\public\favicon.png", [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Created public/favicon.png (512x512)"

# Create 32x32 icon for favicon.ico
$icoBmp = New-Object System.Drawing.Bitmap($bmp, 32, 32)
$hIcon = $icoBmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$fs = [System.IO.File]::OpenWrite("c:\Users\ygnat\tgp-hemeroteca\public\favicon.ico")
$icon.Save($fs)
$fs.Close()
Write-Host "Created public/favicon.ico (32x32)"

$g.Dispose()
$bmp.Dispose()
$icoBmp.Dispose()
