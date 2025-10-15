#!/usr/bin/env bash
# shellcheck disable=SC2034

iso_name="sdesk"
iso_label="SDESK_$(date --date="@${SOURCE_DATE_EPOCH:-$(date +%s)}" +%Y%m)"
iso_publisher="SDesk <https://stevestudios.net>"
iso_application="SDesk Live/Rescue CD"
iso_codename="quartz"
iso_version="$(date --date="@${SOURCE_DATE_EPOCH:-$(date +%s)}" +%Y.%m.%d)-$iso_codename"
install_dir="sdesk"
buildmodes=('iso')
bootmodes=('bios.syslinux'
           'uefi.grub')

arch="x86_64"
pacman_conf="pacman.conf"
airootfs_image_type="squashfs"
airootfs_image_tool_options=('-comp' 'xz' '-Xbcj' 'x86' '-b' '1M' '-Xdict-size' '1M')
file_permissions=(
  ["/etc/shadow"]="0:0:0400"
  ["/etc/gshadow"]="0:0:0400"
  ["/root"]="0:0:750"
  ["/root/.automated_script.sh"]="0:0:755"
  ["/usr/local/bin/choose-mirror"]="0:0:755"
  ["/usr/local/bin/Installation_guide"]="0:0:755"
  ["/usr/local/bin/livecd-sound"]="0:0:755"
  ["/SDesk"]="0:0:755"
)
