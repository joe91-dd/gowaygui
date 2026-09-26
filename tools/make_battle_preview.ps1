Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$asset = Join-Path $root 'game/assets/resources/art-modern'
$outDir = Join-Path $root 'output/battle-ui-redesign'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$W = 1280; $H = 720
$bgPath = 'C:/Users/Administrator/.codex/generated_images/01a0a95b-cb7c-75e1-8f36-c177991337d3/exec-06495a89-17a9-4096-8ffa-b36a26a1be0b.png'

function Load-Bmp([string]$path) { return [System.Drawing.Bitmap]::FromFile($path) }
function Crop-Bmp($bmp, $x, $y, $w, $h) {
    $dst = New-Object System.Drawing.Bitmap($w,$h,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($dst)
    $g.DrawImage($bmp,(New-Object Drawing.Rectangle(0,0,$w,$h)),(New-Object Drawing.Rectangle($x,$y,$w,$h)),[Drawing.GraphicsUnit]::Pixel)
    $g.Dispose(); return $dst
}
function Key-Magenta($bmp) {
    $dst = New-Object System.Drawing.Bitmap($bmp.Width,$bmp.Height,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($dst); $g.DrawImageUnscaled($bmp,0,0); $g.Dispose()
    for($y=0;$y -lt $dst.Height;$y++) { for($x=0;$x -lt $dst.Width;$x++) {
        $c=$dst.GetPixel($x,$y)
        if($c.R -gt 185 -and $c.B -gt 150 -and $c.G -lt 110) { $dst.SetPixel($x,$y,[Drawing.Color]::FromArgb(0,$c.R,$c.G,$c.B)) }
    }}
    return $dst
}
function Round-Rect($g,$brush,$x,$y,$w,$h,$r) {
    $p=New-Object Drawing.Drawing2D.GraphicsPath
    $p.AddArc($x,$y,$r,$r,180,90); $p.AddArc($x+$w-$r,$y,$r,$r,270,90); $p.AddArc($x+$w-$r,$y+$h-$r,$r,$r,0,90); $p.AddArc($x,$y+$h-$r,$r,$r,90,90); $p.CloseFigure(); $g.FillPath($brush,$p); $p.Dispose()
}
function Round-Stroke($g,$pen,$x,$y,$w,$h,$r) {
    $p=New-Object Drawing.Drawing2D.GraphicsPath
    $p.AddArc($x,$y,$r,$r,180,90); $p.AddArc($x+$w-$r,$y,$r,$r,270,90); $p.AddArc($x+$w-$r,$y+$h-$r,$r,$r,0,90); $p.AddArc($x,$y+$h-$r,$r,$r,90,90); $p.CloseFigure(); $g.DrawPath($pen,$p); $p.Dispose()
}
function Txt($g,$text,$font,$brush,$x,$y,$w,$h,[System.Drawing.StringAlignment]$align='Near') {
    $owned=$false; if($brush -is [Drawing.Color]){$brush=New-Object Drawing.SolidBrush($brush);$owned=$true}
    $tx=[single]$x; $ty=[single]$y
    $measure=$g.MeasureString([string]$text,$font)
    if($align -eq 'Center'){$tx=[single]($x+($w-$measure.Width)/2)} elseif($align -eq 'Far'){$tx=[single]($x+$w-$measure.Width)}
    $ty=[single]($y+($h-$measure.Height)/2)
    $pt=[Drawing.PointF]::new($tx,$ty); $g.DrawString([string]$text,[Drawing.Font]$font,[Drawing.Brush]$brush,$pt); if($owned){$brush.Dispose()}
}
function Draw-Image($g,$bmp,$x,$y,$w,$h) { $g.DrawImage($bmp,(New-Object Drawing.Rectangle($x,$y,$w,$h))) }
function Fill-Round($g,$brush,$x,$y,$w,$h,$r) { Round-Rect $g $brush $x $y $w $h $r }
function Draw-Cell($g,$sheet,$col,$row,$cols,$rows,$x,$y,$w,$h,$key=$true) {
    $cw=[math]::Floor($sheet.Width/$cols); $ch=[math]::Floor($sheet.Height/$rows)
    $c=Crop-Bmp $sheet ($col*$cw) ($row*$ch) $cw $ch
    if($key){$k=Key-Magenta $c; $c.Dispose(); $c=$k}
    Draw-Image $g $c $x $y $w $h; $c.Dispose()
}
function Key-Light($bmp) {
    $dst=New-Object Drawing.Bitmap($bmp.Width,$bmp.Height,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g=[Drawing.Graphics]::FromImage($dst); $g.DrawImageUnscaled($bmp,0,0); $g.Dispose()
    for($y=0;$y -lt $dst.Height;$y++){for($x=0;$x -lt $dst.Width;$x++){
        $c=$dst.GetPixel($x,$y)
        if($c.R -gt 165 -and $c.G -gt 165 -and $c.B -gt 160){$dst.SetPixel($x,$y,[Drawing.Color]::FromArgb(0,$c.R,$c.G,$c.B))}
    }}
    return $dst
}
function Draw-Keyed($g,$bmp,$x,$y,$w,$h) {
    $k=Key-Light $bmp; Draw-Image $g $k $x $y $w $h; $k.Dispose()
}
function Card($g,$x,$y,$w,$h,$fill,$stroke,$radius=18) {
    Round-Rect $g (New-Object Drawing.SolidBrush($fill)) $x $y $w $h $radius
    Round-Stroke $g (New-Object Drawing.Pen($stroke,1.5)) $x $y $w $h $radius
}

$bg=Load-Bmp $bgPath
$main=Load-Bmp (Join-Path $asset 'combat-main-poses-refined.png')
$support=Load-Bmp (Join-Path $asset 'combat-support-poses-refined.png')
$enemy=Load-Bmp (Join-Path $asset 'battle-enemies-painted.png')
$skills=Load-Bmp (Join-Path $asset 'skill-icons-release.png')
$skillShot=Load-Bmp 'C:/Users/ADMINI~1/AppData/Local/Temp/codex-clipboard-43708f93-bc01-4335-8472-f64c9bdb7699.png'

$fontTitle=New-Object Drawing.Font('Microsoft YaHei UI',18,[Drawing.FontStyle]::Bold)
$fontSmall=New-Object Drawing.Font('Microsoft YaHei UI',12,[Drawing.FontStyle]::Regular)
$fontTiny=New-Object Drawing.Font('Microsoft YaHei UI',10,[Drawing.FontStyle]::Regular)
$fontBig=New-Object Drawing.Font('Microsoft YaHei UI',20,[Drawing.FontStyle]::Bold)
$white=[Drawing.Color]::White; $ink=[Drawing.Color]::FromArgb(235,250,255); $teal=[Drawing.Color]::FromArgb(15,56,72)
$quality=@([Drawing.Color]::FromArgb(80,210,140),[Drawing.Color]::FromArgb(65,190,245),[Drawing.Color]::FromArgb(170,115,255),[Drawing.Color]::FromArgb(255,190,60),[Drawing.Color]::FromArgb(255,105,90))

function Make-Scene([string]$mode) {
    $active=$mode -ne 'prep'; $fusion=$mode -eq 'fusion'
    $bmp=New-Object Drawing.Bitmap($W,$H,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g=[Drawing.Graphics]::FromImage($bmp); $g.SmoothingMode='AntiAlias'; $g.InterpolationMode='HighQualityBicubic'; $g.PixelOffsetMode='HighQuality'
    # Full-bleed map, with a subtle lower safe-zone veil.
    $g.DrawImage($bg,(New-Object Drawing.Rectangle(0,0,$W,$H)))
    $veil=New-Object Drawing.Drawing2D.LinearGradientBrush((New-Object Drawing.Rectangle(0,550,$W,170)),[Drawing.Color]::FromArgb(0,5,35,44),[Drawing.Color]::FromArgb(180,5,35,44),90)
    $g.FillRectangle($veil,0,550,$W,170); $veil.Dispose()

    # Compact top HUD.
    $topBrush=New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(218,8,45,59)); Round-Rect $g $topBrush 16 14 792 54 18; $topBrush.Dispose()
    $waveText = if($active){'第 1/5 波'}else{'第 0/5 波'}
    $labels=@('初到龟岛','守护 20/20',$waveText,'00:00')
    $xs=@(32,190,370,555); $ws=@(140,160,160,120)
    for($i=0;$i -lt $labels.Count;$i++){ Txt $g $labels[$i] $fontSmall $ink $xs[$i] 18 $ws[$i] 46 'Near' }
    foreach($pair in @(@(830,'1X'),@(908,'暂停'))){ $buttonWidth = if($pair[1]-eq '1X'){64}else{92}; $textWidth = if($pair[1]-eq '1X'){60}else{88}; $b=New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(232,232,247,239)); Round-Rect $g $b $pair[0] 14 $buttonWidth 54 18; $b.Dispose(); Txt $g $pair[1] $fontSmall $teal ($pair[0]+2) 18 $textWidth 46 'Center' }
    if($fusion){ Txt $g '局内合宠' $fontTiny ([Drawing.Brushes]::White) 1010 28 102 24 'Center' }
    elseif($active){ Txt $g '战斗中' $fontTiny ([Drawing.Brushes]::White) 1020 28 92 24 'Center' }
    else { Txt $g '待布阵' $fontTiny ([Drawing.Brushes]::White) 1020 28 92 24 'Center' }

    # Route markers on the playable area only.
    $routePen=New-Object Drawing.Pen([Drawing.Color]::FromArgb(120,255,245,180),2); $routePen.DashStyle='Dash'
    [Drawing.Point[]]$pts=@([Drawing.Point]::new(85,170),[Drawing.Point]::new(265,170),[Drawing.Point]::new(365,280),[Drawing.Point]::new(570,280),[Drawing.Point]::new(700,175),[Drawing.Point]::new(900,175),[Drawing.Point]::new(1045,270),[Drawing.Point]::new(1150,270))
    $g.DrawLines($routePen,$pts); $routePen.Dispose()
    $arrow=New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(215,255,248,180)); $g.FillPolygon($arrow,@([Drawing.Point]::new(86,162),[Drawing.Point]::new(105,170),[Drawing.Point]::new(86,178))); $arrow.Dispose()

    # Pearl endpoint emphasis.
    $glow=New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(50,120,245,255)); $g.FillEllipse($glow,1092,210,116,116); $glow.Dispose()
    $pearl=New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(230,244,251,255)); $g.FillEllipse($pearl,1112,230,76,76); $pearl.Dispose(); $g.DrawEllipse((New-Object Drawing.Pen([Drawing.Color]::FromArgb(230,110,230,255),3)),1112,230,76,76)
    Txt $g '守护目标' $fontTiny ([Drawing.Brushes]::White) 1082 318 136 26 'Center'

    # Allies: same project sprites, moved fully above the bottom safe zone.
    $allies=@(@(0,1,160,300,0),@(0,0,320,292,1),@(0,2,470,275,2),@(0,0,635,320,3),@(0,1,805,285,4))
    foreach($a in $allies){
        $ring=$quality[$a[4]]; $pen=New-Object Drawing.Pen([Drawing.Color]::FromArgb(230,$ring.R,$ring.G,$ring.B),3); $g.DrawEllipse($pen,$a[2],$a[3]+54,72,22); $pen.Dispose()
        $barBg=New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(190,35,45,52)); Fill-Round $g $barBg ($a[2]+4) ($a[3]-10) 64 7 3; $barBg.Dispose(); $hp=New-Object Drawing.SolidBrush($ring); Fill-Round $g $hp ($a[2]+4) ($a[3]-10) 54 7 3; $hp.Dispose()
        if($a[4]-ge 3){Draw-Cell $g $support $a[0] $a[1] 4 4 $a[2] $a[3] 92 92 $true} else {Draw-Cell $g $main $a[0] $a[1] 4 4 $a[2] $a[3] 92 92 $true}
    }

    # Enemies stay on the route and are separated from each other.
    if($active){
        $en=@(@(0,1,58,123,72),@(1,0,218,123,72),@(2,0,675,235,86),@(3,0,895,190,82))
        foreach($e in $en){
            $p=New-Object Drawing.Pen([Drawing.Color]::FromArgb(230,235,95,110),3); $g.DrawEllipse($p,$e[2],$e[3]+48,$e[4],18); $p.Dispose()
            $b=New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(190,35,45,52)); Fill-Round $g $b ($e[2]+4) ($e[3]-8) ($e[4]-8) 7 3; $b.Dispose(); $r=New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(235,92,100,120)); Fill-Round $g $r ($e[2]+4) ($e[3]-8) 45 7 3; $r.Dispose()
            Draw-Cell $g $enemy $e[0] 0 4 2 $e[2] $e[3] $e[4] $e[4] $true
        }
    }

    # Bottom operation area, separated from the route by the veil.
    if($mode -eq 'prep'){
        $panel=New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(225,8,45,59)); Round-Rect $g $panel 16 574 650 130 24; $panel.Dispose()
        Txt $g '拖动头像调整顺序' $fontTiny ([Drawing.Color]::White) 35 580 200 24 'Near'
        $names=@('岩盾','叶灵','珊歌','阳光','潮行')
        for($i=0;$i -lt 5;$i++){
            $x=28+$i*124; $c=New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(235,22,73,86)); Round-Rect $g $c $x 606 110 84 16; $c.Dispose(); Round-Stroke $g (New-Object Drawing.Pen($quality[$i],2)) $x 606 110 84 16
            if($i -eq 0){Draw-Cell $g $main 0 1 4 4 ($x+6) 613 48 48 $true} elseif($i -eq 1){Draw-Cell $g $main 0 0 4 4 ($x+6) 613 48 48 $true} elseif($i -eq 2){Draw-Cell $g $main 0 2 4 4 ($x+6) 613 48 48 $true} elseif($i -eq 3){Draw-Cell $g $support 0 0 4 4 ($x+6) 613 48 48 $true} else {Draw-Cell $g $support 0 1 4 4 ($x+6) 613 48 48 $true}
            Txt $g ($i+1) $fontTiny ([Drawing.Brushes]::White) ($x+60) 612 24 18 'Center'; Txt $g $names[$i] $fontTiny $ink ($x+55) 636 50 18 'Center'
            $hb=New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(110,0,0,0)); Fill-Round $g $hb ($x+8) 674 94 7 3; $hb.Dispose(); $hpf=New-Object Drawing.SolidBrush($quality[$i]); Fill-Round $g $hpf ($x+8) 674 82 7 3; $hpf.Dispose()
            Txt $g '↔' $fontSmall ([Drawing.Brushes]::White) ($x+42) 646 24 24 'Center'
        }
        $go=New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(235,34,180,190)); Round-Rect $g $go 1012 598 248 78 22; $go.Dispose(); Round-Stroke $g (New-Object Drawing.Pen([Drawing.Color]::FromArgb(190,160,255,240),2)) 1012 598 248 78 22; Txt $g '开始战斗' $fontBig ([Drawing.Brushes]::White) 1018 606 236 50 'Center'
    } elseif($fusion) {
        $left=New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(226,8,45,59)); Round-Rect $g $left 16 574 625 130 24; $left.Dispose(); Txt $g '队伍' $fontTiny ([Drawing.Brushes]::White) 34 580 70 24 'Near'
        $names=@('岩盾','叶灵','珊歌','阳光','潮行')
        for($i=0;$i -lt 5;$i++){
            $x=28+$i*118; $c=New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(235,22,73,86)); Round-Rect $g $c $x 606 104 84 16; $c.Dispose(); Round-Stroke $g (New-Object Drawing.Pen($quality[$i],2)) $x 606 104 84 16
            if($i -eq 0){Draw-Cell $g $main 0 1 4 4 ($x+4) 612 50 50 $true} elseif($i -eq 1){Draw-Cell $g $main 0 0 4 4 ($x+4) 612 50 50 $true} elseif($i -eq 2){Draw-Cell $g $main 0 2 4 4 ($x+4) 612 50 50 $true} elseif($i -eq 3){Draw-Cell $g $support 0 0 4 4 ($x+4) 612 50 50 $true} else {Draw-Cell $g $support 0 1 4 4 ($x+4) 612 50 50 $true}; Txt $g $names[$i] $fontTiny $ink ($x+53) 616 46 20 'Center'; $hb=New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(110,0,0,0)); Fill-Round $g $hb ($x+8) 674 88 7 3; $hb.Dispose(); $hpf=New-Object Drawing.SolidBrush($quality[$i]); Fill-Round $g $hpf ($x+8) 674 78 7 3; $hpf.Dispose()
        }
        $right=New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(232,8,45,59)); Round-Rect $g $right 680 574 580 130 24; $right.Dispose(); Txt $g '局内合宠' $fontTitle ([Drawing.Brushes]::White) 704 582 100 24 'Near'
        $sel=New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(238,237,249,239)); Round-Rect $g $sel 800 597 82 80 16; $sel.Dispose(); Draw-Cell $g $main 0 1 4 4 811 608 56 56 $true
        Txt $g '+' $fontBig ([Drawing.Brushes]::White) 890 608 38 56 'Center'
        $sel=New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(238,237,249,239)); Round-Rect $g $sel 928 597 82 80 16; $sel.Dispose(); Draw-Cell $g $support 0 1 4 4 939 608 56 56 $true
        $merge=New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(235,34,180,190)); Round-Rect $g $merge 1032 597 216 80 20; $merge.Dispose(); Txt $g '确认合宠' $fontTitle ([Drawing.Brushes]::White) 1040 607 200 56 'Center'
    } else {
        $left=New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(226,8,45,59)); Round-Rect $g $left 16 574 625 130 24; $left.Dispose(); Txt $g '队伍' $fontTiny ([Drawing.Brushes]::White) 34 580 70 24 'Near'
        $names=@('岩盾','叶灵','珊歌','阳光','潮行')
        for($i=0;$i -lt 5;$i++){
            $x=28+$i*118; $c=New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(235,22,73,86)); Round-Rect $g $c $x 606 104 84 16; $c.Dispose(); Round-Stroke $g (New-Object Drawing.Pen($quality[$i],2)) $x 606 104 84 16
            if($i -eq 0){Draw-Cell $g $main 0 1 4 4 ($x+4) 612 50 50 $true} elseif($i -eq 1){Draw-Cell $g $main 0 0 4 4 ($x+4) 612 50 50 $true} elseif($i -eq 2){Draw-Cell $g $main 0 2 4 4 ($x+4) 612 50 50 $true} elseif($i -eq 3){Draw-Cell $g $support 0 0 4 4 ($x+4) 612 50 50 $true} else {Draw-Cell $g $support 0 1 4 4 ($x+4) 612 50 50 $true}; Txt $g $names[$i] $fontTiny $ink ($x+53) 616 46 20 'Center'; $hb=New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(110,0,0,0)); Fill-Round $g $hb ($x+8) 674 88 7 3; $hb.Dispose(); $hpf=New-Object Drawing.SolidBrush($quality[$i]); Fill-Round $g $hpf ($x+8) 674 78 7 3; $hpf.Dispose()
        }
        $right=New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(232,8,45,59)); Round-Rect $g $right 680 574 580 130 24; $right.Dispose(); Txt $g '技能' $fontTiny ([Drawing.Brushes]::White) 704 580 60 24 'Near'
        $skillXs=@(815,910,1005,1100,1195)
        for($i=0;$i -lt 5;$i++){
            $x=710+$i*92; $c=New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(236,237,249,239)); Round-Rect $g $c $x 603 82 78 16; $c.Dispose(); $sc=Crop-Bmp $skillShot $skillXs[$i] 774 58 58; Draw-Image $g $sc ($x+12) 610 58 58; $sc.Dispose(); $skillNames=@('岩石风暴','穿甲弹','海霜风暴','大治疗','潮灵召唤'); Txt $g $skillNames[$i] $fontTiny $teal $x 673 82 20 'Center' }
        $auto=New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(235,34,180,190)); Round-Rect $g $auto 1178 603 70 78 16; $auto.Dispose(); Txt $g '自动' $fontTiny ([Drawing.Brushes]::White) 1182 614 62 22 'Center'; Txt $g '开启' $fontTiny ([Drawing.Brushes]::White) 1182 642 62 22 'Center'
    }
    $g.Dispose(); return $bmp
}

$prep=Make-Scene 'prep'; $prep.Save((Join-Path $outDir 'preparation.png'),[Drawing.Imaging.ImageFormat]::Png); $prep.Dispose()
$fusion=Make-Scene 'fusion'; $fusion.Save((Join-Path $outDir 'fusion.png'),[Drawing.Imaging.ImageFormat]::Png); $fusion.Dispose()
$battle=Make-Scene 'active'; $battle.Save((Join-Path $outDir 'active.png'),[Drawing.Imaging.ImageFormat]::Png); $battle.Dispose()
$bg.Dispose();$main.Dispose();$support.Dispose();$enemy.Dispose();$skills.Dispose();$skillShot.Dispose()
Write-Output $outDir
