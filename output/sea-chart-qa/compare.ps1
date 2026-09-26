$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$references='C:/Users/Administrator/.codex/generated_images/01a0a95b-cb7c-75e1-8f36-c177991337d3'
$sources=@{
  chapter='exec-8f44f048-cece-454a-8273-02f74d31dd79.png'
  raid='exec-251a43fd-39c4-4632-93a8-1ed2d825e8d7.png'
  endless='exec-a2231210-aae9-4391-8e2b-17e24f1a9fd1.png'
  arena='exec-a961d815-f493-46cc-aa31-02fcd76ac32a.png'
  world='exec-6e9013b9-67ef-46bb-bd20-ac7cf5b97320.png'
}
foreach($name in $sources.Keys){
  $capturePath=Join-Path $PSScriptRoot ($name+'.png')
  if(!(Test-Path -LiteralPath $capturePath)){continue}
  $reference=[System.Drawing.Image]::FromFile((Join-Path $references $sources[$name]))
  $capture=[System.Drawing.Image]::FromFile($capturePath)
  $comparison=[System.Drawing.Bitmap]::new(2560,720)
  $graphics=[System.Drawing.Graphics]::FromImage($comparison)
  try{
    $graphics.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.DrawImage($reference,0,0,1280,720)
    $graphics.DrawImage($capture,1280,0,1280,720)
    $comparison.Save((Join-Path $PSScriptRoot ($name+'-comparison.jpg')),[System.Drawing.Imaging.ImageFormat]::Jpeg)
  }finally{$graphics.Dispose();$comparison.Dispose();$capture.Dispose();$reference.Dispose()}
}
