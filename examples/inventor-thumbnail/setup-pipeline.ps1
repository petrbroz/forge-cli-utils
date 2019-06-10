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
Write-Host "Creating/updating an appbundle $appbundle_name"
Request-DA "create-appbundle $appbundle_name $appbundle_file $appbundle_engine --update"

# Create or update an appbundle alias
Write-Host "Creating/updating an appbundle alias $appbundle_alias"
$appbundle_version = $result | Select-Object -Last 1
Request-DA "create-appbundle-alias $appbundle_alias $appbundle_name $appbundle_version --update"

# Create or update an activity
Write-Host "Creating/updating an activity $activity_name"
Request-DA "create-activity $activity_name $appbundle_name $appbundle_alias $appbundle_engine --input PartFile --output Thumbnail --output-local-name thumbnail.bmp --update"

# Create or update an activity alias
Write-Host "Creating/updating an activity alias $activity_alias"
$activity_version = $result | Select-Object -Last 1
Request-DA "create-activity-alias $activity_alias $activity_name $activity_version --update"
