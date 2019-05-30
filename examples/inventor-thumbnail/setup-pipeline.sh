#!/bin/bash

# FORGE_CLIENT_ID, FORGE_CLIENT_SECRET, and FORGE_BUCKET must be set before running this script.

FORGE_DA_SCRIPT="node ../../src/forge-da.js"

APPBUNDLE_NAME=TestBundle
APPBUNDLE_ALIAS=dev
APPBUNDLE_FILE=./ThumbnailPlugin.bundle.zip
APPBUNDLE_ENGINE=Autodesk.Inventor+24

ACTIVITY_NAME=TestActivity
ACTIVITY_ALIAS=dev

# Create or update an appbundle
if [ $($FORGE_DA_SCRIPT list-appbundles --short | grep $APPBUNDLE_NAME | wc -l) -eq "0" ] # TODO: use better matching
then
echo "Creating new appbundle"
$FORGE_DA_SCRIPT create-appbundle $APPBUNDLE_NAME $APPBUNDLE_FILE $APPBUNDLE_ENGINE "Bundle for testing Forge CLI tool"
else
echo "Updating existing appbundle"
$FORGE_DA_SCRIPT update-appbundle $APPBUNDLE_NAME $APPBUNDLE_FILE $APPBUNDLE_ENGINE "Bundle for testing Forge CLI tool"
fi

# Create or update an appbundle alias
APPBUNDLE_VERSION=$($FORGE_DA_SCRIPT list-appbundle-versions $APPBUNDLE_NAME --short | tail -n 1)
if [ $($FORGE_DA_SCRIPT list-appbundle-aliases $APPBUNDLE_NAME --short | grep $APPBUNDLE_ALIAS | wc -l) -eq "0" ] # TODO: use better matching
then
echo "Creating new appbundle alias"
$FORGE_DA_SCRIPT create-appbundle-alias $APPBUNDLE_ALIAS $APPBUNDLE_NAME $APPBUNDLE_VERSION
else
echo "Updating existing appbundle alias"
$FORGE_DA_SCRIPT update-appbundle-alias $APPBUNDLE_ALIAS $APPBUNDLE_NAME $APPBUNDLE_VERSION
fi

# Create or update an activity
if [ $($FORGE_DA_SCRIPT list-activities --short | grep $ACTIVITY_NAME | wc -l) -eq "0" ] # TODO: use better matching
then
echo "Creating new activity"
$FORGE_DA_SCRIPT create-activity $ACTIVITY_NAME $APPBUNDLE_NAME $APPBUNDLE_ALIAS $APPBUNDLE_ENGINE --input PartFile --output Thumbnail --output-local-name thumbnail.bmp
else
echo "Updating existing activity"
$FORGE_DA_SCRIPT update-activity $ACTIVITY_NAME $APPBUNDLE_NAME $APPBUNDLE_ALIAS $APPBUNDLE_ENGINE --input PartFile --output Thumbnail --output-local-name thumbnail.bmp
fi

# Create or update an activity alias
ACTIVITY_VERSION=$($FORGE_DA_SCRIPT list-activity-versions $ACTIVITY_NAME --short | tail -n 1)
if [ $($FORGE_DA_SCRIPT list-activity-aliases $ACTIVITY_NAME --short | grep $ACTIVITY_ALIAS | wc -l) -eq "0" ] # TODO: use better matching
then
echo "Creating new activity alias"
$FORGE_DA_SCRIPT create-activity-alias $ACTIVITY_ALIAS $ACTIVITY_NAME $ACTIVITY_VERSION
else
echo "Updating existing activity alias"
$FORGE_DA_SCRIPT update-activity-alias $ACTIVITY_ALIAS $ACTIVITY_NAME $ACTIVITY_VERSION
fi
