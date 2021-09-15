#!/bin/bash
diskutil list -plist | \
plutil -convert json -r -o - -