param([string]$Capture='interior.png',[string]$Output='comparison.jpg')
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$reference=[System.Drawing.Image]::FromFile('C:/Users/Administrator/.codex/generated_images/01a0a95b-cb7c-75e1-8f36-c177991337d3/exec-657580f2-812b-4b76-9766-edd239454ce5.png')
$captureImage=[System.Drawing.Image]::FromFile((Join-Path $PSScriptRoot $Capture))
$comparison=[System.Drawing.Bitmap]::new(2560,720)
$graphics=[System.Drawing.Graphics]::FromImage($comparison)
try{
  $graphics.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.DrawImage($reference,0,0,1280,720)
  $graphics.DrawImage($captureImage,1280,0,1280,720)
  $comparison.Save((Join-Path $PSScriptRoot $Output),[System.Drawing.Imaging.ImageFormat]::Jpeg)
}finally{$graphics.Dispose();$comparison.Dispose();$captureImage.Dispose();$reference.Dispose()}
