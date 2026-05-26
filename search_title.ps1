Get-ChildItem -Path "src" -Recurse -Include "*.tsx","*.ts","*.css","*.html" | Select-String -Encoding UTF8 -Pattern "市民総合" | Select-Object LineNumber,Line,Path | Format-List
Get-ChildItem -Path "." -Include "*.html","*.css" | Select-String -Encoding UTF8 -Pattern "市民総合" | Select-Object LineNumber,Line,Path | Format-List
