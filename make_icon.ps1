Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile('pizza.webp')
$bmp = New-Object System.Drawing.Bitmap(180, 180)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White)
$g.DrawImage($img, 0, 0, 180, 180)
$g.Dispose()
$img.Dispose()
$bmp.Save('public\apple-touch-icon.png', [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "Done"
