#!/bin/bash

# FORGE_CLIENT_ID, FORGE_CLIENT_SECRET, and FORGE_BUCKET must be set before running this script.

set -e # Exit on any error

FORGE_DM_SCRIPT="node ../../src/forge-dm.js"
FORGE_DA_SCRIPT="node ../../src/forge-da.js"

ACTIVITY_NAME=TestActivity
ACTIVITY_ALIAS=dev

INPUT_FILE_PATH=./Clutch_Gear_20t.ipt
INPUT_OBJECT_KEY=input.ipt
THUMBNAIL_OBJECT_KEY=thumbnail.bmp

# If it does not exist, create a data bucket
if [ $($FORGE_DM_SCRIPT list-buckets --short | grep $FORGE_BUCKET | wc -l) -eq "0" ] # TODO: use better matching
then
echo "Creating a bucket $FORGE_BUCKET"
$FORGE_DM_SCRIPT create-bucket $FORGE_BUCKET
fi

# Upload Inventor file and create a placeholder for the output thumbnail
echo "Preparing input/output files"
$FORGE_DM_SCRIPT upload-object $INPUT_FILE_PATH application/octet-stream $FORGE_BUCKET $INPUT_OBJECT_KEY
mkdir -p output
touch output/thumbnail.bmp
$FORGE_DM_SCRIPT upload-object output/thumbnail.bmp image/bmp $FORGE_BUCKET $THUMBNAIL_OBJECT_KEY

# Generate signed URLs for all input and output files
echo "Creating signed URLs"
INPUT_FILE_SIGNED_URL=$($FORGE_DM_SCRIPT create-signed-url $FORGE_BUCKET $INPUT_OBJECT_KEY --access read --short)
THUMBNAIL_SIGNED_URL=$($FORGE_DM_SCRIPT create-signed-url $FORGE_BUCKET $THUMBNAIL_OBJECT_KEY --access readwrite --short)

# Create work item and poll the results
echo "Creating work item"
WORKITEM_ID=$($FORGE_DA_SCRIPT create-workitem $ACTIVITY_NAME $ACTIVITY_ALIAS --input PartFile --input-url $INPUT_FILE_SIGNED_URL --output Thumbnail --output-url $THUMBNAIL_SIGNED_URL --short)
echo "Waiting for work item $WORKITEM_ID to complete"
WORKITEM_STATUS="inprogress"
while [ $WORKITEM_STATUS == "inprogress" ]
do
sleep 5
WORKITEM_STATUS=$($FORGE_DA_SCRIPT get-workitem $WORKITEM_ID --short)
echo $WORKITEM_STATUS
done

# Download the results
echo "Downloading results to output/thumbnail.bmp"
$FORGE_DM_SCRIPT download-object $FORGE_BUCKET $THUMBNAIL_OBJECT_KEY output/thumbnail.bmp

echo "Process complete. See the thumbnail in the output folder, or download it from $THUMBNAIL_SIGNED_URL"
