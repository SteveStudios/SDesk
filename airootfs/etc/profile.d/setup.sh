#!/bin/bash

if (( EUID != 0 )); then
	gsettings set org.gnome.shell welcome-dialog-last-shown-version '4294967295'
	sudo dconf update
	
	gsettings set org.gnome.desktop.wm.preferences button-layout ":minimize,maximize,close"
	
	gnome-extensions enable user-theme@gnome-shell-extensions.gcampax.github.com
	gnome-extensions enable add-to-desktop@tommimon.github.com
	gnome-extensions enable appindicatorsupport@rgcjonas.gmail.com
	gnome-extensions enable dash-to-dock@micxgx.gmail.com
	gnome-extensions disable gtk4-ding@smedius.gitlab.com
	gnome-extensions enable light-style@gnome-shell-extensions.gcampax.github.com
	gnome-extensions enable tiling-assistant@leleat-on-github
	gnome-extensions enable arch-update@RaphaelRochet

	dconf write /org/gnome/shell/extensions/arch-update/notify false
	dconf write /org/gnome/shell/extensions/dash-to-dock/extend-height true
	dconf write /org/gnome/shell/extensions/dash-to-dock/show-apps-at-top true
	dconf write /org/gnome/shell/extensions/dash-to-dock/custom-theme-shrink true
	dconf write /org/gnome/shell/extensions/dash-to-dock/dock-fixed true
	dconf write /org/gnome/shell/extensions/dash-to-dock/running-indicator-style "'SQUARES'"
	dconf write /org/gnome/shell/extensions/dash-to-dock/always-center-icons true
	dconf write /org/gnome/shell/extensions/dash-to-dock/disable-overview-on-startup true
	dconf write /org/gnome/shell/extensions/dash-to-dock/dock-fixed false
    dconf write /org/gnome/shell/extensions/dash-to-dock/transparency-mode "'FIXED'"
	dconf write /org/gnome/shell/extensions/dash-to-dock/background-opacity 0.5
	dconf write /org/gnome/shell/extensions/dash-to-dock/autohide false
    dconf write /org/gnome/shell/extensions/dash-to-dock/intellihide false
	
	gsettings set org.gnome.desktop.interface icon-theme 'Marwaita-Cyan'
	gsettings set org.gnome.desktop.interface gtk-theme 'Marwaita-Light'
	
	gsettings set org.gnome.desktop.interface cursor-theme 'SShell'

	gsettings set org.gnome.desktop.background picture-uri file:////usr/share/pixmaps/sd-bg-default.png
	gsettings set org.gnome.desktop.background picture-uri-dark file:////usr/share/pixmaps/sd-bg-default.png
	
 	gsettings set org.gnome.shell favorite-apps "['calamares.desktop', 'swirl.desktop', 'org.gnome.Geary.desktop', 'org.gnome.Calendar.desktop', 'org.gnome.Music.desktop', 'org.gnome.Nautilus.desktop', 'octopi.desktop']"

	xdg-settings set default-web-browser swirl.desktop

	sudo rm -rf /usr/share/xsessions/gnome-classic-xorg.desktop
	sudo rm -rf /usr/share/xsessions/gnome-classic.desktop

	sudo rm -rf /usr/share/wayland-sessions/gnome-classic-wayland.desktop
	sudo rm -rf /usr/share/wayland-sessions/gnome-classic.desktop

	sudo sed -i 's/#write-cache/write-cache/g' /etc/apparmor/parser.conf
	sudo sed -i 's/#Optimize=compress-fast/Optimize=compress-fast/g' /etc/apparmor/parser.conf

    sudo aa-enforce /etc/apparmor.d/bin.ping
    sudo aa-enforce /etc/apparmor.d/busybox
    sudo aa-enforce /etc/apparmor.d/buildah
    sudo aa-enforce /etc/apparmor.d/ch-checkns
    sudo aa-enforce /etc/apparmor.d/ch-run
    sudo aa-enforce /etc/apparmor.d/crun
    sudo aa-enforce /etc/apparmor.d/devhelp
    sudo aa-enforce /etc/apparmor.d/linux-sandbox
    sudo aa-enforce /etc/apparmor.d/lxc-attach
    sudo aa-enforce /etc/apparmor.d/lxc-create
    sudo aa-enforce /etc/apparmor.d/lxc-destroy
    sudo aa-enforce /etc/apparmor.d/lxc-execute
    sudo aa-enforce /etc/apparmor.d/lxc-stop
    sudo aa-enforce /etc/apparmor.d/lxc-unshare
    sudo aa-enforce /etc/apparmor.d/lxc-usernsexec
    sudo aa-enforce /etc/apparmor.d/mmdebstrap
    sudo aa-enforce /etc/apparmor.d/php-fpm
    sudo aa-enforce /etc/apparmor.d/podman
    sudo aa-enforce /etc/apparmor.d/rootlesskit
    sudo aa-enforce /etc/apparmor.d/rpm
    sudo aa-enforce /etc/apparmor.d/runc
    sudo aa-enforce /etc/apparmor.d/samba-bgqd
    sudo aa-enforce /etc/apparmor.d/samba-dcerpcd
    sudo aa-enforce /etc/apparmor.d/samba-rpcd
    sudo aa-enforce /etc/apparmor.d/samba-rpcd-classic
    sudo aa-enforce /etc/apparmor.d/samba-rpcd-spoolss
    sudo aa-enforce /etc/apparmor.d/sbin.klogd
    sudo aa-enforce /etc/apparmor.d/sbin.syslogd
    sudo aa-enforce /etc/apparmor.d/sbin.syslog-ng
    sudo aa-enforce /etc/apparmor.d/slirp4netns
    sudo aa-enforce /etc/apparmor.d/stress-ng
    sudo aa-enforce /etc/apparmor.d/systemd-coredump
    sudo aa-enforce /etc/apparmor.d/toybox
    sudo aa-enforce /etc/apparmor.d/unix-chkpwd
    sudo aa-enforce /etc/apparmor.d/unprivileged_userns
    sudo aa-enforce /etc/apparmor.d/userbindmount
    sudo aa-enforce /etc/apparmor.d/uwsgi-core
    sudo aa-enforce /etc/apparmor.d/vpnns
    sudo aa-enforce /etc/apparmor.d/zgrep

	sudo systemctl start cups.service
	sudo systemctl enable cups.service
	
	sudo systemctl enable bluetooth
	sudo systemctl start bluetooth
	
	rfkill block bluetooth

	sudo calamares
fi
