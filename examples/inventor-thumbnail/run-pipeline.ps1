# FORGE_CLIENT_ID, FORGE_CLIENT_SECRET, and FORGE_BUCKET must be set before running this script.

function Request-DM {
    $command = $args[0]
    $result = Invoke-Expression "node ..\..\src\forge-dm.js $command"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "forge-dm command failed: $command" -ErrorAction "Stop"
    }
    return $result
}

function Request-DA {
    $command = $args[0]
    $result = Invoke-Expression "node ..\..\src\forge-da.js $command"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "forge-da command failed: $command" -ErrorAction "Stop"
    }
    return $result
}

$activity_name = "MyTestActivity"
$activity_alias = "dev"

$input_file_path = ".\Clutch_Gear_20t.ipt"
$input_object_key = "input.ipt"
$thumbnail_object_key = "thumbnail.bmp"

# If it does not exist, create a data bucket
$result = Request-DM "list-buckets --short"
$result = $result | Select-String -Pattern $env:FORGE_BUCKET | Measure-Object -Line
if ($result.Lines -eq 0) {
    Write-Host "Creating a bucket $env:FORGE_BUCKET"
    Request-DM "create-bucket $env:FORGE_BUCKET"
}

# Upload Inventor file and create a placeholder for the output thumbnail
Write-Host "Preparing input/output files"
Request-DM "upload-object $input_file_path application/octet-stream $env:FORGE_BUCKET $input_object_key"
New-Item -Name "output" -Path "." -ItemType "directory"
New-Item -Name "thumbnail.bmp" -Path ".\output" -ItemType "file"
Request-DM "upload-object .\output\thumbnail.bmp image/bmp $env:FORGE_BUCKET $thumbnail_object_key"

# Generate signed URLs for all input and output files
Write-Host "Creating signed URLs"
$input_file_signed_url = Request-DM "create-signed-url $env:FORGE_BUCKET $input_object_key --access read --short"
$thumbnail_signed_url = Request-DM "create-signed-url $env:FORGE_BUCKET $thumbnail_object_key --access readwrite --short"

# Create work item and poll the results
Write-Host "Creating work item"
$workitem_id = Request-DA "create-workitem $activity_name $activity_alias --input PartFile --input-url $input_file_signed_url --output Thumbnail --output-url $thumbnail_signed_url --short"
Write-Host "Waiting for work item $workitem_id to complete"
$workitem_status = "inprogress"
while ($workitem_status -eq "inprogress") {
    Start-Sleep -s 5
    $workitem_status = Request-DA "get-workitem $workitem_id --short"
    Write-Host $workitem_status
}

# Download the results
Write-Host "Downloading results to output/thumbnail.bmp"
Request-DM "download-object $env:FORGE_BUCKET $thumbnail_object_key output\thumbnail.bmp"
Write-Host "Process complete. See the thumbnail in the output folder, or download it from $thumbnail_signed_url"
