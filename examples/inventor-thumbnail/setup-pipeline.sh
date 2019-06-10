#!/bin/bash

# FORGE_CLIENT_ID, FORGE_CLIENT_SECRET, and FORGE_BUCKET must be set before running this script.

set -e # Exit on any error

FORGE_DA_SCRIPT="node ../../src/forge-da.js"

APPBUNDLE_NAME=TestBundle
APPBUNDLE_ALIAS=dev
APPBUNDLE_FILE=./ThumbnailPlugin.bundle.zip
APPBUNDLE_ENGINE=Autodesk.Inventor+24

ACTIVITY_NAME=TestActivity
ACTIVITY_ALIAS=dev

# Create or update an appbundle
echo "Creating/updating appbundle"
$FORGE_DA_SCRIPT create-appbundle $APPBUNDLE_NAME $APPBUNDLE_FILE $APPBUNDLE_ENGINE "Bundle for testing Forge CLI tool" --update

# Create or update an appbundle alias
APPBUNDLE_VERSION=$($FORGE_DA_SCRIPT list-appbundle-versions $APPBUNDLE_NAME --short | tail -n 1)
echo "Creating/updating appbundle alias"
$FORGE_DA_SCRIPT create-appbundle-alias $APPBUNDLE_ALIAS $APPBUNDLE_NAME $APPBUNDLE_VERSION --update

# Create or update an activity
echo "Creating/updating activity"
$FORGE_DA_SCRIPT create-activity $ACTIVITY_NAME $APPBUNDLE_NAME $APPBUNDLE_ALIAS $APPBUNDLE_ENGINE --input PartFile --output Thumbnail --output-local-name thumbnail.bmp --update

# Create or update an activity alias
ACTIVITY_VERSION=$($FORGE_DA_SCRIPT list-activity-versions $ACTIVITY_NAME --short | tail -n 1)
echo "Creating/updating activity alias"
$FORGE_DA_SCRIPT create-activity-alias $ACTIVITY_ALIAS $ACTIVITY_NAME $ACTIVITY_VERSION --update
