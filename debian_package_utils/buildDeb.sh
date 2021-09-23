#!/bin/bash
SRC="/tmp/handyhost_deb_src"
SYSROOT="$SRC/deb-src/sysroot"
DIST="/tmp/handyhost_deb_dist"
DEBIAN="$SRC/deb-src/DEBIAN"

rm -rf $SRC && \
rm -rf $DIST && \
mkdir -p $DIST && \
mkdir -p $SRC/deb-src && \
mkdir -p $DEBIAN && \
touch $DEBIAN/postinst && \
touch $DEBIAN/preinst && \
touch $DEBIAN/prerm && \
mkdir -p $SYSROOT/opt/handyhost && \
mkdir -p $SYSROOT/usr/share && \
mkdir -p $SYSROOT/etc/init.d && \
mkdir -p $SYSROOT/usr/share/applications && \
mkdir -p $SYSROOT/usr/share/doc/handyhost && \
mkdir -p $SYSROOT/usr/share/icons/hicolor/scalable/apps && \
mkdir -p $SYSROOT/usr/share/icons/hicolor/48x48/apps && \
cp ./handyhost.init $SYSROOT/etc/init.d/handyhost && \
cp ./copyright $SYSROOT/usr/share/doc/handyhost/copyright && \
cp ./README $SYSROOT/usr/share/doc/handyhost/README && \
cp ./preinst $DEBIAN/preinst && \
cp ./postinst $DEBIAN/postinst && \
cp ./prerm $DEBIAN/prerm && \
cp ./handyhost.desktop $SYSROOT/usr/share/applications/handyhost.desktop && \
cp ./handyhost.svg $SYSROOT/usr/share/icons/hicolor/scalable/apps/handyhost.svg && \
cp ./handyhost.png $SYSROOT/usr/share/icons/hicolor/48x48/apps/handyhost.png && \
cp ./control $DEBIAN/control
cp -r ../ $SYSROOT/opt/handyhost && \
rm -rf $SYSROOT/opt/handyhost/node_modules && \
rm -rf $SYSROOT/opt/handyhost/client/bower_components && \
rm -rf $SYSROOT/opt/handyhost/.git && \
SIZE=`du -s ${SYSROOT} | sed s'/\s\+.*//'`+8 && \
architecture=$(dpkg --print-architecture)

find ${SRC}/ -type d -exec chmod 0755 {} \;
find ${SRC}/ -type f -exec chmod go-w {} \;
chown -R root:root ${SRC}/ && \
pushd ${SYSROOT}/
tar czf ${DIST}/data.tar.gz [a-z]*
popd

sed s"/SIZE/${SIZE}/" -i $DEBIAN/control && \
sed s"/ARCH/${architecture}/" -i $DEBIAN/control && \

pushd ${DEBIAN}/
tar czf ${DIST}/control.tar.gz *
popd

pushd ${DIST}/
echo 2.0 > ./debian-binary

find ${DIST}/ -type d -exec chmod 0755 {} \;
find ${DIST}/ -type f -exec chmod go-w {} \;
chown -R root:root ${DIST}/
ar r ${DIST}/handyhost_${1}.deb debian-binary control.tar.gz data.tar.gz
popd







