# FORGE_CLIENT_ID, FORGE_CLIENT_SECRET, and FORGE_BUCKET must be set before running this script.

$forge_da_bin = "node ..\..\src\forge-da.js"

$appbundle_name = "MyTestBundle"
$appbundle_alias = "dev"
$appbundle_file = ".\ThumbnailPlugin.bundle.zip"
$appbundle_engine = "Autodesk.Inventor+24"

$activity_name = "MyTestActivity"
$activity_alias = "dev"

# Create or update an appbundle
Write-Host "Creating an appbundle $appbundle_name"
$result = Invoke-Expression "$forge_da_bin list-appbundles --short" | Select-String -Pattern $appbundle_name | Measure-Object -Line
if ($result.Lines -eq 0) {
    Write-Host "Creating new appbundle"
    Invoke-Expression "$forge_da_bin create-appbundle $appbundle_name $appbundle_file $appbundle_engine"
} else {
    Write-Host "Updating existing appbundle"
    Invoke-Expression "$forge_da_bin update-appbundle $appbundle_name $appbundle_file $appbundle_engine"
}

# Create or update an appbundle alias
Write-Host "Creating an appbundle alias $appbundle_alias"
$appbundle_version = Invoke-Expression "$forge_da_bin list-appbundle-versions $appbundle_name --short" | Select-Object -Last 1
Write-Host "Last appbundle version: $appbundle_version"
$result = Invoke-Expression "$forge_da_bin list-appbundle-aliases $appbundle_name --short" | Select-String -Pattern $appbundle_alias | Measure-Object -Line
if ($result.Lines -eq 0) {
    Write-Host "Creating new appbundle alias"
    Invoke-Expression "$forge_da_bin create-appbundle-alias $appbundle_alias $appbundle_name $appbundle_version"
} else {
    Write-Host "Updating existing appbundle alias"
    Invoke-Expression "$forge_da_bin update-appbundle-alias $appbundle_alias $appbundle_name $appbundle_version"
}

# Create or update an activity
Write-Host "Creating an activity $activity_name"
$result = Invoke-Expression "$forge_da_bin list-activities --short" | Select-String -Pattern $activity_name | Measure-Object -Line
if ($result.Lines -eq 0) {
    Write-Host "Creating new activity"
    Invoke-Expression "$forge_da_bin create-activity $activity_name $appbundle_name $appbundle_alias $appbundle_engine --input PartFile --output Thumbnail:thumbnail.bmp"
} else {
    Write-Host "Updating existing activity"
    Invoke-Expression "$forge_da_bin update-activity $activity_name $appbundle_name $appbundle_alias $appbundle_engine --input PartFile --output Thumbnail:thumbnail.bmp"
}

# Create or update an activity alias
Write-Host "Creating an activity alias $activity_alias"
$activity_version = Invoke-Expression "$forge_da_bin list-activity-versions $activity_name --short" | Select-Object -Last 1
Write-Host "Last activity version: $activity_version"
$result = Invoke-Expression "$forge_da_bin list-activity-aliases $activity_name --short" | Select-String -Pattern $activity_alias | Measure-Object -Line
if ($result.Lines -eq 0) {
    Write-Host "Creating new activity alias"
    Invoke-Expression "$forge_da_bin create-activity-alias $activity_alias $activity_name $activity_version"
} else {
    Write-Host "Updating existing activity alias"
    Invoke-Expression "$forge_da_bin update-activity-alias $activity_alias $activity_name $activity_version"
}
