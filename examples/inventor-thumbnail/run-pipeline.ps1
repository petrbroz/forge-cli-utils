# FORGE_CLIENT_ID, FORGE_CLIENT_SECRET, and FORGE_BUCKET must be set before running this script.

$forge_dm_bin = "node ..\..\src\forge-dm.js"
$forge_da_bin = "node ..\..\src\forge-da.js"

$activity_name = "MyTestActivity"
$activity_alias = "dev"

$input_file_path = ".\Clutch_Gear_20t.ipt"
$input_object_key = "input.ipt"
$thumbnail_object_key = "thumbnail.bmp"

# If it does not exist, create a data bucket
$result = Invoke-Expression "$forge_dm_bin list-buckets --short"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Could not list buckets" -ErrorAction "Stop"
}
$result = $result | Select-String -Pattern $env:FORGE_BUCKET | Measure-Object -Line
if ($result.Lines -eq 0) {
    Write-Host "Creating a bucket $env:FORGE_BUCKET"
    Invoke-Expression "$forge_dm_bin create-bucket $env:FORGE_BUCKET"
}

# Upload Inventor file and create a placeholder for the output thumbnail
Write-Host "Preparing input/output files"
Invoke-Expression "$forge_dm_bin upload-object $input_file_path application/octet-stream $env:FORGE_BUCKET $input_object_key"
New-Item -Name "output" -Path "." -ItemType "directory"
New-Item -Name "thumbnail.bmp" -Path ".\output" -ItemType "file"
Invoke-Expression "$forge_dm_bin upload-object .\output\thumbnail.bmp image/bmp $env:FORGE_BUCKET $thumbnail_object_key"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Could not upload objects" -ErrorAction "Stop"
}

# Generate signed URLs for all input and output files
Write-Host "Creating signed URLs"
$input_file_signed_url = Invoke-Expression "$forge_dm_bin create-signed-url $env:FORGE_BUCKET $input_object_key --access read --short"
$thumbnail_signed_url = Invoke-Expression "$forge_dm_bin create-signed-url $env:FORGE_BUCKET $thumbnail_object_key --access readwrite --short"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Could not generate signed URLs" -ErrorAction "Stop"
}

# Create work item and poll the results
Write-Host "Creating work item"
$workitem_id = Invoke-Expression "$forge_da_bin create-workitem $activity_name $activity_alias --input PartFile --input-url $input_file_signed_url --output Thumbnail --output-url $thumbnail_signed_url --short"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Could not create work item" -ErrorAction "Stop"
}
Write-Host "Waiting for work item $workitem_id to complete"
$workitem_status = "inprogress"
while ($workitem_status -eq "inprogress") {
    Start-Sleep -s 5
    $workitem_status = Invoke-Expression "$forge_da_bin get-workitem $workitem_id --short"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Could not obtain work item status" -ErrorAction "Stop"
    }
    Write-Host $workitem_status
}

# Download the results
Write-Host "Downloading results to output/thumbnail.bmp"
Invoke-Expression "$forge_dm_bin download-object $env:FORGE_BUCKET $thumbnail_object_key output\thumbnail.bmp"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Could not download results" -ErrorAction "Stop"
}
Write-Host "Process complete. See the thumbnail in the output folder, or download it from $thumbnail_signed_url"
