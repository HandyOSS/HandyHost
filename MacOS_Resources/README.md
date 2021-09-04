###MacOS Build Instructions

#####Create a package installer.

1. download Packages.app
2. Create a new Raw Installer
3. Project: Reference folder is the source code dir
4. Settings: com.HandySoftware.pkg.HandyHost and version number
5. Settings: no checkboxes in Options
6. Payload: Create folder /Applications/HandyHost, owner (you + group settings)
7. Payload: click + button below Contents and link the source code dir as an absolute path
8. Scripts: Post-installation: choose installMAC_PKG_POSTINSTALL.sh from the source code root dir.
9. Build: Build.

Upon running the package installer, teh postinstall script will install dependencies, build our .app from source and output to /Applications/HandyHost/HandyHost.app
