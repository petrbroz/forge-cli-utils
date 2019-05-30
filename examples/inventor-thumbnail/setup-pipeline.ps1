# FORGE_CLIENT_ID, FORGE_CLIENT_SECRET, and FORGE_BUCKET must be set before running this script.

function Request-DA {
    $command = $args[0]
    $result = Invoke-Expression "node ..\..\src\forge-da.js $command"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "forge-da command failed: $command" -ErrorAction "Stop"
    }
    return $result
}

$appbundle_name = "MyTestBundle"
$appbundle_alias = "dev"
$appbundle_file = ".\ThumbnailPlugin.bundle.zip"
$appbundle_engine = "Autodesk.Inventor+24"

$activity_name = "MyTestActivity"
$activity_alias = "dev"

# Create or update an appbundle
Write-Host "Creating an appbundle $appbundle_name"
$result = Request-DA "list-appbundles --short"
$result = $result | Select-String -Pattern $appbundle_name | Measure-Object -Line
if ($result.Lines -eq 0) {
    Write-Host "Creating new appbundle"
    Request-DA "create-appbundle $appbundle_name $appbundle_file $appbundle_engine"
} else {
    Write-Host "Updating existing appbundle"
    Request-DA "update-appbundle $appbundle_name $appbundle_file $appbundle_engine"
}

# Create or update an appbundle alias
Write-Host "Creating an appbundle alias $appbundle_alias"
$result = Request-DA "list-appbundle-versions $appbundle_name --short"
$appbundle_version = $result | Select-Object -Last 1
Write-Host "Last appbundle version: $appbundle_version"
$result = Request-DA "list-appbundle-aliases $appbundle_name --short"
$result = $result | Select-String -Pattern $appbundle_alias | Measure-Object -Line
if ($result.Lines -eq 0) {
    Write-Host "Creating new appbundle alias"
    Request-DA "create-appbundle-alias $appbundle_alias $appbundle_name $appbundle_version"
} else {
    Write-Host "Updating existing appbundle alias"
    Request-DA "update-appbundle-alias $appbundle_alias $appbundle_name $appbundle_version"
}

# Create or update an activity
Write-Host "Creating an activity $activity_name"
$result = Request-DA "list-activities --short"
$result = $result | Select-String -Pattern $activity_name | Measure-Object -Line
if ($result.Lines -eq 0) {
    Write-Host "Creating new activity"
    Request-DA "create-activity $activity_name $appbundle_name $appbundle_alias $appbundle_engine --input PartFile --output Thumbnail --output-local-name thumbnail.bmp"
} else {
    Write-Host "Updating existing activity"
    Request-DA "update-activity $activity_name $appbundle_name $appbundle_alias $appbundle_engine --input PartFile --output Thumbnail --output-local-name thumbnail.bmp"
}

# Create or update an activity alias
Write-Host "Creating an activity alias $activity_alias"
$result = Request-DA "list-activity-versions $activity_name --short"
$activity_version = $result | Select-Object -Last 1
Write-Host "Last activity version: $activity_version"
$result = Request-DA "list-activity-aliases $activity_name --short"
$result = $result | Select-String -Pattern $activity_alias | Measure-Object -Line
if ($result.Lines -eq 0) {
    Write-Host "Creating new activity alias"
    Request-DA "create-activity-alias $activity_alias $activity_name $activity_version"
} else {
    Write-Host "Updating existing activity alias"
    Request-DA "update-activity-alias $activity_alias $activity_name $activity_version"
}
